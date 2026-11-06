// disclo-filings Worker (M2): loads canonical results from XBRL in R2 into the filings DB, every few minutes.
import { d1Sql } from "./d1.js";
import { auditJumps } from "./audit.js";
import { SQL_FEATURES_OF, buildFeatures, featuresStep, valuationsStep } from "./features.js";
import { COVERAGE_FLOOR, RESULT_KINDS, SQL_STATEMENT_ROWS, backfillBsCf, bankInsurerCashFlows, insurerBalanceSheets, insurerResultsLines, nbfcBalanceSheets, nbfcRevenueLines, cfUntaggedPass, segmentPass, fyReread, versionFix, SQL_SEGMENT_ROWS, SQL_SEGMENT_PERIODS, SQL_REVENUE_KINDS, SQL_PERIOD_LOADS, halfYearGaps, misattributed, reloadJobs, requeue404, loadBatch, remarkBackfill, versionBackfillFocus } from "./load.js";
import { census, tagCensus } from "./census.js";
import { focusIssuers, loadEvents, loadPitXbrl, ratingsRelink, SQL_INSIDER_SINCE, SQL_INSIDER_UNDATED, SQL_PIT_JOBS, SQL_RATINGS_SINCE, SQL_INSIDER_YEARS, SQL_PITX_SYMBOLS, SQL_ANNOUNCE_LISTS, isPitAnnouncement } from "./events.js";
import { shpCoverage, pledgeCensus, pledgeDeclaredPass, promoterGroups, shpPromoterPass, shpPromoterHistory, storeGroups, SQL_PROMOTER_HOLDERS } from "./shpcov.js";
import type { Sql } from "@disclo/core";
import { ownershipStep } from "./ownership.js";
import { eventStep } from "./eventfeatures.js";
import { ratingCoverage } from "./ratingcov.js";
import { fieldReadiness, gapCensus, linkAudit, readiness } from "./readiness.js";
import { SQL_BASIS_LISTS, basisLists, classifyGaps, nseListedFiles, primaryBasisStep, runPrimaryBasis } from "./basis.js";
import { caLists } from "./calists.js";
import { CF_INDUSTRIAL, CF_SUMMARY, chooseLayout, derivedPl, layoutStatement, withAdjustmentGap, BS_LINES, CF_LINES, type D1Meter, FOCUS_DEFAULT, FORBIDDEN_TEXT, balanceAndCash, chargeReads, staleness, writeCaps, writeLevel, writesThisMonth, focusSymbolsOf, parsePit, parseXbrl, readLevel, readsToday, statementDetail, statusAuthorized } from "@disclo/core";

export interface Env { DB_FILINGS: D1Database; DB_MARKET: D1Database; RAW: R2Bucket; ENVIRONMENT: string; MONTHLY_WRITE_CAP?: string; WRITE_SOFT_CAP?: string; WRITE_HARD_CAP?: string; WRITE_CAP_MONTH?: string; BSCF_LOAD?: string; FOCUS_INDICES?: string; STATUS_TOKEN?: string; DAILY_READ_CAP?: string }

/** D40 inputs: the focus companies (one symbol each), their names, and their latest filings' named holders. */
async function groupInputs(filings: Sql, market: Sql, focus: string[]) {
  const ids = await market.all<{ security_id: number; symbol: string }>("SELECT security_id, min(value) AS symbol FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1)) GROUP BY security_id", [JSON.stringify(focus)]);
  const sym = new Map(ids.map((r) => [r.security_id, r.symbol]));
  const names = new Map((await market.all<{ security_id: number; name: string }>("SELECT security_id, name FROM security WHERE security_id IN (SELECT value FROM json_each(?1))", [JSON.stringify([...sym.keys()])])).map((r) => [r.security_id, r.name]));
  const rows = await filings.all<{ security_id: number; category: string; holder_name: string; pct: string | null; promoter: number | null }>(SQL_PROMOTER_HOLDERS, [JSON.stringify([...sym.keys()])]);
  return { sym, names, rows };
}

/** D155 (owner #316): load filings only for the focus indices' companies (default Nifty 50 + Next 50 + Midcap 150); "ALL" = everyone. */
export async function focusSymbols(market: D1Database, spec = FOCUS_DEFAULT, meter?: D1Meter): Promise<string[] | undefined> {
  return focusSymbolsOf(d1Sql(market, meter), spec); // no snapshot yet → undefined, loading not blocked
}

/** P1 run budget and lock (audit 4 Nov): the cron fires every 5 minutes; a run starts no new step after 210 s. */
export const RUN_BUDGET_MS = 210_000, LOCK_TTL_MS = 10 * 60_000;

/** Owner #266: one monthly cap on billed D1 writes, shared with the market worker (ledger in the market DB). */
const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
/** D166: "soft" = optional steps and one-off passes stop; "hard" = nothing runs (live loading stops only here). */
async function capLevel(env: Env, now: Date) {
  return writeLevel(await writesThisMonth(d1Sql(env.DB_MARKET), now), writeCaps(env, now));
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
      // One run at a time. P1 (audit): a run stops starting work after RUN_BUDGET_MS (210 s) and the lock lasts 10 min,
      // so a run can never still be going when the next 5-minute cron fires and takes the lock.
      const now = new Date(), holder = crypto.randomUUID(), deadline = now.getTime() + RUN_BUDGET_MS;
      const lock = await env.DB_FILINGS.prepare(`INSERT INTO job_lock (name, holder, expires_at) VALUES ('filings', ?1, ?2)
        ON CONFLICT (name) DO UPDATE SET holder = ?1, expires_at = ?2 WHERE job_lock.expires_at < ?3`)
        .bind(holder, new Date(now.getTime() + LOCK_TTL_MS).toISOString(), now.toISOString()).run();
      if (!lock.meta.changes) return;
      const writes = await capLevel(env, now);
      if (writes === "hard") { await env.DB_FILINGS.prepare("DELETE FROM job_lock WHERE name='filings' AND holder=?1").bind(holder).run(); console.log(JSON.stringify({ env: env.ENVIRONMENT, skipped: "monthly hard write cap reached" })); return; }
      const meter: D1Meter = { rows: 0, reads: 0 };
      let out: Awaited<ReturnType<typeof loadBatch>> = [];
      const errors: string[] = [];
      const market = d1Sql(env.DB_MARKET, meter);
      // Every step is guarded: one failing step (a storage error, a parse error, the per-run query limit) is recorded
      // and cannot stop the steps after it (P1: events and insider trades were unguarded and could stop the whole run).
      const step = async <T>(name: string, f: () => Promise<T>): Promise<T | undefined> => {
        if (Date.now() > deadline) return undefined; // the run budget is spent: the step waits for the next run
        try { return await f(); } catch (e) {
          errors.push(name);
          await env.DB_FILINGS.prepare("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once', ?1, ?2, ?3) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail")
            .bind(`error:${name}`, new Date().toISOString(), String(e).slice(0, 300)).run().catch(() => {});
          return undefined;
        }
      };
      // C56 read breaker: rows read today by every worker. "soft": the optional step stops; "hard": smaller batches.
      const level = readLevel(await readsToday(market, now), Number(env.DAILY_READ_CAP ?? 150_000_000));
      try {
        const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES, meter);
        const ldeps = { filings: d1Sql(env.DB_FILINGS, meter), market, getText: (k: string) => getText(env.RAW, k), now: () => new Date(), bscf: env.BSCF_LOAD === "1", focus, deadline };
        // C47: events first, each with its own budget of lists (D161: rows of the focus companies only).
        // item 7: credit ratings carry no symbol; they are matched to the focus companies by the issuer part of the ISIN
        const issuers = focus ? await focusIssuers(market, focus) : undefined;
        await step("events", () => loadEvents(ldeps.filings, ldeps.getText, 150, { focus, deadline, issuers })); // PIT, SAST, board meetings, credit ratings
        await step("insider_xbrl", () => loadPitXbrl(ldeps.filings, ldeps.getText, 150, { focus, deadline })); // C53: NSE's system since 3 May 2026
        out = (await step("results", () => loadBatch(ldeps, level === "hard" ? 60 : 300, 8))) ?? [];
        // D50/D51: primary basis + basis-switch breaks, only for focus companies with newly loaded filings (live delta).
        // D163 (P1): the one-off passes (BS/CF backfill, version pass, remark pass) are not in the cron; they run when
        // started explicitly (POST /maint/<name> through the ops workflow), one bounded batch per call.
        if (level === "ok" && writes === "ok" && focus) {
          const sids = new Set((await market.all<{ security_id: number }>("SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?))", [JSON.stringify(focus)])).map((r) => r.security_id));
          await step("primary_basis", () => primaryBasisStep(ldeps.filings, market, ldeps.getText, sids, now));
          // D171: rebuild the feature table for focus companies with new results filings (own step: a failure in one
          // does not skip the other)
          await step("features", () => featuresStep(ldeps, sids, 10));
          await step("valuations", () => valuationsStep(ldeps, sids, 50)); // D171: P/E, P/B, EV/EBITDA on the latest close, once per trading day
          // D40: promoter groups stored once per IST day (≈ 15 k holder rows read; writes only changed companies)
          await step("groups", async () => {
            const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
            if ((await ldeps.filings.all("SELECT 1 FROM daily_refresh WHERE day=?1 AND slot='groups'", [day])).length) return null;
            const g = await groupInputs(ldeps.filings, market, focus);
            const r = await storeGroups(ldeps.filings, g.rows, g.sym, g.names, new Date());
            await ldeps.filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES (?1,'groups',?2,?3) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [day, new Date().toISOString(), JSON.stringify(r)]);
            return r;
          });
          // §11: ownership and pledge fields, once per IST day, 50 companies a run (after the groups, for the group pledge)
          await step("ownership", () => ownershipStep(ldeps.filings, [...sids], new Date(), 50));
          // §12/§13: results timing, filing timeliness, credit rating — once per IST day, 50 companies a run
          await step("event_features", () => eventStep(ldeps.filings, market, [...sids], new Date(), 50));
        }
      } finally {
        await env.DB_FILINGS.prepare("DELETE FROM job_lock WHERE name='filings' AND holder=?1").bind(holder).run();
        await chargeReads(d1Sql(env.DB_MARKET), new Date(), meter.reads ?? 0).catch(() => {});
      }
      if (meter.rows > 0) await env.DB_MARKET.prepare("INSERT INTO write_budget (day, rows) VALUES (?1, ?2) ON CONFLICT (day) DO UPDATE SET rows = rows + excluded.rows").bind(istDay(new Date()), meter.rows).run();
      const by: Record<string, number> = {};
      for (const o of out) by[o.status] = (by[o.status] ?? 0) + 1;
      console.log(JSON.stringify({ env: env.ENVIRONMENT, processed: out.length, by, reads: level, writes, errors, ms: Date.now() - now.getTime() }));
    })());
  },
  async fetch(req: Request, env: Env) {
    // Every page here is a diagnostic that can scan large tables; their addresses are in this public repo, so they answer
    // only with the status token (audit 4 Nov). Read-only pages: an exception is returned as its message.
    if (!statusAuthorized(req, env.STATUS_TOKEN)) return new Response(FORBIDDEN_TEXT, { status: 403, headers: { "cache-control": "no-store" } });
    try { return await this.page(req, env); } catch (e) { return Response.json({ error: String(e).slice(0, 300) }, { status: 500, headers: { "cache-control": "no-store" } }); }
  },

  async page(req: Request, env: Env): Promise<Response> {
    const path = new URL(req.url).pathname;
    // D163 (P1): one-off passes started explicitly (ops workflow), one bounded batch per call; each saves its position
    if (path.startsWith("/maint/") && req.method === "POST") {
      if ((await capLevel(env, new Date())) !== "ok") return Response.json({ done: false, refused: "monthly soft write cap reached (D166): one-off passes wait" }, { status: 429 });
      // owner #343 cost gate: every call is metered (D1 rows read / billed rows written), returned in the answer and
      // charged to the day's read and write budgets like a cron run
      const meter: D1Meter = { rows: 0, reads: 0 };
      const db = d1Sql(env.DB_FILINGS, meter), mk = d1Sql(env.DB_MARKET, meter), focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES, meter), name = path.slice(7);
      const ldeps = { filings: db, market: mk, getText: (k: string) => getText(env.RAW, k), now: () => new Date(), bscf: true, focus };
      let r: unknown;
      if (name === "bscf_backfill") r = await backfillBsCf(ldeps, 60, 20_000);
      else if (name === "nbfc_bs") r = await nbfcBalanceSheets(ldeps, 40, 20_000); // item 5: Division III balance-sheet lines
      else if (name === "nbfc_rev") r = await nbfcRevenueLines(ldeps, 40, 20_000); // item 5 leftover 3: the rest of NBFC revenue
      else if (name === "cf_untagged") r = await cfUntaggedPass(ldeps, 30, 20_000); // D167 (b): cash-flow detail with untagged adjustments
      // D47 segment results: ?dry=1 = census (nothing written), &companies=N for the first N companies
      // 2.12: re-read the full year of named loaded files (after a loadFy fix); per-line version relabel (dry=1 counts)
      else if (name === "fy_reread") r = await fyReread(ldeps, (new URL(req.url).searchParams.get("jobs") ?? "").split(",").map(Number));
      else if (name === "version_fix") r = await versionFix(ldeps, { dry: new URL(req.url).searchParams.get("dry") === "1" });
      // D40 (owner yes, 6 Nov): promoter flag of each focus company's latest shareholding filing, from its stored file
      else if (name === "shp_promoter_history") {
        const sids = (await mk.all<{ security_id: number }>("SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1))", [JSON.stringify(focus ?? [])])).map((x) => x.security_id);
        r = await shpPromoterHistory(db, ldeps.getText, sids, new Date(), COVERAGE_FLOOR, 25, new URL(req.url).searchParams.get("restart") === "1");
      }
      else if (name === "ownership") {
        const sids = (await mk.all<{ security_id: number }>("SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1))", [JSON.stringify(focus ?? [])])).map((x) => x.security_id);
        r = await ownershipStep(db, sids, new Date(), 50, new URL(req.url).searchParams.get("restart") === "1");
      }
      else if (name === "pledge_declared") {
        const sids = (await mk.all<{ security_id: number }>("SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1))", [JSON.stringify(focus ?? [])])).map((x) => x.security_id);
        r = await pledgeDeclaredPass(db, (k) => getText(env.RAW, k), sids, new Date(), 25, new URL(req.url).searchParams.get("restart") === "1");
      }
      else if (name === "event_features") {
        const sids = (await mk.all<{ security_id: number }>("SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1))", [JSON.stringify(focus ?? [])])).map((x) => x.security_id);
        r = await eventStep(db, mk, sids, new Date(), 50, new URL(req.url).searchParams.get("restart") === "1");
      }
      else if (name === "groups") { const g = await groupInputs(db, mk, focus ?? []); r = { ...(await storeGroups(db, g.rows, g.sym, g.names, new Date())), done: true }; }
      else if (name === "shp_promoter") {
        const sids = (await mk.all<{ security_id: number }>("SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1))", [JSON.stringify(focus ?? [])])).map((x) => x.security_id);
        r = await shpPromoterPass(db, ldeps.getText, sids, new Date(), 25, new URL(req.url).searchParams.get("restart") === "1");
      }
      else if (name === "segments") { const u = new URL(req.url); r = await segmentPass(ldeps, { dry: u.searchParams.get("dry") === "1", companies: u.searchParams.has("companies") ? Number(u.searchParams.get("companies")) : undefined }, 30, 20_000); }
      // item 7 (owner #363): credit ratings re-read with the issuer match; missing ones added, stored ones get their symbol
      else if (name === "ratings_relink") r = await ratingsRelink(db, ldeps.getText, focus ?? [], await focusIssuers(mk, focus ?? []), 12);
      else if (name === "bank_ins_cf") r = await bankInsurerCashFlows(ldeps, 40, 20_000); // item 5: bank / insurer cash-flow detail
      else if (name === "ins_bs") r = await insurerBalanceSheets(ldeps, 40, 20_000); // item 5: insurers' IRDAI balance sheet
      // second run after general insurers got their own groups (B-BS); life rows already stored are left as they are
      else if (name === "ins_bs_gi") r = await insurerBalanceSheets(ldeps, 40, 20_000, "ins_bs_gi");
      // G3 follow-up: the new insurer results lines (filed ratios, NPAs, life shareholders' investment income), stored files
      else if (name === "ins_rev") r = await insurerResultsLines(ldeps, 25, 20_000);
      else if (name === "features") r = await buildFeatures(ldeps, 25, new URL(req.url).searchParams.get("restart") === "1"); // D171 feature table
      else if (name === "valuations") {
        // D171: today's valuations again (e.g. after a fix); ?restart=1 resets today's cursor first, then 50 per call
        if (new URL(req.url).searchParams.get("restart") === "1") await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','valuations',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify({ day: "", after: 0, done: false })]);
        const sids = new Set((await mk.all<{ security_id: number }>("SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?))", [JSON.stringify(focus ?? [])])).map((x) => x.security_id));
        r = await valuationsStep(ldeps, sids, 50);
      }
      else if (name === "version_backfill") {
        // focus companies only (owner #343), company by company over ix_filing_sec (was: a GROUP BY over all of filing per call)
        const sids = (await mk.all<{ security_id: number }>("SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?))", [JSON.stringify(focus ?? [])])).map((x) => x.security_id);
        r = await versionBackfillFocus(db, sids, 25); // gate (#343): first call read 30k rows (28.6k of them the focus lookup, fixed), wrote 7
      }
      else if (name === "coverage_classify") r = await classifyGaps(db, mk, (k) => getText(env.RAW, k), 10); // work list item 2
      else if (name === "half_year_gaps") {
        // D169 (work list item 2): quarter (+ full year at the year end) of the half-year-only files behind the active
        // "under another period or basis" gaps, then the coverage check of those companies only (clears filled gaps)
        const h = await halfYearGaps(ldeps);
        const basis = h.sids.length ? await runPrimaryBasis(db, h.sids, new Date(), basisLists(db, mk, (k) => getText(env.RAW, k))) : 0;
        r = { ...h, basis_companies: basis };
      }
      else if (name === "misattributed") {
        // C61 (work list item 2): filings stored under another company than the focus company whose list linked them;
        // ?fix=1 moves them (and their rows) to the linking company, then re-runs that company's coverage check
        const m = await misattributed(ldeps, new URL(req.url).searchParams.get("fix") === "1");
        const basis = m.sids.length ? await runPrimaryBasis(db, m.sids, new Date(), basisLists(db, mk, (k) => getText(env.RAW, k))) : 0;
        r = { ...m, basis_companies: basis };
      }
      else if (name === "requeue_404") r = await requeue404(ldeps, (new URL(req.url).searchParams.get("jobs") ?? "").split(",").map(Number));
      else if (name === "reload") r = await reloadJobs(ldeps, (new URL(req.url).searchParams.get("jobs") ?? "").split(",").map(Number));
      else if (name === "remark_backfill") r = await remarkBackfill(db, (k) => getText(env.RAW, k), 200, focus); // lists outside the focus are skipped without an R2 read
      else return new Response("unknown pass", { status: 404 });
      const now = new Date();
      if (meter.rows > 0) await env.DB_MARKET.prepare("INSERT INTO write_budget (day, rows) VALUES (?1, ?2) ON CONFLICT (day) DO UPDATE SET rows = rows + excluded.rows").bind(istDay(now), meter.rows).run();
      await chargeReads(d1Sql(env.DB_MARKET), now, meter.reads ?? 0);
      return Response.json({ cost: { rows_read: meter.reads ?? 0, rows_written: meter.rows }, ...((r ?? { done: true }) as object) }, { headers: { "cache-control": "no-store" } });
    }
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
      // Read-only (owner #334): every row of the stored NSE results lists for one company (period, basis, submission
      // type, revision remarks, dates, XBRL link) — to see whether a revised/restated filing exists for a period.
      const q = new URL(req.url).searchParams, sym = q.get("symbol") ?? "";
      // optional filters (the full answer passes the 20 kB ops print limit): ?kind=integrated_financials, ?since=2026
      // keeps rows that carry a date in that year or later
      const onlyKind = q.get("kind"), since = Number(q.get("since") ?? 0);
      const lists = (await env.DB_FILINGS.prepare("SELECT job_id, kind, url, r2_key, fetched_at FROM fetch_job WHERE symbol=?1 AND kind IN ('integrated_financials','results_quarterly','results_annual') AND status='done' ORDER BY job_id").bind(sym).all<{ job_id: number; kind: string; url: string; r2_key: string; fetched_at: string }>()).results
        .filter((l) => !onlyKind || l.kind === onlyKind);
      const rows: Record<string, unknown>[] = [];
      for (const l of lists) {
        const text = await getText(env.RAW, l.r2_key);
        if (!text) continue;
        let o: unknown; try { o = JSON.parse(text); } catch { continue; }
        const arr = (Array.isArray(o) ? o : ((o as Record<string, unknown>).data ?? [])) as Record<string, unknown>[];
        for (const r of arr) {
          const pick: Record<string, unknown> = { list: l.kind, list_fetched: l.fetched_at?.slice(0, 10) };
          for (const [k, v] of Object.entries(r)) if (v !== null && v !== "" && /period|qe_?date|todate|fromdate|audited|consol|cumulative|type|revis|remark|broadcast|filingdate|xbrl|date|nature|seq|relating/i.test(k)) pick[k] = typeof v === "string" ? v.slice(0, 140) : v;
          if (since && !Object.values(pick).some((v) => typeof v === "string" && [...v.matchAll(/\b(20\d\d)\b/g)].some((m) => Number(m[1]) >= since))) continue;
          rows.push(pick);
        }
      }
      return Response.json({ lists: lists.length, rows }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/contexts") {
      // Read-only (owner #334): every context of one stored XBRL file — id, dates, dimensions, number of facts, sample tags.
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
        // (the case-insensitive "din" also matched "Subordinated" and "Outstanding", hiding balance-sheet lines; the
        // codes are matched case-sensitively as tags spell them, the words case-insensitively)
        const masked = (t: string) => /Identification|PermanentAccountNumber|Address|Email|Phone|Contact|Mobile/i.test(t) || /PAN|Pan[A-Z]|DIN|Din(?![a-z])|CIN/.test(t.split(":").pop() ?? t);
        return Response.json(inst.facts.filter((f) => f.contextRef === one).map((f) => ({ tag: f.tag, value: masked(f.tag) ? "(masked)" : f.value?.slice(0, 200) ?? null, unit: f.unitRef, decimals: f.decimals })), { headers: { "cache-control": "no-store" } });
      }
      return Response.json({ facts: inst.facts.length, contexts: ctx.filter((c) => c.facts > 0).sort((a, b) => b.facts - a.facts), undefined_refs: undefinedRefs }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/gap-detail") {
      // Work list item 2 (read-only): every active gap (from the D168 floor) of the given companies with its NSE-listed
      // files (ledger row, load outcome, R2 key) and the P&L periods actually stored — to fix gaps by class.
      const syms = (new URL(req.url).searchParams.get("symbols") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12);
      const out: Record<string, unknown> = {};
      for (const sym of syms) {
        const ids = (await env.DB_MARKET.prepare("SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1").bind(sym).all<{ security_id: number }>()).results;
        const sid = ids[0]?.security_id;
        if (!sid) { out[sym] = "unknown symbol"; continue; }
        const allSyms = (await env.DB_MARKET.prepare("SELECT DISTINCT value FROM security_identifier WHERE security_id=?1 AND id_type='nse_symbol'").bind(sid).all<{ value: string }>()).results.map((r) => r.value);
        const keys = (await env.DB_FILINGS.prepare(SQL_BASIS_LISTS).bind(JSON.stringify(allSyms)).all<{ r2_key: string }>()).results;
        const listed = nseListedFiles((await Promise.all(keys.map((k) => getText(env.RAW, k.r2_key)))).filter((t): t is string => !!t));
        const gaps = (await env.DB_FILINGS.prepare("SELECT period_end, basis, status FROM coverage_gap WHERE security_id=?1 AND period_end >= '2024-01-01' ORDER BY period_end").bind(sid).all<{ period_end: string; basis: string; status: string | null }>()).results;
        const detail = [];
        for (const g of gaps) {
          const files = [];
          for (const url of listed.get(`${g.period_end}|${g.basis}`) ?? []) {
            const job = await env.DB_FILINGS.prepare("SELECT job_id, kind, status, http_status, attempts, r2_key FROM fetch_job WHERE url=?1").bind(url).first<Record<string, unknown>>();
            const load = job ? await env.DB_FILINGS.prepare("SELECT status, detail, tries, retry_after FROM fin_load WHERE job_id=?1").bind(job.job_id).first<Record<string, unknown>>() : null;
            // where the file was actually stored (filing(source_url) index, one row): security, period and basis
            const stored = job ? await env.DB_FILINGS.prepare("SELECT filing_id, security_id, period_end, period_kind, basis, disclosed_at FROM filing WHERE kind=?1 AND source_url=?2").bind(String(job.kind).replace(/^xbrl_/, ""), url).first<Record<string, unknown>>() : null;
            files.push({ url: url.replace("https://nsearchives.nseindia.com/corporate/", ""), job, load, filing: stored });
          }
          detail.push({ ...g, files });
        }
        const stored = (await env.DB_FILINGS.prepare("SELECT period_end, period_kind, basis, version, count(*) AS lines, min(disclosed_at) AS first_at FROM fin_value WHERE security_id=?1 AND statement='pl' AND period_end >= '2024-01-01' GROUP BY 1, 2, 3, 4 ORDER BY 1, 3, 2").bind(sid).all()).results;
        out[sym] = { security_id: sid, symbols: allSyms, gaps: detail, stored_pl: stored };
      }
      return Response.json(out, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/pledge-census") {
      // log #385 defect 2 (read-only): pledge / encumbrance facts in the focus companies' latest shareholding files
      const u = new URL(req.url), offset = Math.max(0, Number(u.searchParams.get("offset") ?? 0)), limit = Math.min(60, Math.max(1, Number(u.searchParams.get("limit") ?? 50)));
      const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES);
      const sids = [...new Set((await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(focus ?? [])).all<{ security_id: number }>()).results.map((r) => r.security_id))].sort((a, b) => a - b);
      return Response.json({ total: sids.length, offset, ...(await pledgeCensus(d1Sql(env.DB_FILINGS), (k) => getText(env.RAW, k), sids.slice(offset, offset + limit))) }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/link-audit") {
      // owner #388 (read-only): rows in symbol-keyed tables whose symbol links to no company
      const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES);
      return Response.json(await linkAudit(d1Sql(env.DB_FILINGS), d1Sql(env.DB_MARKET), focus ?? []), { headers: { "cache-control": "no-store" } });
    }
    if (path === "/gap-census") {
      // log #385/#386 (read-only): what is stored where owners' profit, NCI or promoter holding is missing
      const u = new URL(req.url), period = u.searchParams.get("period") ?? "2026-09-30", offset = Math.max(0, Number(u.searchParams.get("offset") ?? 0)), limit = Math.min(125, Math.max(1, Number(u.searchParams.get("limit") ?? 125)));
      const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES);
      const ids = (await env.DB_MARKET.prepare("SELECT security_id, min(value) AS symbol FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1)) GROUP BY security_id ORDER BY security_id").bind(JSON.stringify(focus ?? [])).all<{ security_id: number; symbol: string }>()).results;
      return Response.json(await gapCensus(d1Sql(env.DB_FILINGS), ids.slice(offset, offset + limit).map((r) => ({ sid: r.security_id, symbol: r.symbol })), period), { headers: { "cache-control": "no-store" } });
    }
    if (path === "/readiness-fields") {
      // owner #384 (read-only): every computed field across the 250 — with a value, latest period with a value, top reasons
      const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES);
      const sids = [...new Set((await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(focus ?? [])).all<{ security_id: number }>()).results.map((r) => r.security_id))];
      return Response.json(await fieldReadiness(d1Sql(env.DB_FILINGS), d1Sql(env.DB_MARKET), sids), { headers: { "cache-control": "no-store" } });
    }
    if (path === "/readiness") {
      // D123 / D152 data-readiness map (read-only): companies of the 250 with each data area from the D168 floor, and
      // per feature-table field how many have a value. One indexed probe per company and area.
      const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES);
      const ids = (await env.DB_MARKET.prepare("SELECT security_id, value FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1)) ORDER BY security_id").bind(JSON.stringify(focus ?? [])).all<{ security_id: number; value: string }>()).results;
      const bySid = new Map<number, string[]>();
      for (const r of ids) (bySid.get(r.security_id) ?? bySid.set(r.security_id, []).get(r.security_id)!).push(r.value);
      // ≤ 60 companies per call (≈ 12 probes each, under the per-request query limit); feature table on the first page
      const u = new URL(req.url), offset = Math.max(0, Number(u.searchParams.get("offset") ?? 0)), limit = Math.min(60, Math.max(1, Number(u.searchParams.get("limit") ?? 60)));
      const all = [...bySid].map(([sid, symbols]) => ({ sid, symbols }));
      return Response.json({ companies_total: all.length, offset, ...(await readiness(d1Sql(env.DB_FILINGS), all.slice(offset, offset + limit), COVERAGE_FLOOR, offset === 0)) }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/ratings-coverage") {
      // Work list 2.10 (item 7, read-only): credit ratings of the focus companies from the D168 floor vs NSE's stored
      // lists, by month (lists listed / loaded / stored-but-not-listed), with the first 40 missing.
      const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES);
      const issuers = await focusIssuers(d1Sql(env.DB_MARKET), focus ?? []);
      return Response.json({ issuers: issuers.issuer.size, names: issuers.names.size, ...(await ratingCoverage(d1Sql(env.DB_FILINGS), (k) => getText(env.RAW, k), focus ?? [], COVERAGE_FLOOR, issuers)) }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/shp-coverage") {
      // Work list 2.8 (read-only): shareholding filings NSE lists for the focus companies (from the D168 floor) vs those
      // loaded, with the reason for each one missing. ?offset=&limit= (≤ 60 companies per call: one list query, the
      // stored lists and one file query per company).
      const u = new URL(req.url), offset = Math.max(0, Number(u.searchParams.get("offset") ?? 0)), limit = Math.min(60, Math.max(1, Number(u.searchParams.get("limit") ?? 50)));
      const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES);
      const ids = (await env.DB_MARKET.prepare("SELECT security_id, value FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1)) ORDER BY security_id").bind(JSON.stringify(focus ?? [])).all<{ security_id: number; value: string }>()).results;
      const bySid = new Map<number, string[]>();
      for (const r of ids) (bySid.get(r.security_id) ?? bySid.set(r.security_id, []).get(r.security_id)!).push(r.value);
      const all = [...bySid].map(([sid, symbols]) => ({ sid, symbols }));
      const res = await shpCoverage(d1Sql(env.DB_FILINGS), (k) => getText(env.RAW, k), all.slice(offset, offset + limit), COVERAGE_FLOOR);
      const t = res.companies.reduce((a, c) => ({ listed: a.listed + c.listed, loaded: a.loaded + c.loaded }), { listed: 0, loaded: 0 });
      return Response.json({ companies_total: all.length, offset, limit, totals: t, list_row_keys: res.keys, none_listed: res.companies.filter((c) => !c.listed).map((c) => c.symbol), with_missing: res.companies.filter((c) => c.missing.length) }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/statement") {
      // D157 (read-only check of the layout): one company's stored statements for one period laid out in the Schedule III
      // tree (filed values only; derived rows labelled, never stored). ?symbol=&period=YYYY-MM-DD&basis=&kind=Q|FY
      const u = new URL(req.url), sym = u.searchParams.get("symbol") ?? "", period = u.searchParams.get("period") ?? "";
      const basis = u.searchParams.get("basis") === "standalone" ? "standalone" : "consolidated", kind = u.searchParams.get("kind") === "FY" ? "FY" : "Q";
      const sid = (await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1 LIMIT 1").bind(sym).first<{ security_id: number }>())?.security_id;
      if (!sid || !/^\d{4}-\d{2}-\d{2}$/.test(period)) return Response.json({ error: "symbol or period" }, { status: 400 });
      const rows = (await env.DB_FILINGS.prepare(SQL_STATEMENT_ROWS).bind(sid, period, basis, kind).all<{ statement: string; line: string; value: string | null; period_kind: string; template: string }>()).results;
      // One period length per statement, and say which: a quarter's cash flow is filed only year to date (six months at
      // Sep, nine at Dec), so it must never be shown as the quarter's. Prefer the asked kind, then the longest filed.
      const order = [kind, "FY", "9M", "H", "Q"];
      const pick = (st: string) => {
        const mine = rows.filter((r) => r.statement === st);
        const k = order.find((o) => mine.some((r) => r.period_kind === o)) ?? null;
        return { kind: k, values: Object.fromEntries(mine.filter((r) => r.period_kind === k).map((r) => [r.line, r.value])) };
      };
      const months: Record<string, string> = { Q: "3 months", H: "6 months", "9M": "9 months", FY: "12 months" };
      const pl = pick("pl"), bs = pick("bs"), cf = pick("cf");
      const span = (k: string | null, flow: boolean) => (k === null ? null : flow ? `${months[k] ?? k} to ${period}` : `as at ${period}`);
      // Stored lines the layout has no place for are listed, never silently dropped (completeness check per template).
      const placed = (rs: { key: string }[]) => new Set(rs.map((r) => r.key));
      const lay = chooseLayout(rows.find((r) => r.statement === "pl")?.template ?? rows[0]?.template ?? null, pl.values);
      const plRows = [...layoutStatement(lay.pl, pl.values), ...derivedPl(pl.values, lay.name)];
      const bsRows = layoutStatement(lay.bs, bs.values, { hideZeros: true });
      // line-by-line cash flow where it was loaded (x: tags), else the named totals every template stores
      const cfRows = withAdjustmentGap(layoutStatement(Object.keys(cf.values).some((k) => k.startsWith("x:")) ? CF_INDUSTRIAL : CF_SUMMARY, cf.values, { hideZeros: true }), cf.values);
      // where the line-by-line detail (x: tags) is stored, the named summary lines duplicate it and are not listed
      const left = (vals: Record<string, string | null>, rs: { key: string }[]) => { const p = placed(rs), detail = Object.keys(vals).some((k) => k.startsWith("x:")); return Object.fromEntries(Object.entries(vals).filter(([k, v]) => !p.has(k) && (!detail || k.startsWith("x:")) && v !== null && !/^-?0*(\.0*)?$/.test(v))); };
      return Response.json({ symbol: sym, period, basis, kind, stored_template: [...new Set(rows.map((r) => r.template))], layout: lay.label,
        not_in_layout: { pl: left(pl.values, plRows), bs: left(bs.values, bsRows), cf: left(cf.values, cfRows) },
        periods: { pl: span(pl.kind, true), bs: span(bs.kind, false), cf: span(cf.kind, true) },
        pl: plRows, bs: bsRows, cf: cfRows }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/fy-gaps") {
      // 2.12 (read-only): full years from the floor with a stored Q4 quarter but no stored full year, per company of the
      // 250 and basis, with the load outcome of the files of that period end (why the full year is missing).
      const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES);
      const ids = (await env.DB_MARKET.prepare("SELECT security_id, min(value) AS symbol FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1)) GROUP BY security_id").bind(JSON.stringify(focus ?? [])).all<{ security_id: number; symbol: string }>()).results;
      const sym = new Map(ids.map((r) => [r.security_id, r.symbol]));
      const rows = (await env.DB_FILINGS.prepare(SQL_REVENUE_KINDS).bind(JSON.stringify([...sym.keys()]), COVERAGE_FLOOR).all<{ security_id: number; period_end: string; period_kind: string; basis: string }>()).results;
      const key = (r: { security_id: number; basis: string }) => `${r.security_id}|${r.basis}`;
      const fyEnds = new Map<string, Set<string>>(), qEnds = new Map<string, Set<string>>();
      for (const r of rows) { const m = r.period_kind === "FY" ? fyEnds : qEnds; (m.get(key(r)) ?? m.set(key(r), new Set()).get(key(r))!).add(r.period_end); }
      const missing: { symbol: string; sid: number; basis: string; fy_end: string }[] = [];
      for (const [k, qs] of qEnds) {
        const [sid, basis] = k.split("|"); const fys = fyEnds.get(k) ?? new Set<string>();
        // the company's year-end month: from its stored full years, else March
        const months = [...fys].map((d) => d.slice(5)); const mm = months.sort((a, b) => months.filter((x) => x === b).length - months.filter((x) => x === a).length)[0] ?? "03-31";
        for (const q of qs) if (q.slice(5) === mm && !fys.has(q)) missing.push({ symbol: sym.get(Number(sid)) ?? sid!, sid: Number(sid), basis: basis!, fy_end: q });
      }
      missing.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.fy_end.localeCompare(b.fy_end));
      const detail = [];
      for (const m of missing.slice(0, 40)) detail.push({ ...m, loads: (await env.DB_FILINGS.prepare(SQL_PERIOD_LOADS).bind(m.sid, m.fy_end, m.basis).all()).results });
      return Response.json({ floor: COVERAGE_FLOOR, companies: sym.size, company_bases: qEnds.size, full_years_stored: rows.filter((r) => r.period_kind === "FY").length, missing: missing.length, detail }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/insider-2026") {
      // Owner #365 (read-only): 2026 insider trades and credit ratings for each of the 250, with the state of each
      // company's 2026 PIT list downloads, so "no rows" can be told apart from "not downloaded yet".
      const from = new URL(req.url).searchParams.get("from") ?? "2026-01-01", fromN = Number(from.replace(/-/g, ""));
      const focus = (await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES)) ?? [];
      const list = JSON.stringify(focus);
      const dated = new Map((await env.DB_FILINGS.prepare(SQL_INSIDER_SINCE).bind(list, fromN).all<{ symbol: string; trades: number; new_system: number; first_d: number; last_d: number }>()).results.map((r) => [r.symbol, r]));
      const undated = new Map((await env.DB_FILINGS.prepare(SQL_INSIDER_UNDATED).bind(list, from).all<{ symbol: string; trades: number }>()).results.map((r) => [r.symbol, r.trades]));
      const ratings = new Map((await env.DB_FILINGS.prepare(SQL_RATINGS_SINCE).bind(list, fromN).all<{ symbol: string; ratings: number }>()).results.map((r) => [r.symbol, r.ratings]));
      const jobs = (await env.DB_FILINGS.prepare(SQL_PIT_JOBS).all<{ symbol: string | null; r2_key: string; status: string; http_status: number | null }>()).results;
      const byStatus: Record<string, number> = {}, win = new Map<string, Record<string, number>>();
      for (const j of jobs) {
        byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
        const m = /\/(\d{4}-\d{2}-\d{2})_\d{4}-\d{2}-\d{2}\.json$/.exec(j.r2_key);
        if (j.symbol && m && m[1]! >= from.slice(0, 4)) { const w = win.get(j.symbol) ?? win.set(j.symbol, {}).get(j.symbol)!; w[j.status] = (w[j.status] ?? 0) + 1; }
      }
      const rows = focus.map((s) => ({ symbol: s, trades: (dated.get(s)?.trades ?? 0) + (undated.get(s) ?? 0), new_system: dated.get(s)?.new_system ?? 0, first_d: dated.get(s)?.first_d ?? null, last_d: dated.get(s)?.last_d ?? null, ratings: ratings.get(s) ?? 0, windows: win.get(s) ?? {} }));
      const pending = (r: (typeof rows)[number]) => Object.entries(r.windows).some(([k, n]) => k !== "done" && n > 0);
      return Response.json({
        from, companies: focus.length, pit_jobs: byStatus,
        with_trades: rows.filter((r) => r.trades > 0).length,
        with_new_system: rows.filter((r) => r.new_system > 0).length,
        with_ratings: rows.filter((r) => r.ratings > 0).length,
        no_trades: rows.filter((r) => r.trades === 0).map((r) => ({ symbol: r.symbol, ratings: r.ratings, windows: r.windows, downloads_pending: pending(r) })),
        no_ratings: rows.filter((r) => r.ratings === 0).map((r) => r.symbol),
        old_list_only: rows.filter((r) => r.trades > 0 && r.new_system === 0).map((r) => r.symbol),
        downloads_pending: rows.filter(pending).length,
        by_year: (await env.DB_FILINGS.prepare(SQL_INSIDER_YEARS).bind(list).all()).results,
        new_system_all: (await env.DB_FILINGS.prepare(SQL_PITX_SYMBOLS).all()).results[0],
      }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/ownership") {
      // §11 (read-only): one company's stored ownership and pledge fields and its promoter group
      const sym = new URL(req.url).searchParams.get("symbol") ?? "";
      const sid = (await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1 LIMIT 1").bind(sym).first<{ security_id: number }>())?.security_id;
      if (!sid) return Response.json({ error: "symbol" }, { status: 400 });
      const rows = (await env.DB_FILINGS.prepare("SELECT field, value, reason, as_of FROM ownership_feature WHERE security_id=?1 ORDER BY field").bind(sid).all()).results;
      const group = await env.DB_FILINGS.prepare("SELECT group_name, members FROM company_group WHERE security_id=?1").bind(sid).first();
      return Response.json({ symbol: sym, group, rows }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/event-features") {
      // §12/§13 (read-only): one company's results timing, filing timeliness and credit-rating fields
      const sym = new URL(req.url).searchParams.get("symbol") ?? "";
      const sid = (await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1 LIMIT 1").bind(sym).first<{ security_id: number }>())?.security_id;
      if (!sid) return Response.json({ error: "symbol" }, { status: 400 });
      const rows = (await env.DB_FILINGS.prepare("SELECT field, value, reason, as_of FROM event_feature WHERE security_id=?1 ORDER BY field").bind(sid).all()).results;
      return Response.json({ symbol: sym, rows }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/promoter-groups") {
      // D40 (read-only): companies of the 250 that name the same promoter entity in their latest shareholding filing.
      const focus = await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES);
      const ids = (await env.DB_MARKET.prepare("SELECT security_id, min(value) AS symbol FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?1)) GROUP BY security_id").bind(JSON.stringify(focus ?? [])).all<{ security_id: number; symbol: string }>()).results;
      const sym = new Map(ids.map((r) => [r.security_id, r.symbol]));
      const rows = (await env.DB_FILINGS.prepare(SQL_PROMOTER_HOLDERS).bind(JSON.stringify([...sym.keys()])).all<{ security_id: number; category: string; holder_name: string; pct: string | null; promoter: number | null }>()).results;
      const names = new Map((await env.DB_MARKET.prepare("SELECT security_id, name FROM security WHERE security_id IN (SELECT value FROM json_each(?1))").bind(JSON.stringify([...sym.keys()])).all<{ security_id: number; name: string }>()).results.map((r) => [r.security_id, r.name]));
      const cats: Record<string, number> = {};
      for (const r of rows) cats[r.category] = (cats[r.category] ?? 0) + 1;
      const groups = promoterGroups(rows, sym, names);
      const inGroup = new Set(groups.flatMap((g) => g.companies));
      const withPromoterEntity = new Set(rows.filter((r) => r.promoter === 1).map((r) => r.security_id));
      const flagged = new Set(rows.filter((r) => r.promoter != null).map((r) => r.security_id));
      return Response.json({ companies: sym.size, holder_rows: rows.length, holder_categories: cats, companies_with_named_promoters: withPromoterEntity.size, companies_flag_read: flagged.size,
        groups: groups.length, companies_in_groups: inGroup.size, list: groups }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/announce-pit") {
      // Option 3 (read-only): insider-trading disclosures the 250 filed as announcements, from stored lists (R2), one
      // month of lists per call (?month=2026-01), against the companies with no 2026 insider trades stored.
      const u = new URL(req.url), month = u.searchParams.get("month") ?? "2026-01";
      const focus = new Set((await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES)) ?? []);
      const monthly = (await env.DB_FILINGS.prepare(SQL_ANNOUNCE_LISTS).bind("announcements", `api/announcements/${month}/`, `api/announcements/${month}/~`).all<{ job_id: number; r2_key: string }>()).results;
      const counts = new Map<string, number>(), descs = new Map<string, number>();
      let rows = 0, files = 0;
      for (const j of monthly.slice(-1)) { // the latest copy of the month's list
        const t = await getText(env.RAW, j.r2_key); if (!t) continue; files++;
        let d: unknown; try { d = JSON.parse(t); } catch { continue; }
        const list = (Array.isArray(d) ? d : ((d as { data?: unknown[] }).data ?? [])) as Record<string, unknown>[];
        for (const r of list) {
          rows++;
          const sym = String(r.symbol ?? ""), desc = String(r.desc ?? ""), text = String(r.attchmntText ?? "");
          if (!focus.has(sym) || !isPitAnnouncement(desc, text)) continue;
          counts.set(sym, (counts.get(sym) ?? 0) + 1); descs.set(desc, (descs.get(desc) ?? 0) + 1);
        }
      }
      const fromN = Number(`${month.replace("-", "")}01`);
      const traded = new Set((await env.DB_FILINGS.prepare(SQL_INSIDER_SINCE).bind(JSON.stringify([...focus]), fromN).all<{ symbol: string }>()).results.map((r) => r.symbol));
      const noTrades = [...focus].filter((s) => !traded.has(s));
      return Response.json({ month, lists: monthly.length, files_read: files, rows, focus_companies_with_pit_announcements: counts.size,
        of_those_without_stored_trades: noTrades.filter((s) => counts.has(s)).length, without_stored_trades: noTrades.length,
        subjects: [...descs].sort((a, b) => b[1] - a[1]).slice(0, 15), sample: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 25) }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/segments") {
      // D47 live check (read-only): one company's stored segment results for one period end, per period kind, with the
      // sums of segment revenue and result (each period loaded only when these matched the filed totals) next to the
      // stored P&L revenue (which can differ by inter-segment eliminations). ?symbol= or ?sid=, &period=, &basis=
      const u = new URL(req.url), basis = u.searchParams.get("basis") === "standalone" ? "standalone" : "consolidated";
      let sym = u.searchParams.get("symbol") ?? "", sid = Number(u.searchParams.get("sid") ?? 0) || undefined;
      if (!sid) sid = (await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1 LIMIT 1").bind(sym).first<{ security_id: number }>())?.security_id;
      else sym = (await env.DB_MARKET.prepare("SELECT value FROM security_identifier WHERE id_type='nse_symbol' AND security_id=?1 LIMIT 1").bind(sid).first<{ value: string }>())?.value ?? "";
      if (!sid) return Response.json({ error: "symbol" }, { status: 400 });
      const periods = (await env.DB_FILINGS.prepare(SQL_SEGMENT_PERIODS).bind(sid).all<{ period_end: string; basis: string }>()).results;
      const period = u.searchParams.get("period") ?? periods.find((p) => p.basis === basis)?.period_end ?? "";
      const rows = /^\d{4}-\d{2}-\d{2}$/.test(period) ? (await env.DB_FILINGS.prepare(SQL_SEGMENT_ROWS).bind(sid, period, basis).all<{ line: string; dims: string; source_tag: string; value: string; period_kind: string; filing_id: number }>()).results : [];
      const pl = /^\d{4}-\d{2}-\d{2}$/.test(period) ? (await env.DB_FILINGS.prepare(SQL_STATEMENT_ROWS).bind(sid, period, basis, "Q").all<{ statement: string; line: string; value: string | null; period_kind: string }>()).results.filter((r) => r.statement === "pl" && r.line === "revenue") : [];
      const kinds = [...new Set(rows.map((r) => r.period_kind))].map((k) => {
        const mine = rows.filter((r) => r.period_kind === k), segs = new Map<string, Record<string, string>>();
        for (const r of mine) (segs.get(r.dims) ?? segs.set(r.dims, { name: r.source_tag }).get(r.dims)!)[r.line.replace("segment_", "")] = r.value;
        const sum = (f: string) => [...segs.values()].reduce((a, s) => a + (s[f] ? Number(s[f]) : 0), 0) / 1e7;
        return { kind: k, filing_ids: [...new Set(mine.map((r) => r.filing_id))], segments: [...segs.entries()].map(([key, v]) => ({ key, ...v })),
          sums_cr: { revenue: sum("revenue"), result: sum("result"), assets: sum("assets"), liabilities: sum("liabilities") },
          pl_revenue_cr: pl.filter((r) => r.period_kind === k).map((r) => Number(r.value) / 1e7)[0] ?? null };
      });
      return Response.json({ symbol: sym, sid, period, basis, periods_stored: periods, kinds }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/features") {
      // D171 (read-only): one company's stored feature-table values (computed from filed figures, with their inputs)
      const u = new URL(req.url), sym = u.searchParams.get("symbol") ?? "", field = u.searchParams.get("field");
      const sid = (await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1 LIMIT 1").bind(sym).first<{ security_id: number }>())?.security_id;
      if (!sid) return Response.json({ error: "symbol" }, { status: 400 });
      const rows = (await env.DB_FILINGS.prepare(SQL_FEATURES_OF).bind(sid, field ?? "").all()).results;
      return Response.json({ symbol: sym, rows }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/coverage-gaps") {
      // Work list item 2: coverage gaps of the focus companies by class (coverage_gap.status, set by /maint/coverage_classify)
      const q = async (sql: string) => (await env.DB_FILINGS.prepare(sql).all()).results as Record<string, unknown>[];
      // D168: only quarters from 2024-01-01 are active gaps; older rows are reported as one out-of-scope count
      const classes = await q("SELECT coalesce(status, '(not classified yet)') AS class, count(*) AS gaps, count(DISTINCT security_id) AS companies FROM coverage_gap WHERE period_end >= '2024-01-01' GROUP BY 1 ORDER BY 2 DESC");
      const outOfScope = (await q("SELECT count(*) AS gaps, count(DISTINCT security_id) AS companies FROM coverage_gap WHERE period_end < '2024-01-01'"))[0];
      const active = (await q("SELECT count(*) AS gaps, count(DISTINCT security_id) AS companies FROM coverage_gap WHERE period_end >= '2024-01-01'"))[0];
      const sample = await q("SELECT coalesce(status, '(not classified yet)') AS class, security_id, period_end, basis FROM coverage_gap WHERE period_end >= '2024-01-01' ORDER BY status, security_id, period_end LIMIT 400");
      const ids = [...new Set(sample.map((r) => Number(r.security_id)))];
      const sym = new Map(((await env.DB_MARKET.prepare("SELECT security_id, min(value) AS symbol FROM security_identifier WHERE id_type='nse_symbol' AND security_id IN (SELECT value FROM json_each(?1)) GROUP BY security_id").bind(JSON.stringify(ids)).all<{ security_id: number; symbol: string }>()).results).map((x) => [x.security_id, x.symbol]));
      const byClass: Record<string, string[]> = {};
      for (const r of sample) (byClass[String(r.class)] ??= []).push(`${sym.get(Number(r.security_id)) ?? r.security_id} ${r.period_end} ${r.basis}`);
      return Response.json({ floor: "2024-01-01", active, out_of_scope_before_floor: outOfScope, classes, gaps: byClass }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/primary-basis") {
      // Read-only (D50/D51): primary basis per focus company, with the reason, and basis-switch breaks.
      const q = async (sql: string) => (await env.DB_FILINGS.prepare(sql).all()).results;
      const rows = await q("SELECT security_id, basis, reason, cons_q, sa_q, sa_share FROM primary_basis ORDER BY basis, security_id");
      const ids = rows.map((r) => Number((r as { security_id: number }).security_id));
      const syms = ids.length ? (await env.DB_MARKET.prepare("SELECT security_id, min(value) AS symbol FROM security_identifier WHERE id_type='nse_symbol' AND security_id IN (SELECT value FROM json_each(?1)) GROUP BY security_id").bind(JSON.stringify(ids)).all<{ security_id: number; symbol: string }>()).results : [];
      const sym = new Map(syms.map((x) => [x.security_id, x.symbol]));
      return Response.json({
        counts: await q("SELECT basis, count(*) AS n FROM primary_basis GROUP BY basis"),
        companies: rows.map((r) => ({ symbol: sym.get(Number((r as { security_id: number }).security_id)), ...r })),
        breaks: (await q("SELECT security_id, period_end, change FROM basis_break ORDER BY security_id, period_end")).map((r) => ({ symbol: sym.get(Number((r as { security_id: number }).security_id)), ...r })),
        coverage_gaps: { total: (await q("SELECT count(*) AS n, count(DISTINCT security_id) AS companies FROM coverage_gap"))[0],
          sample: (await q("SELECT security_id, period_end, basis FROM coverage_gap ORDER BY period_end DESC LIMIT 40")).map((r) => ({ symbol: sym.get(Number((r as { security_id: number }).security_id)), ...r })) },
      }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/restatements") {
      // Read-only (owner #334): restatement flags — one company (?symbol=) or a summary of all.
      const sym = new URL(req.url).searchParams.get("symbol");
      if (!sym) return Response.json({
        by_statement: (await env.DB_FILINGS.prepare("SELECT statement, count(*) AS lines, count(DISTINCT security_id || period_end || basis) AS periods FROM restatement_flag GROUP BY statement").all()).results,
        progress: (await env.DB_FILINGS.prepare("SELECT slot, at, detail FROM daily_refresh WHERE day='once' AND (slot IN ('version_backfill','remark_backfill') OR slot LIKE 'error:%')").all()).results,
        revised_filings: (await env.DB_FILINGS.prepare("SELECT count(*) AS n, sum(revision_remark IS NOT NULL) AS with_remark FROM filing WHERE submission='Revision'").first()),
      }, { headers: { "cache-control": "no-store" } });
      const sid = (await env.DB_MARKET.prepare("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=?1 LIMIT 1").bind(sym).first<{ security_id: number }>())?.security_id;
      const rows = (await env.DB_FILINGS.prepare("SELECT statement, line, period_end, period_kind, basis, original_value, restated_value, change_pct, original_at, restated_at FROM restatement_flag WHERE security_id=?1 ORDER BY period_end DESC, basis, statement, abs(change_pct) DESC LIMIT 200").bind(sid ?? -1).all()).results;
      const revisions = (await env.DB_FILINGS.prepare("SELECT period_end, period_kind, basis, disclosed_at, submission, revision_remark FROM filing WHERE security_id=?1 AND (submission='Revision' OR revision_remark IS NOT NULL) ORDER BY period_end DESC").bind(sid ?? -1).all()).results;
      return Response.json({ flags: rows, revisions }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/py-check") {
      // Read-only (owner #334): balance-sheet restatements. Each stored results file of one company also carries the
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
    if (path === "/cf-detail-check") {
      // Read-only (item 5 follow-up): which company an internal id is, and why its cash-flow detail did not load — the
      // section checks of its latest stored results files (2024 on), re-read from storage. ?sid=&n= (files, ≤ 4)
      const q = new URL(req.url).searchParams, sid = Number(q.get("sid") ?? 0), n = Math.min(4, Number(q.get("n") ?? 2));
      const syms = (await env.DB_MARKET.prepare("SELECT DISTINCT value FROM security_identifier WHERE security_id=?1 AND id_type='nse_symbol'").bind(sid).all<{ value: string }>()).results.map((r) => r.value);
      // ?filings=a,b,… (≤ 6, this company's) picks the files; else its latest n
      const pick = (q.get("filings") ?? "").split(",").map(Number).filter((x) => x > 0).slice(0, 6);
      const fs = (await (pick.length
        ? env.DB_FILINGS.prepare("SELECT filing_id, kind, period_end, period_kind, basis, source_url FROM filing WHERE security_id=?1 AND filing_id IN (SELECT value FROM json_each(?2))").bind(sid, JSON.stringify(pick))
        : env.DB_FILINGS.prepare("SELECT filing_id, kind, period_end, period_kind, basis, source_url FROM filing INDEXED BY ix_filing_sec WHERE security_id=?1 AND period_end >= '2024-01-01' AND kind IN ('results_quarterly','results_annual','integrated_financials') ORDER BY period_end DESC LIMIT ?2").bind(sid, n))
        .all<{ filing_id: number; kind: string; period_end: string; period_kind: string; basis: string; source_url: string }>()).results;
      const files = [];
      for (const f of fs) {
        const xml = await getText(env.RAW, `att/${new URL(f.source_url).pathname.replace(/^\/corporate\//, "")}`).catch(() => null);
        if (!xml) { files.push({ ...f, read: "not stored" }); continue; }
        const inst = parseXbrl(xml);
        const cf = statementDetail(inst, null, inst.contexts.has("FourD") ? "FourD" : null).cf;
        files.push({ filing_id: f.filing_id, period_end: f.period_end, period_kind: f.period_kind, basis: f.basis, checks: cf?.checks ?? null,
          adjustments: cf ? Object.fromEntries(Object.entries(cf.lines).filter(([k]) => /^Adjustments|^OtherAdjustments|ProfitBeforeTax|CashFlowsFromUsedInOperations$/.test(k))) : null });
      }
      return Response.json({ sid, symbols: syms, files }, { headers: { "cache-control": "no-store" } });
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
      const pk = new URL(req.url).searchParams.get("kind") ?? "pit_gg_probe";
      const jobs = (await env.DB_FILINGS.prepare("SELECT job_id, url, r2_key, status, http_status, bytes FROM fetch_job WHERE kind=?1 AND kind LIKE '%probe' ORDER BY job_id").bind(pk).all<{ job_id: number; url: string; r2_key: string; status: string; http_status: number | null; bytes: number | null }>()).results;
      const out = [];
      for (const j of jobs) {
        const text = j.status === "done" ? await getText(env.RAW, j.r2_key) : null;
        let info: Record<string, unknown> = {};
        if (text && !/^\s*[[{]/.test(text)) {
          // CSV answer: line count, header and the dates column range
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          const dates = lines.slice(1).map((l) => /"?(\d{2}-[A-Za-z]{3}-\d{4})"?/.exec(l)?.[1]).filter(Boolean);
          info = { csv_rows: lines.length - 1, header: lines[0]?.slice(0, 200), first_date: dates[0] ?? null, last_date: dates[dates.length - 1] ?? null, distinct_dates: new Set(dates).size };
        } else if (text) try {
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
      const focusSet = new Set(sym === "ALL" ? (await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES)) ?? [] : []);
      const out = [];
      for (const j of jobs.slice(0, 20)) {
        const text = j.status === "done" ? await getText(env.RAW, j.r2_key) : null;
        let rows = null as number | null, min = null as string | null, max = null as string | null, err = null as string | null;
        let inFocus = null as number | null, top = null as [string, number][] | null;
        if (text) try {
          const r = parsePit(text); rows = r.length;
          const ds = r.map((t) => t.disclosedAt).filter((x): x is string => !!x).sort(); min = ds[0] ?? null; max = ds[ds.length - 1] ?? null;
          // all-company lists (6 Nov insider gap): how many rows are the 250's, and which symbols carry the most rows
          if (sym === "ALL") {
            const n = new Map<string, number>();
            for (const t of r) n.set(t.symbol!, (n.get(t.symbol!) ?? 0) + 1);
            inFocus = r.filter((t) => focusSet.has(t.symbol!)).length;
            top = [...n].filter(([k]) => focusSet.has(k)).sort((a, b) => b[1] - a[1]).slice(0, 8);
          }
        } catch (e) { err = String(e).slice(0, 80); }
        out.push({ job: j.job_id, url: j.url.replace(/^https:\/\/[^/]+\/api\//, ""), status: j.status, http: j.http_status, fetched_at: j.fetched_at, bytes: j.bytes, rows, disclosed_min: min, disclosed_max: max, err, ...(sym === "ALL" ? { in_focus: inFocus, top_focus: top } : {}) });
      }
      return Response.json(out, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/fresh") {
      // Work list item 1 (owner #333, #343): freshness of every feed from watermark rows only — no table scan. Filings
      // feeds: feed_fresh (written by the loaders); market feeds: the newest loaded session / ms_day per source
      // (primary-key lookups in the market database); daily slots: the latest daily_refresh rows.
      const q = async (db: D1Database, sql: string, ...p: unknown[]) => (await db.prepare(sql).bind(...p).all()).results as Record<string, unknown>[];
      const now = new Date();
      const feeds: Record<string, unknown>[] = [];
      for (const r of await q(env.DB_FILINGS, "SELECT feed, newest, rows, at FROM feed_fresh ORDER BY feed")) feeds.push({ ...r, ...staleness(String(r.feed), (r.newest as string | null) ?? null, now) });
      const dIso = (d: unknown) => (d ? `${String(d).slice(0, 4)}-${String(d).slice(4, 6)}-${String(d).slice(6, 8)}` : null);
      const [px] = await q(env.DB_MARKET, "SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND universe_rows IS NOT NULL");
      feeds.push({ feed: "prices", newest: px?.d ?? null, ...staleness("prices", (px?.d as string | null) ?? null, now) });
      for (const src of ["bulk", "block", "fii_dii"]) {
        const [m] = await q(env.DB_MARKET, "SELECT max(d) AS d FROM ms_day WHERE source=?1 AND rows >= 0", src);
        feeds.push({ feed: src, newest: dIso(m?.d), ...staleness(src, dIso(m?.d), now) });
      }
      return Response.json({
        stale: feeds.filter((f) => f.stale).map((f) => f.feed),
        feeds,
        // C53 count check: new-system insider filings loaded (distinct NSE appId, key range 'pitx:') vs XBRL files
        // downloaded (ledger by kind, ix_fetch_kind_job)
        insider_new_system: (await q(env.DB_FILINGS, "SELECT count(DISTINCT did) AS filings, count(*) AS trades FROM insider_trade WHERE key >= 'pitx:' AND key < 'pitx;'"))[0],
        insider_files: await q(env.DB_FILINGS, "SELECT kind, status, count(*) AS n FROM fetch_job WHERE kind IN ('xbrl_pit_gg','xbrl_pit_gg_probe') GROUP BY kind, status"),
        insider_failures: await q(env.DB_FILINGS, "SELECT substr(detail, 1, 40) AS reason, count(*) AS n FROM event_load WHERE kind='xbrl_pit_gg' GROUP BY 1"),
        insider_cursor: await q(env.DB_FILINGS, "SELECT detail FROM daily_refresh WHERE day='once' AND slot='pitx_cursor'"),
        daily_slots: await q(env.DB_FILINGS, "SELECT day, slot, at, substr(detail, 1, 300) AS detail FROM daily_refresh WHERE day >= ?1 AND day < 'once' ORDER BY day DESC, slot", new Date(now.getTime() + 330 * 60_000 - 2 * 86_400_000).toISOString().slice(0, 10)),
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
    // P1 (owner #341): cached counters and cursor rows only — no count over fin_value, filing or fin_load (a call read
    // ~7M rows before). Counters: seeded by filings 0035, then each loader run adds its deltas.
    const q = async (s: string) => (await env.DB_FILINGS.prepare(s).all()).results;
    return Response.json({
      counters: await q("SELECT name, n, at FROM stat_counter ORDER BY name"),
      cursors: await q("SELECT slot, at, substr(detail, 1, 200) AS detail FROM daily_refresh WHERE day='once' AND slot IN ('loader_cursor','events_cursor','pitx_cursor','primary_basis_cursor','bscf_backfill','version_backfill','remark_backfill')"),
      errors: await q("SELECT slot, at, substr(detail, 1, 200) AS detail FROM daily_refresh WHERE day='once' AND slot >= 'error:' AND slot < 'error;'"),
      focus: { indices: env.FOCUS_INDICES ?? "default", symbols: (await focusSymbols(env.DB_MARKET, env.FOCUS_INDICES))?.length ?? "all" },
    }, { headers: { "cache-control": "no-store" } });
  },
};
