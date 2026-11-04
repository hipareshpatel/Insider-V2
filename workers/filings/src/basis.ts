// D50/D51: primary basis per company and basis-switch series breaks, from the quarters actually filed.
//   banks → standalone (D50); holding companies → both (standalone income < 20% of consolidated: the parent mainly
//   holds stakes); otherwise consolidated when filed, else standalone. A quarter where consolidated results start or
//   stop (after the company's first filed quarter) is a series break: charts and growth rates never join across it.
import { type Sql, batchAll, insertRows } from "@disclo/core";

export interface BasisInput { template: string; quarters: { period_end: string; basis: string; income: number | null }[] }
export interface BasisDecision { basis: "consolidated" | "standalone" | "both"; reason: string; consQ: number; saQ: number; saShare: number | null; breaks: { period_end: string; change: "consolidated starts" | "consolidated stops" }[] }

export const HOLDING_SHARE = 0.2;
export function decideBasis(x: BasisInput): BasisDecision {
  const cons = new Map<string, number | null>(), sa = new Map<string, number | null>();
  for (const q of x.quarters) (q.basis === "consolidated" ? cons : sa).set(q.period_end, q.income);
  const ends = [...new Set(x.quarters.map((q) => q.period_end))].sort();
  const breaks: BasisDecision["breaks"] = [];
  for (let i = 1; i < ends.length; i++) {
    const was = cons.has(ends[i - 1]!), is = cons.has(ends[i]!);
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

/** Once a day for the focus companies: decide and store; breaks replaced per company. */
export async function runPrimaryBasis(db: Sql, sids: number[], now: Date): Promise<number> {
  const stmts = [];
  for (const sid of sids) {
    const rows = await db.all<{ period_end: string; basis: string; template: string; income: string | null }>(
      `SELECT period_end, basis, max(template) AS template, max(CASE WHEN line IN ('total_income','interest_earned','gross_premium') THEN value END) AS income
       FROM fin_value WHERE security_id=? AND statement='pl' AND period_kind='Q' AND version='original' AND dims='' GROUP BY period_end, basis`, [sid]);
    if (!rows.length) continue;
    const d = decideBasis({ template: rows.some((r) => r.template === "bank") ? "bank" : rows[0]!.template, quarters: rows.map((r) => ({ period_end: r.period_end, basis: r.basis, income: r.income === null ? null : Number(r.income) })) });
    stmts.push({ sql: "INSERT OR REPLACE INTO primary_basis (security_id,basis,reason,cons_q,sa_q,sa_share,decided_at) VALUES (?,?,?,?,?,?,?)", params: [sid, d.basis, d.reason, d.consQ, d.saQ, d.saShare === null ? null : String(d.saShare), now.toISOString()] });
    stmts.push({ sql: "DELETE FROM basis_break WHERE security_id=?", params: [sid] });
    stmts.push(...insertRows("INSERT OR IGNORE INTO basis_break (security_id, period_end, change)", 3, d.breaks.map((b) => [sid, b.period_end, b.change])));
  }
  await batchAll(db, stmts, 200);
  return sids.length;
}
