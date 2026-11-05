// Field catalogue §3 (price, liquidity & technicals, EOD): computed from stored closes, adjusted for splits / bonus /
// rights by the applied factors (D6: 'auto' and 'confirmed' only; 'review' factors are never applied). Never stored as
// filed data: written to market.price_feature as computed values with their inputs (as-of date, sessions used).

/** One session of one security: ISO date, close and turnover in rupees (raw), volume. */
export interface Session { date: string; close: number; volume: number; turnoverRs: number | null }
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

/** Every §3 field computable from stored sessions (date order, one row per day), as of the last session. */
export function priceFeatures(sessions: readonly Session[], factors: readonly { exDate: string; factor: number }[]): { asOf: string | null; rows: PriceFeature[] } {
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
  ret("ret_1w", shift(asOf, -7), "1 week"); ret("ret_1m", shift(asOf, 0, -1), "1 month"); ret("ret_3m", shift(asOf, 0, -3), "3 months");
  ret("ret_6m", shift(asOf, 0, -6), "6 months"); ret("ret_1y", shift(asOf, 0, -12), "1 year"); ret("ret_ytd", `${Number(asOf.slice(0, 4)) - 1}-12-31`, "year to date");
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
  }
  return { asOf, rows: out };
}
