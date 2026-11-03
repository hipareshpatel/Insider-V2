// Whole-universe check of the adjusted series (D134; verifies the D138 repair): day moves beyond ±35% in adjusted
// close, per security, one row per day (EQ preferred), with what is known about that date. Read-only; paged.
import { type Sql, adjustPrice, dec, diso, div, fromPaise, sub, toText } from "@disclo/core";

export async function jumps(db: Sql, after: number, limit: number) {
  const secs = await db.all<{ security_id: number; kind: string }>("SELECT security_id, kind FROM security WHERE security_id > ? ORDER BY security_id LIMIT ?", [after, limit]);
  const kindOfSid = new Map(secs.map((s) => [s.security_id, s.kind]));
  if (!secs.length) return { rows: [], next: null };
  const ids = secs.map((s) => s.security_id), lo = ids[0]!, hi = ids[ids.length - 1]!;
  const prices = await db.all<{ security_id: number; d: number; close: number; series: string }>(
    "SELECT security_id, d, close, series FROM price_daily WHERE security_id BETWEEN ? AND ? AND series IN ('EQ','BE','BZ','SM','ST') ORDER BY security_id, d, series='EQ' DESC", [lo, hi]);
  const factors = await db.all<{ security_id: number; ex_date: string; factor: string; status: string }>(
    "SELECT security_id, ex_date, factor, status FROM adj_factor WHERE security_id BETWEEN ? AND ?", [lo, hi]);
  const acts = await db.all<{ security_id: number; ex_date: string; type: string }>(
    "SELECT security_id, ex_date, type FROM corp_action WHERE security_id BETWEEN ? AND ? AND type <> 'dividend'", [lo, hi]);
  const sym = new Map((await db.all<{ security_id: number; value: string }>(
    "SELECT security_id, value FROM security_identifier WHERE id_type='nse_symbol' AND valid_to IS NULL AND security_id BETWEEN ? AND ?", [lo, hi])).map((r) => [r.security_id, r.value]));
  const isin = new Map((await db.all<{ security_id: number; value: string }>(
    "SELECT security_id, value FROM security_identifier WHERE id_type='isin' AND valid_to IS NULL AND security_id BETWEEN ? AND ?", [lo, hi])).map((r) => [r.security_id, r.value]));
  const out: { sid: number; sym: string | undefined; d: string; prevD: string; move: number; factor: string | null; factorStatus: string | null; action: string | null; series: string; kind: string | undefined; isin: string | undefined }[] = [];
  let prev: { id: number; adj: string; d: string; series: string } | null = null;
  let lastKey = "";
  for (const r of prices) {
    const key = `${r.security_id}|${r.d}`;
    if (key === lastKey) continue; // one row per day (EQ first)
    lastKey = key;
    const date = diso(r.d);
    const fr = factors.filter((f) => f.security_id === r.security_id && (f.status === "auto" || f.status === "confirmed")).map((f) => ({ exDate: f.ex_date, factor: f.factor }));
    const adj = adjustPrice(fromPaise(r.close)!, date, fr, 4);
    if (prev && prev.id === r.security_id && dec(prev.adj).units !== 0n) {
      const mv = Number(toText(div(sub(dec(adj), dec(prev.adj)), dec(prev.adj), 4)));
      if (Math.abs(mv) > 0.35) {
        const f = factors.find((x) => x.security_id === r.security_id && x.ex_date === date);
        const a = acts.find((x) => x.security_id === r.security_id && x.ex_date === date);
        out.push({ sid: r.security_id, sym: sym.get(r.security_id), d: date, prevD: prev.d, series: `${prev.series}>${r.series}`, kind: kindOfSid.get(r.security_id), isin: isin.get(r.security_id), move: Math.round(mv * 1000) / 10, factor: f?.factor ?? null, factorStatus: f?.status ?? null, action: a?.type ?? null });
      }
    }
    prev = { id: r.security_id, adj, d: date, series: r.series };
  }
  return { rows: out, next: secs.length === limit ? hi : null };
}
