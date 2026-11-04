// disclo-filings Worker (M2): loads canonical results from XBRL in R2 into the filings DB, every few minutes.
import { d1Sql } from "./d1.js";
import { auditJumps } from "./audit.js";
import { RESULT_KINDS, backfillBsCf, loadBatch, remarkBackfill, versionBackfill } from "./load.js";
import { census, tagCensus } from "./census.js";
import { loadEvents } from "./events.js";
import { caLists } from "./calists.js";
import { BS_LINES, CF_LINES, balanceAndCash, parsePit, parseXbrl, statementDetail } from "@disclo/core";

export interface Env { DB_FILINGS: D1Database; DB_MARKET: D1Database; RAW: R2Bucket; ENVIRONMENT: string; MONTHLY_WRITE_CAP?: string; BSCF_LOAD?: string; FOCUS_INDICES?: string }

/** D155 (owner #316): load filings only for the focus indices' companies (default Nifty 50 + Next 50 + Midcap 150); "ALL" = everyone. */
export async function focusSymbols(market: D1Database, spec = "NIFTY 50,NIFTY NEXT 50,NIFTY MIDCAP 150"): Promise<string[] | undefined> {
  if (spec.trim().toUpperCase() === "ALL") return undefined;
  const names = spec.split(",").map((x) => x.trim()).filter(Boolean);
  const r = await market.prepare(`SELECT DISTINCT i.value FROM index_membership m JOIN security_identifier i ON i.security_id = m.security_id AND i.id_type = 'nse_symbol'
    WHERE m.valid_to IS NULL AND m.index_name IN (SELECT value FROM json_each(?1))`).bind(JSON.stringify(names)).all<{ value: string }>();
  const syms = r.results.map((x) => x.value);
  return syms.length ? syms : undefined; // no snapshot yet → don't block loading
}

/** Owner #266: one monthly cap on billed D1 writes, shared with the market worker (ledger in the market DB). */
const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
async function capReached(env: Env, now: Date): Promise<boolean> {
  const r = await env.DB_MARKET.prepare("SELECT sum(rows) AS rows FROM write_budget WHERE day LIKE ?1").bind(istDay(now).slice(0, 7) + "-%").first<{ rows: number | null }>();
  return (r?.rows ?? 0) >= Number(env.MONTHLY_WRITE_CAP ?? 45_000_000);
}

async function getText(bucket: R2Bucket, key: string): Promise<string | null> {
  const o = await bucket.get(key);
  if (!o) return null;
  if (o.customMetadata?.enc === "gzip") return new Response(o.body.pipeThrough(new DecompressionStream("gzip"))).text();
  return o.text();
}

export default {
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      // One run at a time (cron fires every minute; a run can take longer).
      const now = new Date(), holder = crypto.randomUUID();
      const lock = await env.DB_FILINGS.prepare(`INSERT INTO job_lock (name, holder, expires_at) VALUES ('filings', ?1, ?2)
        ON CONFLICT (name) DO UPDATE SET holder = ?1, expires_at = ?2 WHERE job_lock.expires_at < ?3`)
        .bind(holder, new Date(now.getTime() + 5 * 60_000).toISOString(), now.toISOString()).run();
      if (!lock.meta.changes) return;
      if (await capReached(env, now)) { await env.DB_FILINGS.prepare("DELETE FROM job_lock WHERE name='filings' AND holder=?1").bind(holder).run(); console.log(JSON.stringify({ env: env.ENVIRONMENT, skipped: "monthly write cap reached" })); return; }
      const meter = { rows: 0 };
      let out: Awaited<ReturnType<typeof loadBatch>> = [];
      try {
        const ldeps = { filings: d1Sql(env.DB_FILINGS, meter), market: d1Sql(env.DB_MARKET), getText: (k: string) => getText(env.RAW, k), now: () => new Date(), bscf: env.BSCF_LOAD === "1", focus: await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES) };
        // C47: events first. Placed last, they never ran while the results backlog filled every run (cursor stuck at
        // job 250168; INFY 20 of NSE's 2,199 insider trades). Lists are small; 150 per run.
        await loadEvents(ldeps.filings, ldeps.getText, 150); // M2 events: PIT, SAST, board meetings, credit ratings (owner #289)
        out = await loadBatch(ldeps, 300, 8);
        if (ldeps.bscf) await backfillBsCf(ldeps, out.length < 300 ? 200 : 60); // M2: BS/CF + FY (D90) for earlier filings; a small share every run (it never started while the backlog filled every run)
        await versionBackfill(ldeps.filings, 150); // D48: label earlier-loaded revisions once
        await remarkBackfill(ldeps.filings, (k) => getText(env.RAW, k), 40); // owner #337: submission type + revision remark, once
      } finally {
        await env.DB_FILINGS.prepare("DELETE FROM job_lock WHERE name='filings' AND holder=?1").bind(holder).run();
      }
      if (meter.rows > 0) await env.DB_MARKET.prepare("INSERT INTO write_budget (day, rows) VALUES (?1, ?2) ON CONFLICT (day) DO UPDATE SET rows = rows + excluded.rows").bind(istDay(new Date()), meter.rows).run();
      const by: Record<string, number> = {};
      for (const o of out) by[o.status] = (by[o.status] ?? 0) + 1;
      console.log(JSON.stringify({ env: env.ENVIRONMENT, processed: out.length, by }));
    })());
  },
  async fetch(req: Request, env: Env) {
    const path = new URL(req.url).pathname;
    if (path === "/revisions") {
      // Read-only (D48): periods with more than one results filing for the same security and basis, with key figures.
      const rows = (await env.DB_FILINGS.prepare(`SELECT f.security_id, f.period_end, f.period_kind, f.basis, count(*) AS n, group_concat(f.disclosed_at, ' | ') AS disclosed
        FROM filing f WHERE f.kind <> 'shareholding' GROUP BY f.security_id, f.period_end, f.period_kind, f.basis HAVING count(*) > 1 ORDER BY n DESC LIMIT 40`).all()).results;
      const total = (await env.DB_FILINGS.prepare(`SELECT count(*) AS groups, sum(n) AS filings FROM (SELECT count(*) AS n FROM filing WHERE kind <> 'shareholding' GROUP BY security_id, period_end, period_kind, basis HAVING count(*) > 1)`).first());
      return Response.json({ total, sample: rows }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/events-count") {
      // Read-only: loaded event rows for one symbol and date range (owner #290: counts checked against NSE's own lists).
      const u = new URL(req.url), sym = u.searchParams.get("symbol") ?? "", from = Number(u.searchParams.get("from") ?? 0), to = Number(u.searchParams.get("to") ?? 99991231);
      const one = async (sql: string) => ((await env.DB_FILINGS.prepare(sql).bind(sym, from, to).first<{ n: number }>())?.n ?? 0);
      return Response.json({
        symbol: sym,
        insider_trades: await one("SELECT count(*) AS n FROM insider_trade WHERE symbol=?1 AND coalesce(from_d, 0) BETWEEN ?2 AND ?3"),
        sast: await one("SELECT count(*) AS n FROM sast_disclosure WHERE symbol=?1 AND cast(replace(substr(disclosed_at,1,10),'-','') AS INTEGER) BETWEEN ?2 AND ?3"),
        board_meetings: await one("SELECT count(*) AS n FROM board_meeting WHERE symbol=?1 AND coalesce(meeting_d, 0) BETWEEN ?2 AND ?3"),
      }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/if-list") {
      // Read-only (owner #337): every row of the stored NSE results lists for one company (period, basis, submission
      // type, revision remarks, dates, XBRL link) — to see whether a revised/restated filing exists for a period.
      const sym = new URL(req.url).searchParams.get("symbol") ?? "";
      const lists = (await env.DB_FILINGS.prepare("SELECT job_id, kind, url, r2_key, fetched_at FROM fetch_job WHERE symbol=?1 AND kind IN ('integrated_financials','results_quarterly','results_annual') AND status='done' ORDER BY job_id").bind(sym).all<{ job_id: number; kind: string; url: string; r2_key: string; fetched_at: string }>()).results;
      const rows: Record<string, unknown>[] = [];
      for (const l of lists) {
        const text = await getText(env.RAW, l.r2_key);
        if (!text) continue;
        let o: unknown; try { o = JSON.parse(text); } catch { continue; }
        const arr = (Array.isArray(o) ? o : ((o as Record<string, unknown>).data ?? [])) as Record<string, unknown>[];
        for (const r of arr) {
          const pick: Record<string, unknown> = { list: l.kind, list_fetched: l.fetched_at?.slice(0, 10) };
          for (const [k, v] of Object.entries(r)) if (v !== null && v !== "" && /period|qe_?date|todate|fromdate|audited|consol|cumulative|type|revis|remark|broadcast|filingdate|xbrl|date|nature|seq|relating/i.test(k)) pick[k] = typeof v === "string" ? v.slice(0, 140) : v;
          rows.push(pick);
        }
      }
      return Response.json({ lists: lists.length, rows }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/contexts") {
      // Read-only (owner #337): every context of one stored XBRL file — id, dates, dimensions, number of facts, sample tags.
      const key = new URL(req.url).searchParams.get("key") ?? "";
      if (!/^att\/xbrl\/[A-Za-z0-9_.-]+\.xml$/.test(key)) return new Response("bad key", { status: 400 });
      const xml = await getText(env.RAW, key);
      if (!xml) return new Response("not stored", { status: 404 });
      const inst = parseXbrl(xml);
      const n = new Map<string, string[]>();
      for (const f of inst.facts) { const a = n.get(f.contextRef) ?? []; a.push(f.tag.split(":")[1] ?? f.tag); n.set(f.contextRef, a); }
      const ctx = [...inst.contexts.values()].map((c) => ({ id: c.id, start: c.start, end: c.end, instant: c.instant, dims: c.dims, facts: n.get(c.id)?.length ?? 0, sample: (n.get(c.id) ?? []).slice(0, 6) }));
      const undefinedRefs = [...n.keys()].filter((k) => !inst.contexts.has(k)).map((k) => ({ id: k, facts: n.get(k)!.length, sample: n.get(k)!.slice(0, 6) }));
      const one = new URL(req.url).searchParams.get("ctx");
      if (one) {
        // values of one context; identity fields (PAN, DIN, CIN, address, contact) are never returned (public endpoint)
        const masked = /Identification|PAN\b|Pan[A-Z]|Din\b|DIN|CIN|Address|Email|Phone|Contact|Mobile/i;
        return Response.json(inst.facts.filter((f) => f.contextRef === one).map((f) => ({ tag: f.tag, value: masked.test(f.tag) ? "(masked)" : f.value?.slice(0, 200) ?? null, unit: f.unitRef, decimals: f.decimals })), { headers: { "cache-control": "no-store" } });
      }
      return Response.json({ facts: inst.facts.length, contexts: ctx.filter((c) => c.facts > 0).sort((a, b) => b.facts - a.facts), undefined_refs: undefinedRefs }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/restatements") {
      // Read-only (owner #336): restatement flags — one company (?symbol=) or a summary of all.
      const sym = new URL(req.url).searchParams.get("symbol");
      if (!sym) return Response.json({
        by_statement: (await env.DB_FILINGS.prepare("SELECT statement, count(*) AS lines, count(DISTINCT security_id || period_end || basis) AS periods FROM restatement_flag GROUP BY statement").all()).results,
        progress: (await env.DB_FILINGS.prepare("SELECT slot, at, detail FROM daily_refresh WHERE day='once' AND slot IN ('version_backfill','remark_backfill')").all()).results,
        revised_filings: (await env.DB_FILINGS.prepare("SELECT count(*) AS n, sum(revision_remark IS NOT NULL) AS with_remark FROM filing WHERE submission='Revision'").first()),
      }, { headers: { "cache-control": "no-store" } });
      const sid = (await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1 LIMIT 1").bind(sym).first<{ security_id: number }>())?.security_id;
      const rows = (await env.DB_FILINGS.prepare("SELECT statement, line, period_end, period_kind, basis, original_value, restated_value, change_pct, original_at, restated_at FROM restatement_flag WHERE security_id=?1 ORDER BY period_end DESC, basis, statement, abs(change_pct) DESC LIMIT 200").bind(sid ?? -1).all()).results;
      const revisions = (await env.DB_FILINGS.prepare("SELECT period_end, period_kind, basis, disclosed_at, submission, revision_remark FROM filing WHERE security_id=?1 AND (submission='Revision' OR revision_remark IS NOT NULL) ORDER BY period_end DESC").bind(sid ?? -1).all()).results;
      return Response.json({ flags: rows, revisions }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/py-check") {
      // Read-only (owner #336): balance-sheet restatements. Each stored results file of one company also carries the
      // PRIOR year-end balance sheet (PY_I); compare it with what we stored when that year-end was first reported.
      const sym = new URL(req.url).searchParams.get("symbol") ?? "";
      const sid = (await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1 LIMIT 1").bind(sym).first<{ security_id: number }>())?.security_id;
      if (!sid) return Response.json({ error: "unknown symbol" }, { status: 404 });
      const marks = RESULT_KINDS.map((_, i) => `?${i + 2}`).join(",");
      const jobs = (await env.DB_FILINGS.prepare(`SELECT job_id, r2_key FROM fetch_job WHERE symbol=?1 AND status='done' AND kind IN (${marks}) ORDER BY job_id`).bind(sym, ...RESULT_KINDS).all<{ job_id: number; r2_key: string }>()).results;
      const out = [];
      for (const j of jobs.slice(0, 80)) {
        const xml = await getText(env.RAW, j.r2_key);
        if (!xml) continue;
        let inst; try { inst = parseXbrl(xml); } catch { continue; }
        const pyFacts = inst.facts.filter((f) => f.contextRef === "PY_I").map((f) => f.tag.split(":")[1]);
        const durations = [...new Set([...inst.contexts.values()].filter((c) => c.start && !Object.keys(c.dims).length).map((c) => `${c.start}..${c.end}`))];
        const py = balanceAndCash(inst, { prior: true });
        if (!py.bs) { out.push({ file: j.r2_key.split("/").pop(), prior_year_facts: pyFacts, periods_in_file: durations, prior_balance_sheet: false }); continue; }
        const basis = /consol/i.test(inst.facts.find((f) => f.tag.endsWith(":NatureOfReportStandaloneConsolidated"))?.value ?? "") ? "consolidated" : "standalone";
        const filed = inst.facts.find((f) => f.tag.endsWith(":DateOfEndOfReportingPeriod"))?.value ?? null;
        const stored = (await env.DB_FILINGS.prepare("SELECT line, value, disclosed_at, version FROM fin_value WHERE security_id=?1 AND statement='bs' AND period_end=?2 AND basis=?3 AND dims='' ORDER BY disclosed_at")
          .bind(sid, py.bs.date, basis).all<{ line: string; value: string | null; disclosed_at: string; version: string }>()).results;
        const first = new Map<string, { value: string | null; at: string }>();
        for (const r of stored) if (!first.has(r.line)) first.set(r.line, { value: r.value, at: r.disclosed_at });
        const diffs = [], same = [];
        for (const [line, v] of Object.entries(py.bs.lines)) {
          const o = first.get(line);
          if (!o || o.value === null) continue;
          const d = Number(v) - Number(o.value);
          if (Math.abs(d) > 1e5) diffs.push({ line, stored: o.value, in_later_filing: v, change_cr: Math.round(d / 1e5) / 100, stored_from: o.at.slice(0, 10) }); else same.push(line);
        }
        out.push({ file: j.r2_key.split("/").pop(), filed_for: filed, basis, prior_year_end: py.bs.date, template: py.template, compared: diffs.length + same.length, same: same.length, restated: diffs });
      }
      return Response.json(out, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/cf-totals") {
      // Read-only comparison aid (owner #331): stored full-year cash-flow totals for one company, both bases, ₹ crore.
      const sym = new URL(req.url).searchParams.get("symbol") ?? "";
      const sid = (await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1 LIMIT 1").bind(sym).first<{ security_id: number }>())?.security_id;
      if (!sid) return Response.json({ error: "unknown symbol" }, { status: 404 });
      const rows = (await env.DB_FILINGS.prepare(`SELECT period_end, basis, line, value, disclosed_at, period_kind FROM fin_value WHERE security_id=?1 AND statement='cf' AND period_end LIKE '%-03-31'
          AND line IN ('x:CashFlowsFromUsedInOperatingActivities','x:CashFlowsFromUsedInInvestingActivities','x:CashFlowsFromUsedInFinancingActivities','cfo','cfi','cff','CashFlowsFromUsedInOperatingActivities','CashFlowsFromUsedInInvestingActivities','CashFlowsFromUsedInFinancingActivities','x:EffectOfExchangeRateChangesOnCashAndCashEquivalents')
          ORDER BY period_end DESC, basis, line, disclosed_at DESC`).bind(sid).all<{ period_end: string; basis: string; line: string; value: string; disclosed_at: string; period_kind: string }>()).results;
      return Response.json(rows.map((r) => ({ ...r, crore: Math.round(Number(r.value) / 1e5) / 100 })), { headers: { "cache-control": "no-store" } });
    }
    if (path === "/raw-probe") {
      // C53 read-only: shape of a stored probe answer (kind pit_gg_probe): bytes, top-level keys, row count, first row,
      // broadcast-date range. Public filing metadata only.
      const jobs = (await env.DB_FILINGS.prepare("SELECT job_id, url, r2_key, status, http_status, bytes FROM fetch_job WHERE kind='pit_gg_probe' ORDER BY job_id").all<{ job_id: number; url: string; r2_key: string; status: string; http_status: number | null; bytes: number | null }>()).results;
      const out = [];
      for (const j of jobs) {
        const text = j.status === "done" ? await getText(env.RAW, j.r2_key) : null;
        let info: Record<string, unknown> = {};
        if (text) try {
          const o = JSON.parse(text) as unknown;
          const rows = (Array.isArray(o) ? o : ((o as Record<string, unknown>).data ?? [])) as Record<string, unknown>[];
          const dates = rows.map((r) => String(r.broadcastDateTime ?? r.date ?? "")).filter(Boolean);
          info = { top: Array.isArray(o) ? "array" : Object.keys(o as object).slice(0, 10), rows: rows.length, first: rows[0] ?? null, broadcast_first: dates[0] ?? null, broadcast_last: dates[dates.length - 1] ?? null };
        } catch (e) { info = { err: String(e).slice(0, 80), head: text.slice(0, 120) }; }
        out.push({ job: j.job_id, url: j.url.replace(/^https:\/\/[^/]+\/api\//, ""), status: j.status, http: j.http_status, bytes: j.bytes, ...info });
      }
      return Response.json(out, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/pit-files") {
      // Read-only diagnosis: every stored insider-trade (PIT) list for one company — request, status, rows, date range.
      const sym = new URL(req.url).searchParams.get("symbol") ?? "";
      const jobs = (await env.DB_FILINGS.prepare(sym === "ALL" ? "SELECT job_id, url, r2_key, status, http_status, fetched_at, bytes FROM fetch_job WHERE kind='pit' AND symbol IS NULL ORDER BY job_id" : "SELECT job_id, url, r2_key, status, http_status, fetched_at, bytes FROM fetch_job WHERE kind='pit' AND symbol=?1 ORDER BY job_id").bind(...(sym === "ALL" ? [] : [sym])).all<{ job_id: number; url: string; r2_key: string; status: string; http_status: number | null; fetched_at: string | null; bytes: number | null }>()).results;
      const out = [];
      for (const j of jobs.slice(0, 20)) {
        const text = j.status === "done" ? await getText(env.RAW, j.r2_key) : null;
        let rows = null as number | null, min = null as string | null, max = null as string | null, err = null as string | null;
        if (text) try {
          const r = parsePit(text); rows = r.length;
          const ds = r.map((t) => t.disclosedAt).filter((x): x is string => !!x).sort(); min = ds[0] ?? null; max = ds[ds.length - 1] ?? null;
        } catch (e) { err = String(e).slice(0, 80); }
        out.push({ job: j.job_id, url: j.url.replace(/^https:\/\/[^/]+\/api\//, ""), status: j.status, http: j.http_status, fetched_at: j.fetched_at, bytes: j.bytes, rows, disclosed_min: min, disclosed_max: max, err });
      }
      return Response.json(out, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/fresh") {
      // Plan item 2 check (read-only): filings and events disclosed in the last 4 days (IST dates), as loaded now.
      const q = async (sql: string) => (await env.DB_FILINGS.prepare(sql).all()).results;
      return Response.json({
        filings: await q("SELECT substr(datetime(disclosed_at, '+330 minutes'), 1, 10) AS ist_day, kind, count(*) AS n FROM filing WHERE disclosed_at >= datetime('now', '-4 days') GROUP BY 1, 2 ORDER BY 1 DESC, 2"),
        newest: await q("SELECT kind, max(disclosed_at) AS latest FROM filing GROUP BY kind ORDER BY 2 DESC"),
        insider_trades_latest: await q("SELECT max(disclosed_at) AS latest FROM insider_trade"),
        sast_latest: await q("SELECT max(disclosed_at) AS latest FROM sast_disclosure"),
      }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/fy-check") {
      // Read-only, on demand (scans fin_load once): D90 full-year outcomes and failure reasons, from each file's load detail.
      const q = async (sql: string) => (await env.DB_FILINGS.prepare(sql).all()).results;
      return Response.json({
        fy_loaded: (await q("SELECT count(*) AS n FROM fin_load WHERE status='loaded' AND instr(detail, ' loaded') > 0 AND instr(detail, 'FY not loaded') = 0"))[0],
        fy_not_loaded: await q("SELECT substr(detail, instr(detail, 'FY not loaded: ') + 15, 50) AS reason, count(*) AS n FROM fin_load WHERE instr(detail, 'FY not loaded: ') > 0 GROUP BY 1 ORDER BY 2 DESC LIMIT 15"),
        failed: await q("SELECT substr(detail, 1, 70) AS reason, count(*) AS n FROM fin_load WHERE status='failed' GROUP BY 1 ORDER BY 2 DESC LIMIT 15"),
        backfill: await q("SELECT at, detail FROM daily_refresh WHERE day='once' AND slot='bscf_backfill'"),
        // event loader: the next event-kind jobs after its cursor (it waits at the first one not finished, C47)
        events_next: await q("SELECT job_id, kind, status, attempts, http_status, substr(error, 1, 60) AS error FROM fetch_job WHERE job_id > CAST(json_extract((SELECT detail FROM daily_refresh WHERE day='once' AND slot='events_cursor'), '$.after') AS INTEGER) AND kind IN ('pit','sast29','board_meetings','credit_rating') ORDER BY job_id LIMIT 5"),
      }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/held") {
      // Read-only: held/excluded items of one class, with their file URLs, for class-by-class fixes (D140).
      const u = new URL(req.url);
      const like = (u.searchParams.get("like") ?? "").slice(0, 40) + "%";
      const rows = (await env.DB_FILINGS.prepare("SELECT l.job_id, l.status, substr(l.detail,1,160) AS detail, j.kind, j.symbol, j.url FROM fin_load l JOIN fetch_job j ON j.job_id = l.job_id WHERE l.status IN ('review','failed','excluded') AND l.detail LIKE ?1 ORDER BY l.job_id LIMIT 60").bind(like).all()).results;
      return Response.json(rows, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/ca-lists") {
      const u = new URL(req.url);
      return Response.json(await caLists(d1Sql(env.DB_FILINGS), (k) => getText(env.RAW, k), Number(u.searchParams.get("after") ?? 0), Math.min(200, Number(u.searchParams.get("limit") ?? 200))), { headers: { "cache-control": "no-store" } });
    }
    if (path === "/census") {
      const u = new URL(req.url);
      if (u.searchParams.get("mode") === "cfgap") {
        // D154 residual classes (read-only): one stored results file's cash-flow detail, plus every tag with a value in
        // the year-to-date context that the detail lists don't cover (candidates for the missing lines).
        const key = u.searchParams.get("key") ?? "";
        if (!/^att\/xbrl\/[A-Za-z0-9_.-]+\.xml$/.test(key)) return new Response("bad key", { status: 400 });
        const xml = await getText(env.RAW, key);
        if (!xml) return new Response("not stored", { status: 404 });
        const inst = parseXbrl(xml);
        const d = statementDetail(inst, null, inst.contexts.has("FourD") ? "FourD" : null);
        const known = new Set([...CF_LINES, ...BS_LINES]);
        const other: Record<string, string> = {};
        for (const f of inst.facts) {
          if (f.contextRef !== "FourD" || f.nil || !f.value || !/^-?\d/.test(f.value)) continue;
          const n = f.tag.split(":")[1] ?? f.tag;
          if (!known.has(n)) other[f.tag] ??= f.value;
        }
        // same period, with dimensions (company-described "other" items are often reported only this way)
        const yt = inst.contexts.get("FourD");
        const dims: { tag: string; dims: Record<string, string>; value: string }[] = [];
        for (const f of inst.facts) {
          const c = inst.contexts.get(f.contextRef);
          if (!yt || !c || !Object.keys(c.dims).length || c.start !== yt.start || c.end !== yt.end || f.nil || !f.value || !/Adjust|CashFlow|Proceeds|Payment/.test(f.tag)) continue;
          if (dims.length < 60) dims.push({ tag: f.tag, dims: c.dims, value: f.value });
        }
        const meta = (n: string) => inst.facts.find((f) => f.tag.endsWith(`:${n}`))?.value ?? null;
        const [job] = (await env.DB_FILINGS.prepare("SELECT job_id, symbol FROM fetch_job WHERE r2_key = ?1").bind(key).all<{ job_id: number; symbol: string | null }>()).results;
        const about = { symbol: job?.symbol ?? meta("Symbol"), job: job?.job_id ?? null, start: yt?.start ?? null, end: yt?.end ?? null, nature: meta("NatureOfReportStandaloneConsolidated") };
        return Response.json({ about, checks: d.cf?.checks ?? [], lines: d.cf?.lines ?? {}, other, dims }, { headers: { "cache-control": "no-store" } });
      }
      if (u.searchParams.get("mode") === "tags") return Response.json(await tagCensus(d1Sql(env.DB_FILINGS), (k) => getText(env.RAW, k), Number(u.searchParams.get("after") ?? 0), Math.min(50, Number(u.searchParams.get("limit") ?? 40))), { headers: { "cache-control": "no-store" } });
      const after = Number(u.searchParams.get("after") ?? 0), limit = Math.min(50, Math.max(1, Number(u.searchParams.get("limit") ?? 40)));
      return Response.json(await census(d1Sql(env.DB_FILINGS), (k) => getText(env.RAW, k), after, limit), { headers: { "cache-control": "no-store" } });
    }
    if (path === "/audit") return Response.json(await auditJumps(d1Sql(env.DB_FILINGS)), { headers: { "cache-control": "no-store" } });
    if (path !== "/status") return new Response("not found", { status: 404 });
    const q = async (s: string) => (await env.DB_FILINGS.prepare(s).all()).results;
    return Response.json({
      by_status: await q("SELECT status, count(*) AS n FROM fin_load GROUP BY status"),
      review_reasons: await q("SELECT substr(detail,1,60) AS reason, count(*) AS n FROM fin_load WHERE status IN ('review','failed') GROUP BY 1 ORDER BY 2 DESC LIMIT 15"),
      filings: await q("SELECT count(*) AS n FROM filing"),
      values: await q("SELECT basis, count(*) AS n FROM fin_value GROUP BY basis"),
      shareholding_filings: await q("SELECT count(*) AS n FROM filing WHERE kind='shareholding'"),
      bs_cf_values: await q("SELECT statement, count(*) AS n FROM fin_value WHERE statement IN ('bs','cf') GROUP BY statement"),
      restatements: { flags: (await q("SELECT count(*) AS n FROM restatement_flag"))[0], versions: await q("SELECT version, count(*) AS n FROM fin_value GROUP BY version"), backfill: await q("SELECT detail FROM daily_refresh WHERE day='once' AND slot='version_backfill'") },
      bscf_backfill: await q("SELECT at, detail FROM daily_refresh WHERE day='once' AND slot='bscf_backfill'"),
      focus: { indices: env.FOCUS_INDICES ?? "default", symbols: (await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES))?.length ?? "all" },
      events: { cursor: await q("SELECT detail FROM daily_refresh WHERE day='once' AND slot='events_cursor'"), insider_trades: (await q("SELECT count(*) AS n FROM insider_trade"))[0], sast: (await q("SELECT count(*) AS n FROM sast_disclosure"))[0], board_meetings: (await q("SELECT count(*) AS n FROM board_meeting"))[0], credit_ratings: (await q("SELECT count(*) AS n FROM credit_rating"))[0] },
      review_samples: await q("SELECT l.status, substr(l.detail,1,120) AS detail, j.symbol, j.url FROM fin_load l JOIN fetch_job j ON j.job_id = l.job_id WHERE l.status IN ('review','failed') ORDER BY l.at DESC LIMIT 8"),
    }, { headers: { "cache-control": "no-store" } });
  },
};
