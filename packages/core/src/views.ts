// Item 6: computed views (D49, D52, D66). Every value here is worked out from filed figures when it is shown and is
// never stored (owner #350, D170). Each answer says what it was built from, or why it is unavailable (no sentinel
// values, D52). Inputs are the stored filed figures exactly as loaded (exact decimals in rupees).
import { type Dec, add, cmp, dec, div, mul, sub, toText } from "./decimal.js";

/** One filed period of one company on one basis: the canonical P&L lines (and, where filed, balance-sheet lines). */
export interface FiledPeriod { periodEnd: string; periodKind: string; basis: string; lines: Record<string, string | null | undefined> }
export type View = { value: string; from: string[]; note?: string } | { value: null; reason: string };

const v = (p: FiledPeriod | undefined, k: string): Dec | null => {
  const x = p?.lines[k];
  return x != null && x !== "" ? dec(x) : null;
};
const ok = (value: Dec, from: string[], note?: string): View => ({ value: toText(value), from, ...(note ? { note } : {}) });
const no = (reason: string): View => ({ value: null, reason });

/** Quarter end three months before a quarter end (YYYY-MM-DD, month ends). */
export function previousQuarterEnd(end: string): string {
  const [y, m] = [Number(end.slice(0, 4)), Number(end.slice(5, 7))];
  const pm = m - 3 <= 0 ? m + 9 : m - 3, py = m - 3 <= 0 ? y - 1 : y;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** D52 / owner #350: TTM = the sum of the four filed quarters ending at `end`, all on `basis`. Unavailable if any one is
 *  missing (never filled from a half-year or year file, D170). */
export function ttm(quarters: FiledPeriod[], line: string, end: string, basis: string): View {
  const by = new Map(quarters.filter((q) => q.periodKind === "Q" && q.basis === basis).map((q) => [q.periodEnd, q]));
  const ends: string[] = [];
  let e = end, sum = dec("0");
  for (let i = 0; i < 4; i++) {
    const x = v(by.get(e), line);
    if (!x) return no(`quarter ${e} (${basis}) has no filed ${line}`);
    sum = add(sum, x); ends.push(e); e = previousQuarterEnd(e);
  }
  return ok(sum, ends.reverse());
}

/** Templates for which EBITDA is not a meaningful figure (D133: no EBITDA for banks; lenders and insurers alike). */
const NO_EBITDA = new Set(["bank", "nbfc", "life_insurance", "general_insurance", "insurance"]);

/** D49: EBITDA excludes other income = revenue − (total expenses − finance costs − depreciation). Industrial companies
 *  only; every input must be filed for the period. */
export function ebitda(p: FiledPeriod, layout = "industrial"): View {
  if (NO_EBITDA.has(layout)) return no(`EBITDA is not used for ${layout} (D49, D133)`);
  const rev = v(p, "revenue"), exp = v(p, "total_expenses"), fin = v(p, "finance_cost"), dep = v(p, "depreciation");
  if (!rev || !exp || !fin || !dep) return no(`${p.periodEnd}: revenue, total expenses, finance costs and depreciation must all be filed`);
  return ok(add(add(sub(rev, exp), fin), dep), [p.periodEnd]);
}

/** D52: adjusted figures exclude exceptional items. Profit before tax has a filed adjusted line (before exceptional
 *  items), so that is used as is. Profit after tax has none: removing the pre-tax exceptional amount ignores its tax,
 *  which the filing does not give, so it is labelled as such. */
export function adjustedPbt(p: FiledPeriod): View {
  const x = v(p, "pbt_before_exceptional");
  return x ? ok(x, [p.periodEnd], "filed: profit before exceptional items and tax") : no(`${p.periodEnd}: profit before exceptional items not filed`);
}
export function adjustedPat(p: FiledPeriod): View {
  const pat = v(p, "pat"), exc = v(p, "exceptional_items");
  if (!pat) return no(`${p.periodEnd}: net profit not filed`);
  if (!exc || exc.units === 0n) return ok(pat, [p.periodEnd], "no exceptional items: equals reported");
  return ok(sub(pat, exc), [p.periodEnd], "exceptional items removed at their pre-tax amount (tax on them is not filed)");
}

/** Percentage a ÷ b × 100 (2 places), unavailable when b is missing or zero. */
export function pct(a: View, b: View, what: string): View {
  if (a.value === null) return a;
  if (b.value === null) return b;
  const d = dec(b.value);
  if (d.units === 0n) return no(`${what}: divisor is zero`);
  return ok(div(mul(dec(a.value), dec("100")), d, 2), [...new Set([...a.from, ...b.from])]);
}

/** D52: return on average capital. Capital at the start and end of the twelve months (balance sheets are filed at
 *  half-year and year ends only). ROE = TTM net profit to owners ÷ average equity to owners. ROCE = TTM EBIT (profit
 *  before exceptional items and tax + finance costs) ÷ average capital employed, where capital employed = total
 *  equity + borrowings (current + non-current). */
export function averageOf(a: Dec | null, b: Dec | null): Dec | null { return a && b ? div(add(a, b), dec("2"), 4) : null; }
export function roe(ttmPatOwners: View, equityStart: string | null, equityEnd: string | null): View {
  const avg = averageOf(equityStart != null ? dec(equityStart) : null, equityEnd != null ? dec(equityEnd) : null);
  if (!avg) return no("equity to owners must be filed at both the start and the end of the twelve months");
  return pct(ttmPatOwners, ok(avg, []), "ROE");
}
export function capitalEmployed(bs: Record<string, string | null | undefined>): Dec | null {
  const eq = bs["x:Equity"] ?? bs.total_equity;
  if (eq == null) return null;
  const parts = ["x:BorrowingsNoncurrent", "x:BorrowingsCurrent"].map((k) => bs[k]);
  if (parts.some((x) => x == null)) return null;
  return parts.reduce((a, x) => add(a, dec(x!)), dec(eq));
}
export function roce(ttmEbit: View, bsStart: Record<string, string | null | undefined> | null, bsEnd: Record<string, string | null | undefined> | null): View {
  const avg = averageOf(bsStart ? capitalEmployed(bsStart) : null, bsEnd ? capitalEmployed(bsEnd) : null);
  if (!avg) return no("equity and borrowings must be filed at both the start and the end of the twelve months");
  return pct(ttmEbit, ok(avg, []), "ROCE");
}

/** D66: a rising trend over the last n values = positive least-squares slope AND at least n − 2 positive changes from
 *  one quarter to the next. Any missing value makes it unavailable (a gap is not a flat quarter). */
export function trend(values: (string | null)[], n: number): { rising: boolean | null; reason?: string } {
  const xs = values.slice(-n);
  if (xs.length < n || xs.some((x) => x == null)) return { rising: null, reason: `needs ${n} filed values in a row` };
  const ys = xs.map((x) => Number(x));
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = ys.reduce((a, y, i) => a + (i - mx) * (y - my), 0);
  const ups = ys.slice(1).filter((y, i) => y > ys[i]!).length;
  return { rising: slope > 0 && ups >= n - 2 };
}

/** D66: a large order is at least 2 % of TTM revenue (unavailable when TTM revenue is). */
export function isLargeOrder(amount: string, ttmRevenue: View): { large: boolean | null; reason?: string } {
  if (ttmRevenue.value === null) return { large: null, reason: ttmRevenue.reason };
  return { large: cmp(mul(dec(amount), dec("50")), dec(ttmRevenue.value)) >= 0 };
}

/** One stored row of the feature table (D171). */
export interface FeatureRow { basis: string; field: string; periodEnd: string; value: string | null; reason: string | null; inputs: string[] }

const QUARTER_KIND = "Q";
const yearBefore = (end: string) => previousQuarterEnd(previousQuarterEnd(previousQuarterEnd(previousQuarterEnd(end))));

/** Growth in % from `base` to `now` (2 places); unavailable when either is missing or the base is not positive. */
export function growth(now: View, base: View, what: string): View {
  if (now.value === null) return now;
  if (base.value === null) return base;
  const b = dec(base.value);
  if (b.units <= 0n) return no(`${what}: base period is zero or a loss`);
  return ok(div(mul(sub(dec(now.value), b), dec("100")), b, 2), [...new Set([...base.from, ...now.from])]);
}

/** The line that stands for "revenue" per format (D38: total income for banks and NBFCs; insurers: not settled). */
function revenueLine(layout: string): string | null {
  return layout === "industrial" ? "revenue" : layout === "bank" || layout === "nbfc" ? "total_income" : null;
}
const ownersLine = (layout: string) => (layout === "bank" ? "pat_after_minority" : "pat_owners");

/** D171: every feature-table value of one company on one basis, from its filed quarters (`periods` with kind Q) and its
 *  balance sheets (`balanceSheets`, by date). `layout` as chosen by chooseLayout. Pure: the caller stores the rows. */
export function companyFeatures(periods: FiledPeriod[], balanceSheets: Map<string, Record<string, string | null | undefined>>, basis: string, layout: string): FeatureRow[] {
  const qs = periods.filter((p) => p.periodKind === QUARTER_KIND && p.basis === basis).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const by = new Map(qs.map((q) => [q.periodEnd, q]));
  const out: FeatureRow[] = [];
  const put = (field: string, periodEnd: string, x: View) => out.push({ basis, field, periodEnd, value: x.value, reason: x.value === null ? x.reason : null, inputs: x.value === null ? [] : x.from });
  const line = (p: FiledPeriod | undefined, k: string | null, end: string): View => {
    if (!k) return no(`no revenue line is defined for ${layout} yet`);
    const x = p ? v(p, k) : null;
    return x ? ok(x, [end]) : no(`quarter ${end} (${basis}) has no filed ${k}`);
  };
  const rev = revenueLine(layout), owners = ownersLine(layout);
  const ebitdaTtm = (end: string): View => {
    let sum = dec("0"); const from: string[] = []; let e = end;
    for (let i = 0; i < 4; i++) { const x = by.get(e) ? ebitda(by.get(e)!, layout) : no(`quarter ${e} (${basis}) not filed`); if (x.value === null) return x; sum = add(sum, dec(x.value)); from.push(e); e = previousQuarterEnd(e); }
    return ok(sum, from.reverse());
  };
  for (const q of qs) {
    const e = q.periodEnd, ya = yearBefore(e), pq = previousQuarterEnd(e);
    const r = line(q, rev, e), p = line(q, "pat", e), po = line(q, owners, e), eb = ebitda(q, layout);
    put("revenue_q", e, r); put("pat_q", e, p); put("pat_owners_q", e, po); put("ebitda_q", e, eb);
    put("ebitda_margin_q", e, pct(eb, r, "EBITDA margin"));
    put("adj_pbt_q", e, adjustedPbt(q)); put("adj_pat_q", e, adjustedPat(q));
    put("revenue_yoy_q", e, growth(r, line(by.get(ya), rev, ya), "revenue YoY"));
    put("pat_yoy_q", e, growth(p, line(by.get(ya), "pat", ya), "PAT YoY"));
    put("revenue_qoq", e, growth(r, line(by.get(pq), rev, pq), "revenue QoQ"));
    put("pat_qoq", e, growth(p, line(by.get(pq), "pat", pq), "PAT QoQ"));
    const rT = rev ? ttm(qs, rev, e, basis) : no(`no revenue line is defined for ${layout} yet`), pT = ttm(qs, "pat", e, basis), poT = ttm(qs, owners, e, basis), eT = ebitdaTtm(e);
    put("revenue_ttm", e, rT); put("pat_ttm", e, pT); put("pat_owners_ttm", e, poT); put("ebitda_ttm", e, eT);
    put("ebitda_margin_ttm", e, pct(eT, rT, "EBITDA margin TTM"));
    put("revenue_ttm_yoy", e, growth(rT, rev ? ttm(qs, rev, ya, basis) : rT, "revenue TTM YoY"));
    put("pat_ttm_yoy", e, growth(pT, ttm(qs, "pat", ya, basis), "PAT TTM YoY"));
    // ROE / ROCE at balance-sheet dates (balance sheets are filed at the half-year and the year end)
    const bsEnd = balanceSheets.get(e), bsStart = balanceSheets.get(ya);
    if (bsEnd) {
      const eq = (b: Record<string, string | null | undefined> | undefined) => (b ? b["x:EquityAttributableToOwnersOfParent"] ?? b.equity_owners ?? (layout === "bank" && b.capital != null && b.reserves != null ? toText(add(dec(b.capital), dec(b.reserves))) : null) ?? null : null);
      put("roe", e, roe(poT, eq(bsStart), eq(bsEnd)));
      if (layout === "industrial") {
        const ebitT = (() => { let s = dec("0"); const f: string[] = []; let k = e; for (let i = 0; i < 4; i++) { const x = by.get(k); const a = x ? v(x, "pbt_before_exceptional") : null, b = x ? v(x, "finance_cost") : null; if (!a || !b) return no(`quarter ${k} (${basis}): profit before exceptional items and finance costs must be filed`); s = add(s, add(a, b)); f.push(k); k = previousQuarterEnd(k); } return ok(s, f.reverse()); })();
        put("roce", e, roce(ebitT, bsStart ?? null, bsEnd));
      } else put("roce", e, no(`ROCE is not used for ${layout}`));
    }
  }
  return out;
}
