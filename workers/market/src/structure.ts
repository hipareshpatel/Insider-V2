// M1 market-structure loader (D76, D144): reads only R2 (prefetched archive files and API answers), never NSE.
// Per source, sessions are loaded in date order from that source's last recorded day (ms_day). A file missing for
// a session older than 2 days is recorded (rows = -1) and skipped, never silently dropped; a recent one is awaited.
import {
  type Sql, STRUCTURE_API_CAP, batchAll, dnum, insertRows, parseDealsApi, parseDealsCsv, parseFiiDii, parseFoBan,
  parseParticipantOi, parseSecList, parseShortApi, parseSurveillance, toPaise,
} from "@disclo/core";
import { addDays, istNow } from "./dates.js";

export interface StructureDeps { market: Sql; raw: R2Bucket; now: () => Date }

export async function r2Text(raw: R2Bucket, key: string): Promise<string | null> {
  const o = await raw.get(key);
  if (!o) return null;
  if (o.customMetadata?.enc === "gzip") return new Response(o.body.pipeThrough(new DecompressionStream("gzip"))).text();
  return o.text();
}
const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;
const OI_COLS: [string, string][] = [["future_index_long", "fut_idx_long"], ["future_index_short", "fut_idx_short"], ["future_stock_long", "fut_stk_long"], ["future_stock_short", "fut_stk_short"],
  ["option_index_call_long", "opt_idx_call_long"], ["option_index_put_long", "opt_idx_put_long"], ["option_index_call_short", "opt_idx_call_short"], ["option_index_put_short", "opt_idx_put_short"],
  ["option_stock_call_long", "opt_stk_call_long"], ["option_stock_put_long", "opt_stk_put_long"], ["option_stock_call_short", "opt_stk_call_short"], ["option_stock_put_short", "opt_stk_put_short"],
  ["total_long_contracts", "total_long"], ["total_short_contracts", "total_short"]];

type Result = { rows: number; note?: string } | "wait";
interface Source { name: string; from: string; load: (iso: string, prevIso: string | null, ctx: Ctx) => Promise<Result | null> } // null = file missing
interface Ctx { m: Sql; raw: R2Bucket; sid: (symbol: string, iso: string) => number | null }

/** Interval tables (price bands, surveillance): close what changed or disappeared, open what is new. */
async function intervals(m: Sql, table: "price_band" | "surveillance", keyCols: [string, string], valCol: "band" | "stage", today: { k1: string; k2: string; v: string }[], d: number, prevD: number | null) {
  const open = await m.all<{ a: string; b: string; v: string; f: number }>(`SELECT ${keyCols[0]} AS a, ${keyCols[1]} AS b, ${valCol} AS v, valid_from AS f FROM ${table} WHERE valid_to IS NULL`);
  const cur = new Map(open.map((o) => [`${o.a}|${o.b}`, o]));
  const seen = new Set<string>();
  const stmts: { sql: string; params: unknown[] }[] = [];
  const ins: unknown[][] = [];
  for (const t of today) {
    const k = `${t.k1}|${t.k2}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const o = cur.get(k);
    if (o && o.v === t.v) continue;
    if (o) stmts.push({ sql: `UPDATE ${table} SET valid_to=? WHERE ${keyCols[0]}=? AND ${keyCols[1]}=? AND valid_from=?`, params: [prevD ?? d, o.a, o.b, o.f] });
    ins.push([t.k1, t.k2, t.v, d]);
  }
  for (const [k, o] of cur) if (!seen.has(k)) stmts.push({ sql: `UPDATE ${table} SET valid_to=? WHERE ${keyCols[0]}=? AND ${keyCols[1]}=? AND valid_from=?`, params: [prevD ?? d, o.a, o.b, o.f] });
  await batchAll(m, [...stmts, ...insertRows(`INSERT OR IGNORE INTO ${table} (${keyCols[0]}, ${keyCols[1]}, ${valCol}, valid_from)`, 4, ins)]);
}

const SOURCES: Source[] = [
  { name: "fo_oi", from: "2024-01-01", async load(iso, _p, c) {
    const t = await r2Text(c.raw, `cache/content/nsccl/fao_participant_oi_${ddmmyyyy(iso)}.csv`);
    if (t === null) return null;
    const rows = parseParticipantOi(t).map((r) => [dnum(iso), r.clientType, ...OI_COLS.map(([k]) => r.values[k] ?? null)]);
    await batchAll(c.m, insertRows(`INSERT OR REPLACE INTO fo_oi_participant (d, client_type, ${OI_COLS.map(([, col]) => col).join(", ")})`, 16, rows));
    return { rows: rows.length };
  } },
  { name: "fo_ban", from: "2024-01-01", async load(iso, _p, c) {
    const t = await r2Text(c.raw, `cache/archives/fo/sec_ban/fo_secban_${ddmmyyyy(iso)}.csv`);
    if (t === null) return null;
    const b = parseFoBan(t);
    await batchAll(c.m, insertRows("INSERT OR IGNORE INTO fo_ban (d, symbol)", 2, b.symbols.map((s) => [dnum(iso), s])));
    return { rows: b.symbols.length, note: b.date && b.date !== iso ? `file says ${b.date}` : undefined };
  } },
  { name: "price_band", from: "2024-01-01", async load(iso, prev, c) {
    const t = await r2Text(c.raw, `cache/content/equities/sec_list_${ddmmyyyy(iso)}.csv`);
    if (t === null) return null;
    const rows = parseSecList(t);
    await intervals(c.m, "price_band", ["symbol", "series"], "band", rows.map((r) => ({ k1: r.symbol, k2: r.series, v: r.band })), dnum(iso)!, prev ? dnum(prev) : null);
    return { rows: rows.length };
  } },
  ...(["bulk", "block"] as const).map((kind): Source => ({ name: kind, from: "2024-01-01", async load(iso, _p, c) {
    const file = await r2Text(c.raw, `cache/content/equities/${kind}_${iso}.csv`); // complete daily file (from 2026-11-03)
    const api = file === null ? await r2Text(c.raw, `api/market_structure/${kind}_deals/${iso}.json`) : null;
    if (file === null && api === null) return null;
    const deals = (file !== null ? parseDealsCsv(file) : parseDealsApi(api!)).filter((x) => x.date === iso);
    const rows = deals.map((x) => [kind, dnum(iso), x.symbol, x.client, x.side, x.qty, toPaise(x.price) ?? 0, c.sid(x.symbol, iso), x.remarks || null]);
    await batchAll(c.m, insertRows("INSERT OR IGNORE INTO deal (kind, d, symbol, client, side, qty, price_paise, security_id, remarks)", 9, rows));
    return { rows: rows.length, note: file !== null ? "complete daily file" : deals.length >= STRUCTURE_API_CAP ? `possibly truncated (API cap ${STRUCTURE_API_CAP})` : undefined };
  } })),
  { name: "short", from: "2024-01-01", async load(iso, _p, c) {
    const t = await r2Text(c.raw, `api/market_structure/short_selling/${iso}.json`);
    if (t === null) return null;
    const ss = parseShortApi(t).filter((x) => x.date === iso);
    await batchAll(c.m, insertRows("INSERT OR IGNORE INTO short_sell (d, symbol, qty, security_id)", 4, ss.map((x) => [dnum(iso), x.symbol, x.qty, c.sid(x.symbol, iso)])));
    return { rows: ss.length, note: ss.length >= STRUCTURE_API_CAP ? `possibly truncated (API cap ${STRUCTURE_API_CAP})` : undefined };
  } },
  { name: "surveillance", from: "2026-11-03", async load(iso, prev, c) {
    const [a, g] = [await r2Text(c.raw, `api/market_structure/asm/${iso}.json`), await r2Text(c.raw, `api/market_structure/gsm/${iso}.json`)];
    if (a === null && g === null) return null;
    const rows = parseSurveillance(a, g);
    await intervals(c.m, "surveillance", ["list", "symbol"], "stage", rows.map((r) => ({ k1: r.list, k2: r.symbol, v: r.stage })), dnum(iso)!, prev ? dnum(prev) : null);
    return { rows: rows.length };
  } },
  { name: "fii_dii", from: "2026-11-03", async load(iso, _p, c) {
    const t = await r2Text(c.raw, `api/market_structure/fii_dii/${iso}.json`);
    if (t === null) return null;
    const rows = parseFiiDii(t); // carries its own trading date (the snapshot is taken in the evening)
    await batchAll(c.m, insertRows("INSERT OR REPLACE INTO fii_dii (d, category, buy_cr, sell_cr, net_cr)", 5, rows.map((r) => [dnum(r.date), r.category, r.buy, r.sell, r.net])));
    return { rows: rows.length };
  } },
];

/** Work list 1.8: a day whose API answer hit the 70-row cap is replaced from NSE's uncapped CSV for its 10-day window
 *  (windows start 2024-01-01 every 10 days; downloaded by the prefetch). The CSV is complete, so the day's rows are
 *  replaced, not merged (API and CSV can round the weighted price differently). Waits while a window isn't stored. */
export const DEALS_CSV_FROM = "2024-01-01";
export function dealsCsvKey(kind: "bulk" | "block", iso: string): string {
  const days = Math.floor((Date.parse(iso + "T00:00:00Z") - Date.parse(DEALS_CSV_FROM + "T00:00:00Z")) / 86400_000);
  const start = new Date(Date.parse(DEALS_CSV_FROM + "T00:00:00Z") + Math.floor(days / 10) * 10 * 86400_000).toISOString().slice(0, 10);
  return `api/market_structure/${kind}_deals_csv/${start}.csv`;
}
export async function refillDealsCsv(deps: StructureDeps, budgetMs: number, limit = 60): Promise<{ refilled: number; waiting: number }> {
  const t0 = Date.now(), m = deps.market;
  const days = await m.all<{ source: "bulk" | "block"; d: number; rows: number }>("SELECT source, d, rows FROM ms_day WHERE source IN ('bulk','block') AND note LIKE 'possibly truncated%' ORDER BY d LIMIT ?", [limit]);
  if (!days.length) return { refilled: 0, waiting: 0 };
  const ids = await m.all<{ security_id: number; value: string; valid_from: string; valid_to: string | null }>("SELECT security_id, value, valid_from, valid_to FROM security_identifier WHERE id_type='nse_symbol'");
  const bySym = new Map<string, typeof ids>();
  for (const r of ids) { const l = bySym.get(r.value) ?? []; l.push(r); bySym.set(r.value, l); }
  const sid = (s: string, iso: string) => bySym.get(s)?.find((r) => r.valid_from <= iso && (!r.valid_to || r.valid_to >= iso))?.security_id ?? bySym.get(s)?.[0]?.security_id ?? null;
  const cache = new Map<string, string | null>();
  let refilled = 0, waiting = 0;
  for (const x of days) {
    if (Date.now() - t0 > budgetMs) break;
    const iso = `${String(x.d).slice(0, 4)}-${String(x.d).slice(4, 6)}-${String(x.d).slice(6, 8)}`, key = dealsCsvKey(x.source, iso);
    if (!cache.has(key)) cache.set(key, await r2Text(deps.raw, key));
    const text = cache.get(key);
    if (text === null || text === undefined) { waiting++; continue; }
    let deals: ReturnType<typeof parseDealsCsv> = [];
    try { deals = parseDealsCsv(text).filter((y) => y.date === iso); } catch { waiting++; continue; }
    if (deals.length < x.rows) { await m.run("UPDATE ms_day SET note=? WHERE source=? AND d=?", [`csv window has ${deals.length} < api ${x.rows}: kept api rows`, x.source, x.d]); continue; }
    await batchAll(m, [
      { sql: "DELETE FROM deal WHERE kind=? AND d=?", params: [x.source, x.d] },
      ...insertRows("INSERT OR IGNORE INTO deal (kind, d, symbol, client, side, qty, price_paise, security_id, remarks)", 9, deals.map((y) => [x.source, x.d, y.symbol, y.client, y.side, y.qty, toPaise(y.price) ?? 0, sid(y.symbol, iso), y.remarks || null])),
      { sql: "UPDATE ms_day SET rows=?, note='complete (csv window)' WHERE source=? AND d=?", params: [deals.length, x.source, x.d] },
    ], 500);
    refilled++;
  }
  return { refilled, waiting };
}

/** Load market-structure sessions within `budgetMs`. Returns days loaded per source. */
export async function loadStructure(deps: StructureDeps, budgetMs: number): Promise<Record<string, number>> {
  const t0 = Date.now(), m = deps.market, today = istNow(deps.now()).date;
  const sessions = (await m.all<{ trade_date: string }>("SELECT trade_date FROM trading_calendar WHERE is_session=1 AND universe_rows IS NOT NULL AND trade_date >= '2024-01-01' ORDER BY trade_date")).map((r) => r.trade_date);
  if (!sessions.length) return {};
  const ids = await m.all<{ security_id: number; value: string; valid_from: string; valid_to: string | null }>("SELECT security_id, value, valid_from, valid_to FROM security_identifier WHERE id_type='nse_symbol'");
  const bySym = new Map<string, typeof ids>();
  for (const r of ids) { const l = bySym.get(r.value) ?? []; l.push(r); bySym.set(r.value, l); }
  const ctx: Ctx = { m, raw: deps.raw, sid: (s, iso) => bySym.get(s)?.find((r) => r.valid_from <= iso && (!r.valid_to || r.valid_to >= iso))?.security_id ?? bySym.get(s)?.[0]?.security_id ?? null };
  const done: Record<string, number> = {};
  for (const src of SOURCES) {
    const [last] = await m.all<{ d: number | null }>("SELECT max(d) AS d FROM ms_day WHERE source=?", [src.name]);
    const lastIso = last?.d ? `${String(last.d).slice(0, 4)}-${String(last.d).slice(4, 6)}-${String(last.d).slice(6, 8)}` : null;
    let i = sessions.findIndex((s) => s > (lastIso ?? "") && s >= src.from);
    if (i < 0) continue;
    for (; i < sessions.length && Date.now() - t0 < budgetMs; i++) {
      const iso = sessions[i]!, prev = i > 0 ? sessions[i - 1]! : null;
      const r = await src.load(iso, prev, ctx);
      if (r === null) {
        if (iso >= addDays(today, -2)) break; // recent: the file may still come
        await m.run("INSERT OR REPLACE INTO ms_day (source, d, rows, note) VALUES (?, ?, -1, 'missing in R2')", [src.name, dnum(iso)]);
      } else if (r !== "wait") {
        await m.run("INSERT OR REPLACE INTO ms_day (source, d, rows, note) VALUES (?, ?, ?, ?)", [src.name, dnum(iso), r.rows, r.note ?? null]);
        done[src.name] = (done[src.name] ?? 0) + 1;
      }
    }
  }
  return done;
}
