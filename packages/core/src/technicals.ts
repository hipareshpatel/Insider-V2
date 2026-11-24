// Field catalogue §3 (price, liquidity & technicals, EOD): computed from stored closes, adjusted for splits / bonus /
// rights by the applied factors (D6: 'auto' and 'confirmed' only; 'review' factors are never applied). Never stored as
// filed data: written to market.price_feature as computed values with their inputs (as-of date, sessions used).

/** One session of one security: ISO date, close and turnover in rupees (raw), volume. */
export interface Session { date: string; close: number; volume: number; turnoverRs: number | null; deliverableQty?: number | null }
export interface PriceFeature { field: string; value: string | null; reason: string | null }

const r2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
const pct = (now: number, base: number) => r2(((now - base) / base) * 100);

/** Adjusted close on `date` = raw × product of the factors with ex_date after `date`. */
export function adjustCloses(sessions: readonly Session[], factors: readonly { exDate: string; factor: number }[]): number[] {
  return sessions.map((s) => factors.reduce((p, f) => (f.exDate > s.date ? p * f.factor : p), s.close));
}

/** Last session on or before `date` (index), or -1. Sessions in date order. */
function onOrBefore(sessions: readonly Session[], date: string): number {
  let lo = 0, hi = sessions.length - 1, at = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (sessions[m]!.date <= date) { at = m; lo = m + 1; } else hi = m - 1; }
  return at;
}
const shift = (iso: string, days: number, months = 0) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (months) { const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months); d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); }
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** EMA with the usual smoothing 2 ÷ (n + 1), seeded by the simple average of the first n closes. */
export function ema(xs: readonly number[], n: number): number | null {
  if (xs.length < n) return null;
  const k = 2 / (n + 1);
  let e = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < xs.length; i++) e = xs[i]! * k + e * (1 - k);
  return e;
}
/** RSI (Wilder, 14): average gains and losses seeded by the first 14 changes, then Wilder smoothing. */
export function rsi(xs: readonly number[], n = 14): number | null {
  if (xs.length < n + 1) return null;
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = xs[i]! - xs[i - 1]!; if (d > 0) g += d; else l -= d; }
  g /= n; l /= n;
  for (let i = n + 1; i < xs.length; i++) { const d = xs[i]! - xs[i - 1]!; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}

// ---- §3 return vs the sector index (G5) -------------------------------------------------------------------------------
// Sectoral index closes come from NSE's daily index file (ind_close_all, stored in market.index_daily by the history
// load and the daily job). Constituents are stored only for the broad indices (snapshot INDEX_LISTS), so a company is
// compared with a sectoral index it is a stored constituent of when there is one, else with the index NSE publishes for
// its stored broad sector (classification.sector, D121 / D150). Names as NSE prints them in ind_close_all; matching
// ignores case (NSE has printed both "Nifty 50" and "NIFTY 50").

/** Sectoral indices a stored constituent membership may name, narrowest first (a bank in both Nifty Bank and Nifty
 *  Financial Services is compared with Nifty Bank). */
export const SECTORAL_INDICES = [
  "Nifty PSU Bank", "Nifty Private Bank", "Nifty Bank", "Nifty Financial Services", "Nifty IT", "Nifty Pharma", "Nifty Healthcare Index",
  "Nifty Auto", "Nifty FMCG", "Nifty Metal", "Nifty Oil & Gas", "Nifty Energy", "Nifty Realty", "Nifty Media", "Nifty Consumer Durables", "Nifty Chemicals",
] as const;
/** NSE broad sector → the NIFTY sectoral index of the same scope. A sector not listed has no NSE sectoral index (Capital
 *  Goods, Construction, Construction Materials, Consumer Services, Telecommunication, Services, Textiles, Diversified,
 *  Forest Materials): no comparison, never a thematic or broad index instead. Power → Nifty Energy (NSE's Energy index
 *  covers the oil, gas, consumable fuels and power sectors; NSE publishes no power-only index). */
export const SECTOR_INDEX: Readonly<Record<string, string>> = {
  "Financial Services": "Nifty Financial Services",
  "Information Technology": "Nifty IT",
  "Healthcare": "Nifty Healthcare Index",
  "Automobile and Auto Components": "Nifty Auto",
  "Fast Moving Consumer Goods": "Nifty FMCG",
  "Metals & Mining": "Nifty Metal",
  "Oil Gas & Consumable Fuels": "Nifty Oil & Gas",
  "Power": "Nifty Energy",
  "Realty": "Nifty Realty",
  "Media Entertainment & Publication": "Nifty Media",
  "Consumer Durables": "Nifty Consumer Durables",
  "Chemicals": "Nifty Chemicals",
};
/** Every index_daily name the sector comparison may read (each as listed and upper-cased), for one bound IN list. */
export const sectorIndexNames = (): string[] => [...new Set(SECTORAL_INDICES.flatMap((n) => [n, n.toUpperCase()]))];

/** One company's sector inputs: its stored broad sector (undefined = no classification row, null = Unclassified), the
 *  sectoral indices it is a stored constituent of (any case), and the sectoral closes keyed by upper-cased index name. */
export interface SectorInput { sector: string | null | undefined; members: readonly string[]; closes: ReadonlyMap<string, readonly { date: string; close: number }[]> }

/** Which sectoral index a company is compared with: a stored constituent membership first, else its sector's index. */
export function sectorIndexOf(x: SectorInput | undefined): { index: string; basis: string } | { why: string } {
  if (!x) return { why: "sector index closes not read" };
  const mine = new Set(x.members.map((m) => m.toUpperCase()));
  const member = SECTORAL_INDICES.find((n) => mine.has(n.toUpperCase()));
  if (member) return { index: member, basis: `constituent of ${member}` };
  if (x.sector === undefined) return { why: "no sector stored for this company (no sectoral index membership stored)" };
  if (x.sector === null) return { why: "company is Unclassified (no NSE sector; no sectoral index membership stored)" };
  const index = SECTOR_INDEX[x.sector];
  if (!index) return { why: `NSE publishes no sectoral index for the sector ${x.sector}` };
  return { index, basis: `sector map: NSE sector ${x.sector} (no sectoral index membership stored)` };
}

/** Every §3 field computable from stored sessions (date order, one row per day), as of the last session. */
export function priceFeatures(sessions: readonly Session[], factors: readonly { exDate: string; factor: number }[], benchmark?: readonly { date: string; close: number }[], sector?: SectorInput): { asOf: string | null; rows: PriceFeature[] } {
  const out: PriceFeature[] = [];
  const put = (field: string, value: string | null, reason: string | null = null) => out.push({ field, value, reason: value === null ? reason : null });
  if (!sessions.length) return { asOf: null, rows: out };
  const adj = adjustCloses(sessions, factors);
  const last = sessions.length - 1, asOf = sessions[last]!.date, c = adj[last]!;
  put("close", r2(c)); put("close_raw", r2(sessions[last]!.close));
  const ret = (field: string, base: string, what: string) => {
    const i = onOrBefore(sessions, base);
    if (i < 0) return put(field, null, `no stored close on or before ${base} (${what})`);
    put(field, pct(c, adj[i]!));
  };
  const retOf = (closes: readonly number[], days: readonly { date: string }[], base: string): number | null => {
    const i = onOrBefore(days as Session[], base), j = onOrBefore(days as Session[], asOf);
    return i < 0 || j < 0 ? null : (closes[j]! - closes[i]!) / closes[i]! * 100;
  };
  ret("ret_1w", shift(asOf, -7), "1 week"); ret("ret_1m", shift(asOf, 0, -1), "1 month"); ret("ret_3m", shift(asOf, 0, -3), "3 months");
  ret("ret_6m", shift(asOf, 0, -6), "6 months"); ret("ret_1y", shift(asOf, 0, -12), "1 year"); ret("ret_ytd", `${Number(asOf.slice(0, 4)) - 1}-12-31`, "year to date");
  // relative return (percentage points) against the Nifty 50 over 3 months, on the same session dates
  {
    const base = shift(asOf, 0, -3), me = retOf(adj, sessions, base);
    const nb = benchmark?.length ? retOf(benchmark.map((b) => b.close), benchmark, base) : null;
    const lastB = benchmark?.length ? benchmark[benchmark.length - 1]!.date : null;
    if (me === null) put("ret_vs_nifty_3m", null, `no stored close on or before ${base} (3 months)`);
    else if (nb === null || lastB !== asOf) put("ret_vs_nifty_3m", null, lastB ? `Nifty 50 closes end ${lastB}, the stock's ${asOf}` : "no Nifty 50 closes stored");
    else put("ret_vs_nifty_3m", r2(me - nb));
    // vs the sector index (G5): same base date and as-of session; ret_vs_sector_3m_inputs names the index and the basis
    const sec = (v: string | null, why: string | null, inputs: string | null = null) => { put("ret_vs_sector_3m", v, why); put("ret_vs_sector_3m_inputs", inputs, why); };
    const pick = sectorIndexOf(sector);
    if (me === null) sec(null, `no stored close on or before ${base} (3 months)`);
    else if ("why" in pick) sec(null, pick.why);
    else {
      const cl = sector!.closes.get(pick.index.toUpperCase()) ?? [];
      const lastI = cl.length ? cl[cl.length - 1]!.date : null;
      const ib = cl.length ? retOf(cl.map((x) => x.close), cl, base) : null;
      if (!lastI) sec(null, `no ${pick.index} closes stored (${pick.basis})`);
      else if (lastI !== asOf) sec(null, `${pick.index} closes end ${lastI}, the stock's ${asOf} (${pick.basis})`);
      else if (ib === null) sec(null, `no ${pick.index} close on or before ${base} (${pick.basis})`);
      else sec(r2(me - ib), null, `${pick.index}; ${pick.basis}; company ${r2(me)}%, index ${r2(ib)}% from ${base}`);
    }
  }
  // 52 weeks: sessions after the same date a year earlier; needs the window covered by stored history
  const from = shift(asOf, 0, -12), first = onOrBefore(sessions, from);
  if (first < 0) { put("pct_from_52w_high", null, `stored closes start after ${from}`); put("pct_from_52w_low", null, `stored closes start after ${from}`); }
  else { const w = adj.slice(first + 1); put("pct_from_52w_high", pct(c, Math.max(...w))); put("pct_from_52w_low", pct(c, Math.min(...w))); }
  for (const n of [50, 200]) {
    if (adj.length < n) { put(`dma_${n}`, null, `needs ${n} sessions, ${adj.length} stored`); continue; }
    const m = adj.slice(-n).reduce((a, b) => a + b, 0) / n;
    put(`dma_${n}`, r2(m));
    if (n === 200) put("above_dma_200", c > m ? "1" : "0");
  }
  for (const n of [20, 50, 100, 200]) {
    const e = ema(adj, n);
    put(`ema_${n}`, e === null ? null : r2(e), `needs ${n} sessions, ${adj.length} stored`);
    put(`above_ema_${n}`, e === null ? null : c > e ? "1" : "0", `needs ${n} sessions, ${adj.length} stored`);
  }
  const rs = rsi(adj.slice(-250));
  put("rsi_14", rs === null ? null : r2(rs), "needs 15 sessions");
  // volatility: annualised standard deviation of daily log returns over the last year (√252)
  if (first < 0) put("volatility_1y", null, `stored closes start after ${from}`);
  else {
    const lr: number[] = [];
    for (let i = first + 1; i <= last; i++) lr.push(Math.log(adj[i]! / adj[i - 1]!));
    const mu = lr.reduce((a, b) => a + b, 0) / lr.length;
    const sd = Math.sqrt(lr.reduce((a, b) => a + (b - mu) ** 2, 0) / (lr.length - 1));
    put("volatility_1y", r2(sd * Math.sqrt(252) * 100));
  }
  // liquidity: last 20 sessions (raw: turnover and volume are not adjusted)
  const s20 = sessions.slice(-20);
  if (s20.length < 20) { put("avg_turnover_20d_cr", null, "needs 20 sessions"); put("volume_vs_20d", null, "needs 20 sessions"); }
  else {
    const t = s20.map((s) => s.turnoverRs);
    put("avg_turnover_20d_cr", t.some((x) => x === null) ? null : r2((t as number[]).reduce((a, b) => a + b, 0) / 20 / 1e7), "turnover not filed for a session");
    const v = s20.reduce((a, s) => a + s.volume, 0) / 20;
    put("volume_vs_20d", v > 0 ? r2(sessions[last]!.volume / v) : null, "no volume in the last 20 sessions");
    // delivery % (D65): deliverable quantity ÷ traded quantity over the 20 sessions, every session must carry it
    const dq = s20.map((x) => x.deliverableQty), vol = s20.reduce((a, x) => a + x.volume, 0);
    put("delivery_pct_20d", dq.some((x) => x == null) ? null : vol > 0 ? r2((dq as number[]).reduce((a, b) => a + b, 0) / vol * 100) : null,
      dq.some((x) => x == null) ? "delivery quantity not stored for a session of the last 20" : "no volume in the last 20 sessions");
  }
  return { asOf, rows: out };
}

// ---- §3 surveillance, F&O ban, price band, bulk/block deals (D67, D76) ----------------------
// Read from the stored market-structure tables (ms_day ledger, surveillance, fo_ban, price_band, deal), never downloaded
// here. A flag is "0" only when that source is loaded for the as-of session; otherwise null with the reason.

/** One market-structure ledger row (ms_day): rows = -1 means the file was missing in R2. */
export interface LedgerDay { source: string; d: number; rows: number; note: string | null }
export interface DealRow { kind: "bulk" | "block"; side: "B" | "S"; qty: number; pricePaise: number }
export interface StructureInput {
  asOf: string;                                   // ISO, the last loaded session
  symbol: string | null;                          // NSE symbol valid on asOf
  ledger: readonly LedgerDay[];                   // ms_day: fo_ban / price_band / surveillance on asOf, bulk / block over the deal window
  surveillance: readonly { list: string; stage: string }[]; // lists the symbol is on as of asOf (asm_lt, asm_st, gsm)
  banned: boolean;                                // symbol in fo_ban on asOf
  bands: readonly { series: string; band: string; validFrom: number }[]; // price-band intervals covering asOf
  deals: readonly DealRow[];                      // the security's bulk / block deals in the window
}
export const DEALS_WINDOW_DAYS = 90;
const BAND_SERIES = ["EQ", "BE", "BZ", "SM", "ST"];
const isoOf = (d: number) => `${String(d).slice(0, 4)}-${String(d).slice(4, 6)}-${String(d).slice(6, 8)}`;
const numOf = (iso: string) => Number(iso.replace(/-/g, ""));

/** First day of the deal window: the 90 calendar days ending on (and including) `asOf`. */
export function dealsWindowFrom(asOf: string): string { return shift(asOf, -(DEALS_WINDOW_DAYS - 1)); }

/** Why the ledger does not cover `source` on `asOf` (null = loaded). */
function notLoaded(ledger: readonly LedgerDay[], source: string, asOf: string, what: string): string | null {
  const r = ledger.find((x) => x.source === source && x.d === numOf(asOf));
  if (!r) return `${what} not loaded for ${asOf}`;
  if (r.rows < 0) return `${what} file missing for ${asOf}`;
  return null;
}

/** Why the bulk / block deal ledger does not cover the window (null = complete). */
export function dealsCoverage(ledger: readonly LedgerDay[], asOf: string): string | null {
  const from = numOf(dealsWindowFrom(asOf)), to = numOf(asOf);
  for (const kind of ["bulk", "block"] as const) {
    const days = ledger.filter((x) => x.source === kind && x.d >= from && x.d <= to);
    const gap = notLoaded(days, kind, asOf, `${kind} deals`);
    if (gap) return gap;
    const missing = days.filter((x) => x.rows < 0);
    if (missing.length) return `${kind} deals file missing for ${missing.length} session(s) in the 90 days (first ${isoOf(missing[0]!.d)})`;
    const cut = days.filter((x) => x.note?.startsWith("possibly truncated"));
    if (cut.length) return `${kind} deals possibly truncated (API cap) on ${cut.length} session(s) in the 90 days (first ${isoOf(cut[0]!.d)})`;
  }
  return null;
}

/** in_asm, in_gsm, in_fo_ban, price_band, bulk_block_deals_90d, bulk_block_net_90d_cr (ret_vs_sector_3m: priceFeatures). */
export function structureFeatures(x: StructureInput): PriceFeature[] {
  const out: PriceFeature[] = [];
  const put = (field: string, value: string | null, reason: string | null = null) => out.push({ field, value, reason: value === null ? reason : null });
  const noSym = x.symbol ? null : `no NSE symbol valid on ${x.asOf}`;
  const surv = noSym ?? notLoaded(x.ledger, "surveillance", x.asOf, "ASM / GSM lists");
  put("in_asm", surv ? null : x.surveillance.some((s) => s.list.startsWith("asm")) ? "1" : "0", surv);
  put("in_gsm", surv ? null : x.surveillance.some((s) => s.list === "gsm") ? "1" : "0", surv);
  const ban = noSym ?? notLoaded(x.ledger, "fo_ban", x.asOf, "F&O ban list");
  put("in_fo_ban", ban ? null : x.banned ? "1" : "0", ban);
  const bandGap = noSym ?? notLoaded(x.ledger, "price_band", x.asOf, "price band list");
  // the preferred series' band; when an interval was closed and reopened on the same day, the later one
  const band = [...x.bands].filter((b) => BAND_SERIES.includes(b.series))
    .sort((a, b) => BAND_SERIES.indexOf(a.series) - BAND_SERIES.indexOf(b.series) || b.validFrom - a.validFrom)[0];
  put("price_band", bandGap ? null : band?.band ?? null, bandGap ?? `no price band listed for ${x.symbol} (${BAND_SERIES.join("/")}) on ${x.asOf}`);
  // deals: count and net value (buy − sell, ₹ crore) over the 90 calendar days to the as-of session
  const dealGap = noSym ?? dealsCoverage(x.ledger, x.asOf);
  const net = x.deals.reduce((a, d) => a + (d.side === "B" ? 1 : -1) * d.qty * d.pricePaise, 0) / 100 / 1e7;
  put("bulk_block_deals_90d", dealGap ? null : String(x.deals.length), dealGap);
  put("bulk_block_net_90d_cr", dealGap ? null : r2(net) === "-0.00" ? "0.00" : r2(net), dealGap);
  return out;
}

/** A stored corporate-action purpose that is a buyback: NSE's Bc file writes "BUY BACK" / "BUYBACK" (also inside combined
 *  purposes such as "DIV RS 5/BUY BACK"), its per-company lists "Buyback" / "Buy Back" / "BUY BACK OF SHARES". */
export const BUYBACK_PURPOSE = /buy\s*-?\s*back/i;
/** First day corporate actions are stored (both official sources, D138). */
export const CORP_ACTIONS_FROM = "2024-01-01";

/** Field catalogue §13 (G10): `buyback_12m` ("1"/"0": a buyback with ex/record date in (asOf − 12 months, asOf]) and
 *  `last_buyback_date` (latest such date on or before asOf), from `corp_action.raw_purpose` matched by BUYBACK_PURPOSE.
 *  The stored rows carry no offer price or size (NSE's purpose text is the bare word), so neither is offered. */
export function buybackFeatures(asOf: string, actions: readonly { exDate: string; purpose: string }[]): { field: string; value: string | null; reason: string | null }[] {
  const from = shift(asOf, 0, -12);
  const dates = actions.filter((a) => BUYBACK_PURPOSE.test(a.purpose) && a.exDate <= asOf).map((a) => a.exDate).sort();
  const last = dates[dates.length - 1] ?? null;
  const covered = from >= shift(CORP_ACTIONS_FROM, -1); // the window (from, asOf] lies inside the stored span
  const in12 = dates.some((d) => d > from);
  return [
    { field: "buyback_12m", value: in12 ? "1" : covered ? "0" : null, reason: in12 || covered ? null : `12-month window starts before corporate actions are stored (${CORP_ACTIONS_FROM})` },
    { field: "last_buyback_date", value: last, reason: last ? null : `no buyback stored (corporate actions are stored from ${CORP_ACTIONS_FROM})` },
  ];
}

/** Field catalogue §4: dividend yield over the last twelve months, % of the latest unadjusted close. Dividends with an
 *  ex-date in (asOf − 12 months, asOf] (D7: recorded, never price-adjusted); one paid before a split / bonus inside the
 *  window is put on today's share basis by the applied factors after it ("multiply prices before ex_date by factor").
 *  No dividend in the window gives 0 — corporate actions are loaded daily from 2024 (both official sources, D138). */
export function dividendYieldTtm(asOf: string, closeRaw: number, dividends: readonly { exDate: string; amount: string }[],
  factors: readonly { exDate: string; factor: number }[]): { value: string | null; reason: string | null; dps: number } {
  const from = shift(asOf, 0, -12);
  if (!(closeRaw > 0)) return { value: null, reason: "no close", dps: 0 };
  let dps = 0;
  for (const d of dividends) {
    if (!(d.exDate > from && d.exDate <= asOf)) continue;
    const amt = d.amount.split("+").reduce((a, x) => a + Number(x), 0);
    if (!Number.isFinite(amt)) return { value: null, reason: `dividend amount not readable: ex ${d.exDate} "${d.amount}"`, dps: 0 };
    const k = factors.filter((f) => f.exDate > d.exDate && f.exDate <= asOf).reduce((a, f) => a * f.factor, 1);
    dps += amt * k;
  }
  return { value: r2(dps / closeRaw * 100), reason: null, dps };
}
