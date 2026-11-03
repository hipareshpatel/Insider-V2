// Series audit (FMEA B7/C6): files load in queue order, not period order, so the load-time scale guard can miss a slip.
// This scans each stored series in period order and flags any ×10 jump between neighbouring periods. Read-only.
import { type Sql, dec, div, toText } from "@disclo/core";

export interface Jump { security_id: number; line: string; basis: string; period_kind: string; from: string; to: string; prev: string; value: string; ratio: number }

export async function auditJumps(db: Sql, lines = ["revenue", "interest_earned", "gross_premium"], limit = 200): Promise<Jump[]> {
  const marks = lines.map(() => "?").join(",");
  const rows = await db.all<{ security_id: number; line: string; basis: string; period_kind: string; period_end: string; value: string }>(
    `SELECT security_id, line, basis, period_kind, period_end, value FROM fin_value
     WHERE statement='pl' AND line IN (${marks}) AND value IS NOT NULL AND version='original'
     ORDER BY security_id, line, basis, period_kind, period_end`, lines);
  const out: Jump[] = [];
  for (let i = 1; i < rows.length && out.length < limit; i++) {
    const a = rows[i - 1]!, b = rows[i]!;
    if (a.security_id !== b.security_id || a.line !== b.line || a.basis !== b.basis || a.period_kind !== b.period_kind) continue;
    if (dec(a.value).units === 0n || dec(b.value).units === 0n) continue;
    const ratio = Math.abs(Number(toText(div(dec(b.value), dec(a.value), 6))));
    if (ratio >= 10 || ratio <= 0.1) out.push({ security_id: b.security_id, line: b.line, basis: b.basis, period_kind: b.period_kind, from: a.period_end, to: b.period_end, prev: a.value, value: b.value, ratio });
  }
  return out;
}
