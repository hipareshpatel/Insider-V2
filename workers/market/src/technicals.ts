// Field catalogue §3: price features of the focus companies, once per loaded session (work list item 3). Reads one
// security's last ≈ 400 days of closes (primary-key range) and its applied factors; writes only values that changed.
import { type Sql, FOCUS_DEFAULT, SQL_FOCUS, batchAll, insertRows, priceFeatures, type Session } from "@disclo/core";

export const SQL_LAST_LOADED = "SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session = 1 AND universe_rows IS NOT NULL";
export const SQL_FOCUS_SIDS = "SELECT DISTINCT security_id FROM security_identifier WHERE id_type = 'nse_symbol' AND value IN (SELECT value FROM json_each(?1)) ORDER BY security_id";
export const SQL_SESSIONS = "SELECT d, series, close, volume, turnover_paise FROM price_daily WHERE security_id = ?1 AND d >= ?2 AND d <= ?3 ORDER BY d";
export const SQL_APPLIED_FACTORS = "SELECT ex_date, factor FROM adj_factor WHERE security_id = ?1 AND status IN ('auto','confirmed')";
const UPSERT_HEAD = "INSERT INTO price_feature (security_id, field, value, reason, as_of, computed_at)";
const UPSERT_TAIL = `ON CONFLICT (security_id, field) DO UPDATE SET value = excluded.value, reason = excluded.reason, as_of = excluded.as_of, computed_at = excluded.computed_at
  WHERE price_feature.value IS NOT excluded.value OR price_feature.reason IS NOT excluded.reason OR price_feature.as_of IS NOT excluded.as_of`;
const PREFERRED = ["EQ", "BE", "BZ", "SM", "ST"];

/** One security: features as of `day` (ISO). Returns rows offered. */
export async function securityPriceFeatures(m: Sql, sid: number, day: string, now: Date): Promise<number> {
  const to = Number(day.replace(/-/g, "")), d0 = new Date(`${day}T00:00:00Z`); d0.setUTCDate(d0.getUTCDate() - 400);
  const rows = await m.all<{ d: number; series: string; close: number; volume: number; turnover_paise: number | null }>(SQL_SESSIONS, [sid, Number(d0.toISOString().slice(0, 10).replace(/-/g, "")), to]);
  const byDay = new Map<number, (typeof rows)[number]>();
  for (const r of rows) { const p = byDay.get(r.d); if (!p || PREFERRED.indexOf(r.series) >= 0 && (PREFERRED.indexOf(p.series) < 0 || PREFERRED.indexOf(r.series) < PREFERRED.indexOf(p.series))) byDay.set(r.d, r); }
  const sessions: Session[] = [...byDay.values()].sort((a, b) => a.d - b.d).map((r) => ({
    date: `${String(r.d).slice(0, 4)}-${String(r.d).slice(4, 6)}-${String(r.d).slice(6, 8)}`, close: r.close / 100, volume: r.volume, turnoverRs: r.turnover_paise == null ? null : r.turnover_paise / 100 }));
  const factors = (await m.all<{ ex_date: string; factor: string }>(SQL_APPLIED_FACTORS, [sid])).map((f) => ({ exDate: f.ex_date, factor: Number(f.factor) }));
  const { asOf, rows: out } = priceFeatures(sessions, factors);
  if (!asOf) return 0;
  const at = now.toISOString();
  await batchAll(m, insertRows(UPSERT_HEAD, 6, out.map((f) => [sid, f.field, f.value, f.reason, asOf, at]), UPSERT_TAIL));
  return out.length;
}

/** Once per loaded session: the focus companies, `limit` per call, cursor in kv_state ('price_features'). */
export async function priceFeaturesStep(m: Sql, now: Date, limit = 50, spec = FOCUS_DEFAULT): Promise<{ day: string | null; companies: number; rows: number; done: boolean }> {
  const [s] = await m.all<{ d: string | null }>(SQL_LAST_LOADED);
  const day = s?.d ?? null;
  if (!day) return { day, companies: 0, rows: 0, done: true };
  const [c] = await m.all<{ v: string }>("SELECT v FROM kv_state WHERE k='price_features'");
  const cur = c ? JSON.parse(c.v) as { day: string; after: number; done: boolean } : null;
  if (cur?.day === day && cur.done) return { day, companies: 0, rows: 0, done: true };
  const after = cur?.day === day ? cur.after : 0;
  const names = spec.split(",").map((x) => x.trim()).filter(Boolean);
  const syms = (await m.all<{ value: string }>(SQL_FOCUS, [JSON.stringify(names)])).map((r) => r.value);
  const sids = (await m.all<{ security_id: number }>(SQL_FOCUS_SIDS, [JSON.stringify(syms)])).map((r) => r.security_id).filter((x) => x > after).slice(0, limit);
  let rows = 0;
  for (const sid of sids) rows += await securityPriceFeatures(m, sid, day, now);
  const done = sids.length < limit;
  await m.run("INSERT INTO kv_state (k, v) VALUES ('price_features', ?) ON CONFLICT (k) DO UPDATE SET v=excluded.v", [JSON.stringify({ day, after: sids.length ? sids[sids.length - 1] : after, done })]);
  return { day, companies: sids.length, rows, done };
}
