// Field catalogue §3: price features of the focus companies, once per loaded session (work list item 3). Reads one
// security's last ≈ 400 days of closes (primary-key range) and its applied factors; writes only values that changed.
// Surveillance / F&O ban / price band / deals come from the stored market-structure tables (index or key ranges only).
import {
  type Sql, FOCUS_DEFAULT, SQL_FOCUS, batchAll, insertRows, priceFeatures, structureFeatures, dealsCoverage, dealsWindowFrom,
  type DealRow, type LedgerDay, type Session,
} from "@disclo/core";

export const SQL_LAST_LOADED = "SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session = 1 AND universe_rows IS NOT NULL";
export const SQL_FOCUS_SIDS = "SELECT DISTINCT security_id FROM security_identifier WHERE id_type = 'nse_symbol' AND value IN (SELECT value FROM json_each(?1)) ORDER BY security_id";
export const SQL_SESSIONS = "SELECT d, series, close, volume, turnover_paise FROM price_daily WHERE security_id = ?1 AND d >= ?2 AND d <= ?3 ORDER BY d";
export const SQL_DELIVERY = "SELECT d, series, deliverable_qty FROM delivery_daily WHERE security_id = ?1 AND d >= ?2 AND d <= ?3";
export const SQL_NIFTY = "SELECT d, close FROM index_daily WHERE index_name IN ('Nifty 50', 'NIFTY 50') AND d >= ?1 AND d <= ?2 ORDER BY d";
export const SQL_APPLIED_FACTORS = "SELECT ex_date, factor FROM adj_factor WHERE security_id = ?1 AND status IN ('auto','confirmed')";
// market structure: once per step (the as-of session's ledger and ban list), then per security (its symbols' rows)
export const SQL_LEDGER_DAY = "SELECT source, d, rows, note FROM ms_day WHERE source IN ('fo_ban','price_band','surveillance') AND d = ?1";
export const SQL_LEDGER_DEALS = "SELECT source, d, rows, note FROM ms_day WHERE source IN ('bulk','block') AND d >= ?1 AND d <= ?2";
export const SQL_FO_BAN_DAY = "SELECT symbol FROM fo_ban WHERE d = ?1";
export const SQL_SYMBOLS_OF = "SELECT value, valid_from, valid_to FROM security_identifier WHERE security_id = ?1 AND id_type = 'nse_symbol'";
export const SQL_SURVEILLANCE_OF = "SELECT list, stage FROM surveillance WHERE list IN ('asm_lt','asm_st','gsm') AND symbol = ?1 AND valid_from <= ?2 AND (valid_to IS NULL OR valid_to >= ?2)";
export const SQL_BAND_OF = "SELECT series, band, valid_from FROM price_band WHERE symbol = ?1 AND valid_from <= ?2 AND (valid_to IS NULL OR valid_to >= ?2)";
export const SQL_DEALS_OF = "SELECT kind, side, qty, price_paise, security_id FROM deal WHERE symbol IN (SELECT value FROM json_each(?1)) AND d >= ?2 AND d <= ?3";
const UPSERT_HEAD = "INSERT INTO price_feature (security_id, field, value, reason, as_of, computed_at)";
const UPSERT_TAIL = `ON CONFLICT (security_id, field) DO UPDATE SET value = excluded.value, reason = excluded.reason, as_of = excluded.as_of, computed_at = excluded.computed_at
  WHERE price_feature.value IS NOT excluded.value OR price_feature.reason IS NOT excluded.reason OR price_feature.as_of IS NOT excluded.as_of`;
const PREFERRED = ["EQ", "BE", "BZ", "SM", "ST"];
const dn = (iso: string) => Number(iso.replace(/-/g, ""));

/** Step-level market-structure context for the as-of session (read once per step). */
export interface StructureCtx { ledger: LedgerDay[]; banned: Set<string>; ready: boolean }
export async function structureContext(m: Sql, day: string): Promise<StructureCtx> {
  const ledger = [...await m.all<LedgerDay>(SQL_LEDGER_DAY, [dn(day)]), ...await m.all<LedgerDay>(SQL_LEDGER_DEALS, [dn(dealsWindowFrom(day)), dn(day)])];
  const banned = new Set((await m.all<{ symbol: string }>(SQL_FO_BAN_DAY, [dn(day)])).map((r) => r.symbol));
  const loaded = (s: string) => ledger.some((x) => x.source === s && x.d === dn(day) && x.rows >= 0);
  return { ledger, banned, ready: ["fo_ban", "price_band", "surveillance"].every(loaded) && dealsCoverage(ledger, day) === null };
}

/** One security's surveillance / ban / band / deal fields as of `day`. */
async function securityStructure(m: Sql, sid: number, day: string, ctx: StructureCtx) {
  const ids = await m.all<{ value: string; valid_from: string; valid_to: string | null }>(SQL_SYMBOLS_OF, [sid]);
  const from = dealsWindowFrom(day);
  const symbol = ids.filter((r) => r.valid_from <= day && (!r.valid_to || r.valid_to >= day)).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]?.value ?? null;
  const inWindow = [...new Set(ids.filter((r) => r.valid_from <= day && (!r.valid_to || r.valid_to >= from)).map((r) => r.value))];
  if (!symbol) return structureFeatures({ asOf: day, symbol, ledger: ctx.ledger, surveillance: [], banned: false, bands: [], deals: [] });
  const surveillance = await m.all<{ list: string; stage: string }>(SQL_SURVEILLANCE_OF, [symbol, dn(day)]);
  const bands = (await m.all<{ series: string; band: string; valid_from: number }>(SQL_BAND_OF, [symbol, dn(day)])).map((b) => ({ series: b.series, band: b.band, validFrom: b.valid_from }));
  // a deal whose symbol was resolved to another security (symbol reuse) is not this company's
  const deals: DealRow[] = (await m.all<{ kind: "bulk" | "block"; side: "B" | "S"; qty: number; price_paise: number; security_id: number | null }>(SQL_DEALS_OF, [JSON.stringify(inWindow), dn(from), dn(day)]))
    .filter((d) => d.security_id == null || d.security_id === sid).map((d) => ({ kind: d.kind, side: d.side, qty: d.qty, pricePaise: d.price_paise }));
  return structureFeatures({ asOf: day, symbol, ledger: ctx.ledger, surveillance, banned: ctx.banned.has(symbol), bands, deals });
}

/** One security: features as of `day` (ISO). Returns rows offered. */
export async function securityPriceFeatures(m: Sql, sid: number, day: string, now: Date, nifty?: { date: string; close: number }[], structure?: StructureCtx): Promise<number> {
  const to = Number(day.replace(/-/g, "")), d0 = new Date(`${day}T00:00:00Z`); d0.setUTCDate(d0.getUTCDate() - 400);
  const rows = await m.all<{ d: number; series: string; close: number; volume: number; turnover_paise: number | null }>(SQL_SESSIONS, [sid, Number(d0.toISOString().slice(0, 10).replace(/-/g, "")), to]);
  const byDay = new Map<number, (typeof rows)[number]>();
  for (const r of rows) { const p = byDay.get(r.d); if (!p || PREFERRED.indexOf(r.series) >= 0 && (PREFERRED.indexOf(p.series) < 0 || PREFERRED.indexOf(r.series) < PREFERRED.indexOf(p.series))) byDay.set(r.d, r); }
  const from = Number(d0.toISOString().slice(0, 10).replace(/-/g, ""));
  const dl = new Map((await m.all<{ d: number; series: string; deliverable_qty: number | null }>(SQL_DELIVERY, [sid, from, to])).map((x) => [`${x.d}|${x.series}`, x.deliverable_qty]));
  const sessions: Session[] = [...byDay.values()].sort((a, b) => a.d - b.d).map((r) => ({
    date: `${String(r.d).slice(0, 4)}-${String(r.d).slice(4, 6)}-${String(r.d).slice(6, 8)}`, close: r.close / 100, volume: r.volume, turnoverRs: r.turnover_paise == null ? null : r.turnover_paise / 100, deliverableQty: dl.get(`${r.d}|${r.series}`) ?? null }));
  const factors = (await m.all<{ ex_date: string; factor: string }>(SQL_APPLIED_FACTORS, [sid])).map((f) => ({ exDate: f.ex_date, factor: Number(f.factor) }));
  const { asOf, rows: out } = priceFeatures(sessions, factors, nifty);
  if (!asOf) return 0;
  const at = now.toISOString();
  // structure flags are as of the last loaded session (`day`), which may be after a suspended stock's last close
  const st = structure ? await securityStructure(m, sid, day, structure) : [];
  await batchAll(m, insertRows(UPSERT_HEAD, 6, [...out.map((f) => [sid, f.field, f.value, f.reason, asOf, at]), ...st.map((f) => [sid, f.field, f.value, f.reason, day, at])], UPSERT_TAIL));
  return out.length + st.length;
}

/** Once per loaded session: the focus companies, `limit` per call, cursor in kv_state ('price_features'). A pass that
 *  finished before the session's market-structure files were loaded runs once more when they are. */
export async function priceFeaturesStep(m: Sql, now: Date, limit = 50, spec = FOCUS_DEFAULT, restart = false): Promise<{ day: string | null; companies: number; rows: number; done: boolean }> {
  const [s] = await m.all<{ d: string | null }>(SQL_LAST_LOADED);
  const day = s?.d ?? null;
  if (!day) return { day, companies: 0, rows: 0, done: true };
  const [c] = await m.all<{ v: string }>("SELECT v FROM kv_state WHERE k='price_features'");
  let cur = c && !restart ? JSON.parse(c.v) as { day: string; after: number; done: boolean; ready?: boolean } : null;
  const structure = await structureContext(m, day);
  if (cur?.day === day && cur.done) {
    if (cur.ready || !structure.ready) return { day, companies: 0, rows: 0, done: true };
    cur = null; // the structure files arrived after the pass: once more
  }
  const after = cur?.day === day ? cur.after : 0;
  const ready = (cur?.day === day && after > 0 ? cur.ready === true : true) && structure.ready;
  const names = spec.split(",").map((x) => x.trim()).filter(Boolean);
  const syms = (await m.all<{ value: string }>(SQL_FOCUS, [JSON.stringify(names)])).map((r) => r.value);
  const sids = (await m.all<{ security_id: number }>(SQL_FOCUS_SIDS, [JSON.stringify(syms)])).map((r) => r.security_id).filter((x) => x > after).slice(0, limit);
  let rows = 0;
  const to = Number(day.replace(/-/g, "")), d0 = new Date(`${day}T00:00:00Z`); d0.setUTCDate(d0.getUTCDate() - 400);
  const nifty = (await m.all<{ d: number; close: string }>(SQL_NIFTY, [Number(d0.toISOString().slice(0, 10).replace(/-/g, "")), to]))
    .map((r) => ({ date: `${String(r.d).slice(0, 4)}-${String(r.d).slice(4, 6)}-${String(r.d).slice(6, 8)}`, close: Number(r.close) }));
  // one close per day (both spellings of the index name may be stored for a day)
  const niftyByDay = [...new Map(nifty.map((x) => [x.date, x])).values()];
  for (const sid of sids) rows += await securityPriceFeatures(m, sid, day, now, niftyByDay, structure);
  const done = sids.length < limit;
  await m.run("INSERT INTO kv_state (k, v) VALUES ('price_features', ?) ON CONFLICT (k) DO UPDATE SET v=excluded.v", [JSON.stringify({ day, after: sids.length ? sids[sids.length - 1] : after, done, ready })]);
  return { day, companies: sids.length, rows, done };
}
