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

/** Once a day for the focus companies: decide and store; breaks and coverage gaps replaced per company. */
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
    const gaps = [...listed].filter((k) => !loaded.has(k) && k >= "2021-06-30");
    stmts.push({ sql: "DELETE FROM coverage_gap WHERE security_id=?", params: [sid] });
    stmts.push(...insertRows("INSERT OR IGNORE INTO coverage_gap (security_id, period_end, basis)", 3, gaps.map((k) => [sid, ...k.split("|")])));
    stmts.push({ sql: "INSERT OR REPLACE INTO primary_basis (security_id,basis,reason,cons_q,sa_q,sa_share,decided_at) VALUES (?,?,?,?,?,?,?)", params: [sid, d.basis, d.reason, d.consQ, d.saQ, d.saShare === null ? null : String(d.saShare), now.toISOString()] });
    stmts.push({ sql: "DELETE FROM basis_break WHERE security_id=?", params: [sid] });
    stmts.push(...insertRows("INSERT OR IGNORE INTO basis_break (security_id, period_end, change)", 3, d.breaks.map((b) => [sid, b.period_end, b.change])));
  }
  await batchAll(db, stmts, 200);
  return sids.length;
}
