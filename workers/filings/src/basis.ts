// D50/D51: primary basis per company and basis-switch series breaks, from the quarters actually filed.
//   banks → standalone (D50); holding companies → both (standalone income < 20% of consolidated: the parent mainly
//   holds stakes); otherwise consolidated when filed, else standalone. A quarter where consolidated results start or
//   stop (after the company's first filed quarter) is a series break: charts and growth rates never join across it.
import { type Sql, batchAll, insertRows } from "@disclo/core";

export interface BasisInput { template: string; quarters: { period_end: string; basis: string; income: number | null }[]; nseConsolidated?: Set<string> }
export interface BasisDecision { basis: "consolidated" | "standalone" | "both"; reason: string; consQ: number; saQ: number; saShare: number | null; breaks: { period_end: string; change: "consolidated starts" | "consolidated stops" }[] }

export const HOLDING_SHARE = 0.2;
export function decideBasis(x: BasisInput): BasisDecision {
  const cons = new Map<string, number | null>(), sa = new Map<string, number | null>();
  for (const q of x.quarters) (q.basis === "consolidated" ? cons : sa).set(q.period_end, q.income);
  const ends = [...new Set(x.quarters.map((q) => q.period_end))].sort();
  const breaks: BasisDecision["breaks"] = [];
  // a quarter counts as consolidated when it is loaded OR when NSE's own list has a consolidated filing for it — a file
  // we failed to load is a coverage gap, not a basis switch (ABB, COROMANDEL, 4 Nov)
  const hasCons = (e: string) => cons.has(e) || !!x.nseConsolidated?.has(e);
  for (let i = 1; i < ends.length; i++) {
    const was = hasCons(ends[i - 1]!), is = hasCons(ends[i]!);
    if (!was && is) breaks.push({ period_end: ends[i]!, change: "consolidated starts" });
    if (was && !is) breaks.push({ period_end: ends[i]!, change: "consolidated stops" });
  }
  // latest quarter with both bases: standalone ÷ consolidated income
  const both = ends.filter((e) => cons.get(e) && sa.get(e)).pop();
  const saShare = both ? Number(sa.get(both)) / Number(cons.get(both)) : null;
  const base = { consQ: cons.size, saQ: sa.size, saShare: saShare === null ? null : Math.round(saShare * 1000) / 1000, breaks };
  if (x.template === "bank") return { basis: "standalone", reason: "bank (D50)", ...base };
  if (!cons.size) return { basis: "standalone", reason: "no consolidated results filed", ...base };
  if (saShare !== null && saShare > 0 && saShare < HOLDING_SHARE) return { basis: "both", reason: `holding company: standalone income ${(saShare * 100).toFixed(1)}% of consolidated`, ...base };
  return { basis: "consolidated", reason: "files consolidated results", ...base };
}

const MON: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const iso = (d: unknown) => { const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})/.exec(String(d ?? "")); return m ? `${m[3]}-${MON[m[2]!.toUpperCase()]}-${m[1]}` : null; };
/** The period (quarter or year) end of one row of NSE's results lists: Integrated Filing qe_Date, results toDate. */
export const listRowPeriodEnd = (r: Record<string, unknown>): string | null => iso(r.qe_Date ?? r.qeDate ?? r.toDate ?? r.to_date);
/** /if-list ?since= (G19): a year ("2026") or a date ("2025-03-31") → the earliest period end kept; null = no filter. */
export function ifListSince(param: string | null): string | null | "bad" {
  if (!param) return null;
  if (/^\d{4}$/.test(param)) return `${param}-01-01`;
  return /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : "bad";
}
/** Keeps a list row when its own period end is on/after `since` (the list's fetch date or any other date never counts). */
export const ifListKeeps = (r: Record<string, unknown>, since: string | null) => !since || (listRowPeriodEnd(r) ?? "") >= since;
/** (quarter end, basis) pairs on NSE's own results lists for one company, from the stored lists (quarterly results only). */
export function nseListed(listJsons: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of listJsons) {
    let rows: Record<string, unknown>[] = [];
    try { const d = JSON.parse(t); rows = Array.isArray(d) ? d : (d.data ?? []); } catch { continue; }
    for (const r of rows) {
      const end = iso(r.qe_Date ?? r.toDate), c = String(r.consolidated ?? "").toLowerCase();
      if (!end || (r.period && !/quarter/i.test(String(r.period)))) continue;
      out.add(`${end}|${c.startsWith("consol") ? "consolidated" : "standalone"}`);
    }
  }
  return out;
}

/** Decide and store, per company. P0 (audit 4 Nov): writes only what changed (was: delete + re-insert of every gap and
 *  break and a REPLACE of the decision for all 250 companies every day, C33). */
export async function runPrimaryBasis(db: Sql, sids: number[], now: Date, lists?: (sid: number) => Promise<string[]>): Promise<number> {
  const stmts = [];
  for (const sid of sids) {
    const rows = await db.all<{ period_end: string; basis: string; template: string; income: string | null }>(
      `SELECT period_end, basis, max(template) AS template, max(CASE WHEN line IN ('total_income','interest_earned','gross_premium') THEN value END) AS income
       FROM fin_value WHERE security_id=? AND statement='pl' AND period_kind='Q' AND version='original' AND dims='' GROUP BY period_end, basis`, [sid]);
    if (!rows.length) continue;
    const listed = lists ? nseListed(await lists(sid)) : new Set<string>();
    const nseConsolidated = new Set([...listed].filter((k) => k.endsWith("|consolidated")).map((k) => k.split("|")[0]!));
    const d = decideBasis({ template: rows.some((r) => r.template === "bank") ? "bank" : rows[0]!.template, quarters: rows.map((r) => ({ period_end: r.period_end, basis: r.basis, income: r.income === null ? null : Number(r.income) })), nseConsolidated });
    // coverage (D90, 5 years from 2021-04): listed by NSE but not loaded
    const loaded = new Set(rows.map((r) => `${r.period_end}|${r.basis}`));
    // D168: coverage is required from 2024-01-01 only (was 2021-06-30); older listed quarters are never flagged
    const gaps = new Set([...listed].filter((k) => !loaded.has(k) && k >= "2024-01-01"));
    const oldGaps = new Set((await db.all<{ period_end: string; basis: string }>("SELECT period_end, basis FROM coverage_gap WHERE security_id=?", [sid])).map((r) => `${r.period_end}|${r.basis}`));
    for (const k of oldGaps) if (!gaps.has(k)) stmts.push({ sql: "DELETE FROM coverage_gap WHERE security_id=? AND period_end=? AND basis=?", params: [sid, ...k.split("|")] });
    stmts.push(...insertRows("INSERT OR IGNORE INTO coverage_gap (security_id, period_end, basis)", 3, [...gaps].filter((k) => !oldGaps.has(k)).map((k) => [sid, ...k.split("|")])));
    stmts.push({ sql: `INSERT INTO primary_basis (security_id,basis,reason,cons_q,sa_q,sa_share,decided_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT (security_id) DO UPDATE SET basis=excluded.basis, reason=excluded.reason, cons_q=excluded.cons_q, sa_q=excluded.sa_q, sa_share=excluded.sa_share, decided_at=excluded.decided_at
      WHERE primary_basis.basis IS NOT excluded.basis OR primary_basis.reason IS NOT excluded.reason OR primary_basis.cons_q IS NOT excluded.cons_q
         OR primary_basis.sa_q IS NOT excluded.sa_q OR primary_basis.sa_share IS NOT excluded.sa_share`,
      params: [sid, d.basis, d.reason, d.consQ, d.saQ, d.saShare === null ? null : String(d.saShare), now.toISOString()] });
    const brk = new Map(d.breaks.map((b) => [b.period_end, b.change]));
    const oldBrk = new Map((await db.all<{ period_end: string; change: string }>("SELECT period_end, change FROM basis_break WHERE security_id=?", [sid])).map((r) => [r.period_end, r.change]));
    for (const [e, c] of oldBrk) if (brk.get(e) !== c) stmts.push({ sql: "DELETE FROM basis_break WHERE security_id=? AND period_end=?", params: [sid, e] });
    stmts.push(...insertRows("INSERT OR IGNORE INTO basis_break (security_id, period_end, change)", 3, [...brk].filter(([e, c]) => oldBrk.get(e) !== c).map(([e, c]) => [sid, e, c])));
  }
  await batchAll(db, stmts, 200);
  return sids.length;
}

/** Companies with filings loaded after the cursor (filing_id range: a rowid search, not a scan). */
export const SQL_BASIS_NEW = "SELECT filing_id, security_id FROM filing WHERE filing_id > ? AND kind <> 'shareholding' ORDER BY filing_id LIMIT ?";
/** A company's stored NSE results lists. INDEXED BY: without statistics SQLite picked the status index and read every
 *  'done' row of fetch_job per company (audit 4 Nov). */
export const SQL_BASIS_LISTS = "SELECT r2_key FROM fetch_job INDEXED BY ix_fetch_symbol_kind WHERE symbol IN (SELECT value FROM json_each(?)) AND kind IN ('results_quarterly','integrated_financials') AND status='done'";

/** D50/D51 incremental (P0): only companies whose filings changed since the last pass, at most `limit` per run, in
 *  filing order ('once','primary_basis_cursor'). The first pass after deploy walks every filing once (cursor 0). */
/** One company's stored NSE results lists (every symbol it has had), for runPrimaryBasis. */
export function basisLists(filings: Sql, market: Sql, getText: (k: string) => Promise<string | null>): (sid: number) => Promise<string[]> {
  return async (sid: number) => {
    const syms = (await market.all<{ value: string }>("SELECT DISTINCT value FROM security_identifier WHERE security_id=? AND +id_type='nse_symbol'", [sid])).map((r) => r.value);
    const keys = await filings.all<{ r2_key: string }>(SQL_BASIS_LISTS, [JSON.stringify(syms)]);
    return (await Promise.all(keys.map((k) => getText(k.r2_key)))).filter((t): t is string => !!t);
  };
}

export async function primaryBasisStep(filings: Sql, market: Sql, getText: (k: string) => Promise<string | null>, focusSids: Set<number>, now: Date, limit = 25): Promise<{ companies: number; after: number }> {
  const [st] = await filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='primary_basis_cursor'");
  const cur = st ? JSON.parse(st.detail) as { after: number; companies: number } : { after: 0, companies: 0 };
  const rows = await filings.all<{ filing_id: number; security_id: number }>(SQL_BASIS_NEW, [cur.after, 2000]);
  if (!rows.length) return { companies: 0, after: cur.after };
  const sids: number[] = [];
  let after = cur.after;
  for (const r of rows) {
    if (focusSids.has(r.security_id) && !sids.includes(r.security_id)) {
      if (sids.length >= limit) break; // the cursor stops before the first company not done this run
      sids.push(r.security_id);
    }
    after = r.filing_id;
  }
  const lists = basisLists(filings, market, getText);
  const n = sids.length ? await runPrimaryBasis(filings, sids, now, lists) : 0;
  await filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','primary_basis_cursor',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail",
    [now.toISOString(), JSON.stringify({ after, companies: cur.companies + n })]);
  return { companies: n, after };
}

/** Work list item 2 (owner #343): (quarter end|basis) → XBRL links on NSE's own results lists for one company. */
export function nseListedFiles(listJsons: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of listJsons) {
    let rows: Record<string, unknown>[] = [];
    try { const d = JSON.parse(t); rows = Array.isArray(d) ? d : (d.data ?? []); } catch { continue; }
    for (const r of rows) {
      const end = iso(r.qe_Date ?? r.toDate), c = String(r.consolidated ?? "").toLowerCase();
      if (!end || (r.period && !/quarter/i.test(String(r.period)))) continue;
      const k = `${end}|${c.startsWith("consol") ? "consolidated" : "standalone"}`;
      const urls = out.get(k) ?? [];
      for (const u of JSON.stringify(r).match(/https:\/\/nsearchives\.nseindia\.com\/corporate\/[^"\s\\]+?\.xml/gi) ?? []) if (!urls.includes(u)) urls.push(u);
      out.set(k, urls);
    }
  }
  return out;
}

/** Why one coverage gap is not loaded, from its file's ledger row and load outcome (best outcome over its links). */
export function gapClass(files: { url: string; job?: { status: string; http_status: number | null; kind: string } | null; load?: { status: string; detail: string | null } | null }[]): string {
  if (!files.length) return "no XBRL link on NSE's list";
  const rank = (f: (typeof files)[number]): [number, string] => {
    if (!f.job) return [1, "linked file never queued"];
    if (f.job.status === "todo") return [2, "queued, not downloaded yet"];
    if (f.job.status === "failed" || f.job.status === "empty") return [3, `download ${f.job.status} (HTTP ${f.job.http_status ?? "?"})`];
    if (!f.load) return [4, "downloaded, not read yet"];
    if (f.load.status === "loaded") return [9, "loaded, but under another period or basis"];
    return [5, `${f.load.status}: ${String(f.load.detail ?? "").replace(/[\d,.×]+/g, "#").slice(0, 60)}`];
  };
  return files.map(rank).sort((a, b) => b[0] - a[0])[0]![1];
}

/** One bounded batch: classify the gaps of `perCall` companies (cursor 'once','coverage_classify'), write coverage_gap.status. */
export async function classifyGaps(db: Sql, market: Sql, getText: (k: string) => Promise<string | null>, perCall = 10): Promise<{ after: number; done: boolean; companies: number }> {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='coverage_classify'");
  const cur = st ? JSON.parse(st.detail) as { after: number; companies: number } : { after: 0, companies: 0 };
  const sids = (await db.all<{ security_id: number }>("SELECT DISTINCT security_id FROM coverage_gap WHERE security_id > ? AND period_end >= '2024-01-01' ORDER BY security_id LIMIT ?", [cur.after, perCall])).map((r) => r.security_id);
  for (const sid of sids) {
    const syms = (await market.all<{ value: string }>("SELECT DISTINCT value FROM security_identifier WHERE security_id=? AND +id_type='nse_symbol'", [sid])).map((r) => r.value);
    const keys = await db.all<{ r2_key: string }>(SQL_BASIS_LISTS, [JSON.stringify(syms)]);
    const listed = nseListedFiles((await Promise.all(keys.map((k) => getText(k.r2_key)))).filter((t): t is string => !!t));
    const gaps = await db.all<{ period_end: string; basis: string }>("SELECT period_end, basis FROM coverage_gap WHERE security_id=? AND period_end >= '2024-01-01'", [sid]); // D168
    const stmts: { sql: string; params: unknown[] }[] = [];
    for (const g of gaps) {
      const files = [];
      for (const url of listed.get(`${g.period_end}|${g.basis}`) ?? []) {
        const [job] = await db.all<{ job_id: number; status: string; http_status: number | null; kind: string }>("SELECT job_id, status, http_status, kind FROM fetch_job WHERE url=?", [url]);
        const [load] = job ? await db.all<{ status: string; detail: string | null }>("SELECT status, detail FROM fin_load WHERE job_id=?", [job.job_id]) : [];
        files.push({ url, job: job ?? null, load: load ?? null });
      }
      stmts.push({ sql: "UPDATE coverage_gap SET status=? WHERE security_id=? AND period_end=? AND basis=?", params: [gapClass(files), sid, g.period_end, g.basis] });
    }
    if (stmts.length) await batchAll(db, stmts);
    cur.after = sid; cur.companies++;
  }
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','coverage_classify',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  return { after: cur.after, done: sids.length < perCall, companies: cur.companies };
}
