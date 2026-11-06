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

/** Equity to owners from a balance sheet: the owners' line; for a standalone statement (no minority) total equity;
 *  for a bank capital + reserves (Third Schedule has no owners' line). */
export function ownersEquity(b: Record<string, string | null | undefined>, basis: string, layout: string): string | null {
  const owners = b["x:EquityAttributableToOwnersOfParent"] ?? b.equity_owners;
  if (owners != null) return owners;
  // life insurers (IRDAI L-3): filed shareholders' funds = capital + share application money + reserves + fair value change
  // account (minority interest shown apart)
  if (layout === "life_insurance") return b["x:ShareholdersFunds"] ?? null;
  // general insurers (IRDAI B-BS): the same parts summed, as there "ShareholdersFunds" is the fair value change account alone
  if (layout === "general_insurance") {
    if (b["x:ShareCapital"] == null || b["x:ReservesAndSurplus"] == null) return null;
    return toText(["x:ShareCapital", "x:ShareApplicationMoneyReceivedPendingAllotmentOfShares", "x:ReservesAndSurplus", "x:ShareholdersFunds"]
      .reduce((a, k) => add(a, dec(b[k] ?? "0")), dec("0")));
  }
  if (layout === "bank" && b.capital != null && b.reserves != null) return toText(add(dec(b.capital), dec(b.reserves)));
  if (basis === "standalone") return b["x:Equity"] ?? b.total_equity ?? null;
  return null;
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
  // owner #360: insurers — gross premium (life), net premium earned (general)
  return layout === "industrial" ? "revenue" : layout === "bank" || layout === "nbfc" ? "total_income"
    : layout === "life_insurance" ? "gross_premium" : layout === "general_insurance" ? "premium_earned" : null;
}
const ownersLine = (layout: string) => (layout === "bank" ? "pat_after_minority" : "pat_owners");

/** D171: every feature-table value of one company on one basis, from its filed quarters (`periods` with kind Q) and its
 *  balance sheets (`balanceSheets`, by date). `layout` as chosen by chooseLayout. Pure: the caller stores the rows. */
/** `cashFlows`: full-year cash-flow lines by year end (period kind FY), for capex and free cash flow. */
export function companyFeatures(periods: FiledPeriod[], balanceSheets: Map<string, Record<string, string | null | undefined>>, basis: string, layout: string, cashFlows: Map<string, Record<string, string | null | undefined>> = new Map()): FeatureRow[] {
  const qs = periods.filter((p) => p.periodKind === QUARTER_KIND && p.basis === basis).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const by = new Map(qs.map((q) => [q.periodEnd, q]));
  const out: FeatureRow[] = [];
  const put = (field: string, periodEnd: string, x: View) => out.push({ basis, field, periodEnd, value: x.value, reason: x.value === null ? x.reason : null, inputs: x.value === null ? [] : x.from });
  const line = (p: FiledPeriod | undefined, k: string | null, end: string): View => {
    if (!k) return no(`no revenue line is defined for ${layout} yet`);
    const x = p ? v(p, k) : null;
    return x ? ok(x, [end]) : no(`quarter ${end} (${basis}) has no filed ${k}`);
  };
  // a standalone statement has no minority share: its net profit is the owners' profit (no owners line is filed)
  const rev = revenueLine(layout), owners = basis === "standalone" ? "pat" : ownersLine(layout);
  const ebitdaTtm = (end: string): View => {
    let sum = dec("0"); const from: string[] = []; let e = end;
    for (let i = 0; i < 4; i++) { const x = by.get(e) ? ebitda(by.get(e)!, layout) : no(`quarter ${e} (${basis}) not filed`); if (x.value === null) return x; sum = add(sum, dec(x.value)); from.push(e); e = previousQuarterEnd(e); }
    return ok(sum, from.reverse());
  };
  // TTM EBIT = profit before exceptional items + finance costs, four filed quarters
  const ebitTtm = (end: string): View => { let s = dec("0"); const f: string[] = []; let k = end; for (let i = 0; i < 4; i++) { const x = by.get(k); const a = x ? v(x, "pbt_before_exceptional") : null, b = x ? v(x, "finance_cost") : null; if (!a || !b) return no(`quarter ${k} (${basis}): profit before exceptional items and finance costs must be filed`); s = add(s, add(a, b)); f.push(k); k = previousQuarterEnd(k); } return ok(s, f.reverse()); };
  // year-on-year growth of one line at one quarter (filed quarter vs the same quarter a year before)
  const yoyAt = (k: string | null, end: string, what: string): View => growth(line(by.get(end), k, end), line(by.get(yearBefore(end)), k, yearBefore(end)), what);
  // field catalogue §5: latest YoY minus the average YoY of the 8 quarters before it (percentage points); all 8 needed
  const vsTrend = (k: string | null, end: string, what: string): View => {
    const now = yoyAt(k, end, what);
    if (now.value === null) return now;
    let s = dec("0"), e2 = end; const from = [...now.from];
    for (let i = 0; i < 8; i++) {
      e2 = previousQuarterEnd(e2);
      const g = yoyAt(k, e2, what);
      if (g.value === null) return no(`needs YoY growth for the 8 quarters before ${end}: ${g.reason}`);
      s = add(s, dec(g.value)); from.push(...g.from);
    }
    return ok(div(sub(dec(now.value), div(s, dec("8"), 6)), dec("1"), 2), [...new Set(from)].sort());
  };
  // TTM ratio of two P&L lines in % (2 places); the divisor must be positive (a loss gives no rate)
  const ttmRatio = (num: string, den: string, end: string, what: string): View => {
    const n = ttm(qs, num, end, basis), d = ttm(qs, den, end, basis);
    if (n.value === null) return n;
    if (d.value === null) return d;
    if (dec(d.value).units <= 0n) return no(`${what}: TTM ${den} is zero or a loss`);
    return pct(n, d, what);
  };
  for (const q of qs) {
    const e = q.periodEnd, ya = yearBefore(e), pq = previousQuarterEnd(e);
    // §5: EPS growth, only when profit ÷ EPS (the implied share count) moved ≤ 25 % between the two quarters — a split,
    // bonus or consolidation in between is not restated in the year-ago filing (C55: no comparative columns stored)
    put("eps_yoy_q", e, epsYoy(q, by.get(ya), owners, e, ya));
    put("revenue_vs_trend_q", e, vsTrend(rev, e, "revenue YoY"));
    put("pat_vs_trend_q", e, vsTrend("pat", e, "PAT YoY"));
    // §6 earnings quality on four filed quarters
    put("effective_tax_rate_ttm", e, ttmRatio("tax", "pbt", e, "effective tax rate"));
    put("other_income_share_pbt_ttm", e, layout === "industrial" ? ttmRatio("other_income", "pbt", e, "other income share of PBT")
      : no(`other income is operating income for ${layout}; the share is used for industrial companies only`));
    put("exceptional_items_ttm", e, exceptionalTtm(qs, e, basis));
    // §6 margin flags (D70; owner 6 Nov: 200 bps), on the quarterly EBITDA margin (industrial companies)
    if (layout === "industrial") for (const f of marginFlags(qs, e, (k) => { const p = by.get(k); return p ? pct(ebitda(p, layout), line(p, rev, k), "EBITDA margin") : no(`quarter ${k} (${basis}) not filed`); })) put(f.field, e, f.view);
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
    // field catalogue §7: interest cover = TTM EBIT ÷ TTM finance costs (industrial; lenders' interest is their cost of goods)
    put("interest_coverage_ttm", e, layout === "industrial" ? interestCover(ebitTtm(e), ttm(qs, "finance_cost", e, basis)) : no(`interest cover is not used for ${layout}`));
    // ROE / ROCE at balance-sheet dates (balance sheets are filed at the half-year and the year end)
    const bsEnd = balanceSheets.get(e), bsStart = balanceSheets.get(ya);
    if (bsEnd) {
      const eq = (b: Record<string, string | null | undefined> | undefined) => (b ? ownersEquity(b, basis, layout) : null);
      // inputs the daily valuation needs (so it reads the feature table, not every stored row: cost trim, owner #360)
      const eo = eq(bsEnd);
      put("equity_owners", e, eo != null ? ok(dec(eo), [`balance sheet ${e}`]) : no(`balance sheet ${e}: equity to owners not filed`));
      put("net_debt", e, netDebt(bsEnd, layout, e));
      put("nci", e, bsEnd["x:NonControllingInterest"] != null ? ok(dec(bsEnd["x:NonControllingInterest"]!), [`balance sheet ${e}`]) : basis === "standalone" ? ok(dec("0"), [`balance sheet ${e}`], "standalone: no minority") : no(`balance sheet ${e}: non-controlling interest not filed`));
      put("roe", e, roe(poT, eq(bsStart), eq(bsEnd)));
      // §6: ROA = TTM net profit (whole group, as the assets are the group's) ÷ average total assets (D52 average capital)
      put("roa", e, roa(pT, bsStart ?? null, bsEnd));
      if (layout === "industrial") {
        put("roce", e, roce(ebitTtm(e), bsStart ?? null, bsEnd));
        put("debt_to_equity", e, debtToEquity(bsEnd, eq(bsEnd), e));
        // field catalogue §7: working capital days on TTM revenue / TTM cost of goods (materials + purchases of stock
        // in trade + change in inventories; a quarter needs materials or purchases filed), and CWIP as filed
        const cogs = cogsTtm(qs, e, basis);
        for (const w of workingCapital(bsEnd, rT, cogs, e)) put(w.field, e, w.view);
        put("cwip", e, bsEnd["x:CapitalWorkInProgress"] != null ? ok(dec(bsEnd["x:CapitalWorkInProgress"]!), [`balance sheet ${e}`]) : no(`balance sheet ${e}: capital work in progress not filed`));
      } else { put("roce", e, no(`ROCE is not used for ${layout}`)); put("debt_to_equity", e, no(`debt to equity is not used for ${layout}`)); }
    }
  }
  // field catalogue §6/§7: capex and free cash flow for each filed full year (cash flow is filed year to date)
  if (layout === "industrial") for (const [end, cf] of cashFlows) {
    const capex = cf["x:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"], cfo = cf.cfo;
    put("capex_fy", end, capex != null ? ok(abs(dec(capex)), [`cash flow FY to ${end}`]) : no(`cash flow FY to ${end}: purchase of property, plant and equipment not filed`));
    put("fcf_fy", end, capex != null && cfo != null ? ok(sub(dec(cfo), abs(dec(capex))), [`cash flow FY to ${end}`]) : no(`cash flow FY to ${end}: operating cash flow or capex not filed`));
    // §6: operating cash flow ÷ net profit for the full year (cash flow is filed year to date, so full years only)
    const fyPat = periods.find((p) => p.periodKind === "FY" && p.basis === basis && p.periodEnd === end)?.lines.pat;
    put("ocf_to_pat_fy", end, cfo == null ? no(`cash flow FY to ${end}: operating cash flow not filed`)
      : fyPat == null ? no(`full year to ${end}: net profit not filed`)
      : dec(fyPat).units <= 0n ? no(`full year to ${end}: net profit is zero or a loss`)
      : ok(div(dec(cfo), dec(fyPat), 2), [`cash flow FY to ${end}`, `P&L FY to ${end}`]));
  }
  if (layout === "bank") out.push(...bankFeatures(qs, balanceSheets, basis));
  if (qs.length) put("layout", "latest", { value: layout, from: [] });
  return out;
}

/** Bank pack (owner, 6 Nov: "must have bank specific one for bank"). Third Schedule lines as filed; every ratio says
 *  what it was built from. Net interest margin here is COMPUTED (TTM NII ÷ average interest-earning assets at the two
 *  balance-sheet dates a year apart) and is not the bank's own reported NIM; CASA, slippages and restructured book are
 *  not in the results filings and are not offered. */
export function bankFeatures(qs: FiledPeriod[], balanceSheets: Map<string, Record<string, string | null | undefined>>, basis: string): FeatureRow[] {
  const out: FeatureRow[] = [];
  const put = (field: string, periodEnd: string, x: View) => out.push({ basis, field, periodEnd, value: x.value, reason: x.value === null ? x.reason : null, inputs: x.value === null ? [] : x.from });
  const by = new Map(qs.map((q) => [q.periodEnd, q]));
  const nii = (e: string): View => { const q = by.get(e), a = v(q, "interest_earned"), b = v(q, "interest_expended"); return a && b ? ok(sub(a, b), [e]) : no(`quarter ${e} (${basis}): interest earned and interest expended must be filed`); };
  const sum4 = (f: (e: string) => View, end: string): View => { let s = dec("0"), e = end; const from: string[] = []; for (let i = 0; i < 4; i++) { const x = f(e); if (x.value === null) return x; s = add(s, dec(x.value)); from.push(e); e = previousQuarterEnd(e); } return ok(s, from.reverse()); };
  const lineQ = (k: string) => (e: string): View => { const x = v(by.get(e), k); return x ? ok(x, [e]) : no(`quarter ${e} (${basis}) has no filed ${k}`); };
  const filedPct = (k: string, e: string): View => lineQ(k)(e);
  const bsv = (d: string, k: string) => { const x = balanceSheets.get(d)?.[k]; return x != null ? dec(x) : null; };
  for (const q of qs) {
    const e = q.periodEnd, ya = yearBefore(e);
    const n = nii(e);
    put("nii_q", e, n);
    put("nii_yoy_q", e, growth(n, nii(ya), "NII YoY"));
    put("ppop_q", e, lineQ("operating_profit")(e));
    put("ppop_yoy_q", e, growth(lineQ("operating_profit")(e), lineQ("operating_profit")(ya), "operating profit YoY"));
    put("gnpa_pct_q", e, filedPct("gnpa_pct", e));
    put("nnpa_pct_q", e, filedPct("nnpa_pct", e));
    put("cet1_ratio_q", e, filedPct("cet1_ratio", e));
    const g = v(q, "gross_npa"), nn = v(q, "net_npa");
    put("pcr_q", e, g && nn ? (g.units > 0n ? ok(div(mul(sub(g, nn), dec("100")), g, 2), [e], "provision coverage = (gross NPA − net NPA) ÷ gross NPA; excludes technical write-offs") : no(`quarter ${e}: gross NPA is zero`)) : no(`quarter ${e} (${basis}): gross and net NPA amounts must be filed`));
    const niiT = sum4(nii, e), oiT = sum4(lineQ("other_income"), e), opexT = sum4(lineQ("operating_expenses"), e), provT = sum4(lineQ("provisions"), e);
    put("nii_ttm", e, niiT);
    put("cost_to_income_ttm", e, niiT.value === null ? niiT : oiT.value === null ? oiT : pct(opexT, ok(add(dec(niiT.value), dec(oiT.value)), [...niiT.from]), "cost to income"));
    // balance-sheet dates (half-year and year end): credit cost, computed NIM, loan / deposit growth, CD ratio
    if (balanceSheets.has(e)) {
      const avg = (k: string[]) => { const a = k.reduce<Dec | null>((s, x) => { const y = bsv(e, x); return s && y ? add(s, y) : null; }, dec("0")), b = k.reduce<Dec | null>((s, x) => { const y = bsv(ya, x); return s && y ? add(s, y) : null; }, dec("0")); return averageOf(a, b); };
      const adv = avg(["advances"]), iea = avg(["advances", "investments", "cash_rbi", "balances_banks"]);
      put("credit_cost_ttm", e, provT.value === null ? provT : adv ? pct(provT, ok(adv, [`balance sheets ${ya}, ${e}`]), "credit cost") : no(`advances must be filed at ${ya} and ${e}`));
      put("nim_computed_ttm", e, niiT.value === null ? niiT : iea ? { ...pct(niiT, ok(iea, [`balance sheets ${ya}, ${e}`]), "NIM"), note: "computed: TTM NII ÷ average of advances + investments + cash with RBI + balances with banks; not the bank's reported NIM" } as View : no(`advances, investments, cash with RBI and balances with banks must be filed at ${ya} and ${e}`));
      const a1 = bsv(e, "advances"), a0 = bsv(ya, "advances"), d1 = bsv(e, "deposits"), d0 = bsv(ya, "deposits");
      put("advances_yoy", e, a1 && a0 ? growth(ok(a1, [`balance sheet ${e}`]), ok(a0, [`balance sheet ${ya}`]), "advances YoY") : no(`advances must be filed at ${ya} and ${e}`));
      put("deposits_yoy", e, d1 && d0 ? growth(ok(d1, [`balance sheet ${e}`]), ok(d0, [`balance sheet ${ya}`]), "deposits YoY") : no(`deposits must be filed at ${ya} and ${e}`));
      put("cd_ratio", e, a1 && d1 && d1.units > 0n ? ok(div(mul(a1, dec("100")), d1, 2), [`balance sheet ${e}`]) : no(`advances and deposits must be filed at ${e}`));
    }
  }
  return out;
}

/** Field catalogue §5: EPS growth year on year (basic EPS, 2 places). Guard: the implied share count (profit to owners ÷
 *  EPS) must move by ≤ 25 % between the two quarters; a bigger move means a split, bonus or consolidation that the
 *  year-ago filing does not reflect, and the comparison is withheld rather than shown wrong. */
export function epsYoy(now: FiledPeriod, ago: FiledPeriod | undefined, ownersLineKey: string, end: string, agoEnd: string): View {
  const e1 = v(now, "eps_basic"), e0 = v(ago, "eps_basic");
  if (!e1) return no(`quarter ${end}: basic EPS not filed`);
  if (!e0) return no(`quarter ${agoEnd}: basic EPS not filed`);
  if (e0.units <= 0n) return no("EPS YoY: base quarter EPS is zero or a loss");
  const p1 = v(now, ownersLineKey), p0 = v(ago, ownersLineKey);
  if (!p1 || !p0 || e1.units === 0n) return no(`profit to owners and EPS must be filed in both quarters (share-count check)`);
  const s1 = Number(toText(p1)) / Number(toText(e1)), s0 = Number(toText(p0)) / Number(toText(e0)), r = s1 / s0;
  if (!Number.isFinite(r) || r <= 0) return no(`share-count check not possible for ${agoEnd} → ${end}: profit to owners is zero or of the opposite sign to EPS (readiness map, 6 Nov)`);
  if (!(r > 0.8 && r < 1.25)) return no(`implied share count changed ×${r.toFixed(2)} between ${agoEnd} and ${end} (split, bonus or consolidation likely; the earlier EPS is not restated)`);
  return growth(ok(e1, [end]), ok(e0, [agoEnd]), "EPS YoY");
}

/** Field catalogue §6 / D70 margin flags (1 = yes, 0 = no), owner 6 Nov: 200 bps.
 *  erosion: the margin is ≥ 2.00 percentage points below the peak of the 8 quarters before it, or it fell in each of the
 *  last two quarters. recovery: the margin rose in each of the last two quarters from a quarter that was the low of its
 *  own trailing four. Quarter-on-quarter, so seasonal businesses can trip them; every quarter used must be filed. */
export const MARGIN_EROSION_BPS = 200;
export function marginFlags(_qs: FiledPeriod[], end: string, marginAt: (end: string) => View): { field: string; view: View }[] {
  const ends: string[] = [end]; for (let i = 0; i < 10; i++) ends.push(previousQuarterEnd(ends[ends.length - 1]!));
  const m = ends.map((k) => marginAt(k)); // m[0] = this quarter, m[i] = i quarters back
  const n = (i: number) => (m[i]!.value === null ? null : Number(m[i]!.value));
  const need = (idx: number[], what: string): View | null => { const bad = idx.find((i) => n(i) === null); return bad === undefined ? null : no(`${what}: margin for ${ends[bad]} not available (${(m[bad] as { reason: string }).reason})`); };
  const from = (idx: number[]) => idx.map((i) => ends[i]!).sort();
  const twoDown = () => n(0)! < n(1)! && n(1)! < n(2)!;
  // erosion
  const ei = [0, 1, 2, 3, 4, 5, 6, 7, 8], eMiss = need(ei, "margin erosion");
  const erosion: View = eMiss ?? (() => {
    const peak = Math.max(...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => n(i)!));
    const yes = (peak - n(0)!) * 100 >= MARGIN_EROSION_BPS || twoDown();
    return ok(dec(yes ? "1" : "0"), from(ei), `peak of the 8 quarters before: ${peak.toFixed(2)} %; threshold ${MARGIN_EROSION_BPS} bps or two falls in a row`);
  })();
  // recovery: m2 is the low of m2..m5 and m2 < m1 < m0
  const ri = [0, 1, 2, 3, 4, 5], rMiss = need(ri, "margin recovery");
  const recovery: View = rMiss ?? (() => {
    const low = n(2)! <= Math.min(n(3)!, n(4)!, n(5)!);
    const yes = low && n(2)! < n(1)! && n(1)! < n(0)!;
    return ok(dec(yes ? "1" : "0"), from(ri), "rose in each of the last two quarters from a trailing-4-quarter low");
  })();
  return [{ field: "margin_erosion", view: erosion }, { field: "margin_recovery", view: recovery }];
}

/** Field catalogue §6: exceptional items over four filed quarters. A quarter that files no exceptional line but files
 *  profit before tax counts as none (as adjusted PAT does); profit before tax − profit before exceptional items is
 *  used when only those two are filed. */
export function exceptionalTtm(qs: FiledPeriod[], end: string, basis: string): View {
  const by = new Map(qs.filter((q) => q.basis === basis && q.periodKind === "Q").map((q) => [q.periodEnd, q]));
  let s = dec("0"), k = end, none = 0; const from: string[] = [];
  for (let i = 0; i < 4; i++) {
    const q = by.get(k), x = v(q, "exceptional_items"), pbt = v(q, "pbt"), pbe = v(q, "pbt_before_exceptional");
    if (x) s = add(s, x);
    else if (pbt && pbe) s = add(s, sub(pbt, pbe));
    else if (pbt) none++;
    else return no(`quarter ${k} (${basis}): profit before tax not filed`);
    from.push(k); k = previousQuarterEnd(k);
  }
  return ok(s, from.reverse(), none ? `${none} quarter(s) file no exceptional line: taken as none` : undefined);
}

/** Field catalogue §6: ROA = TTM net profit ÷ average total assets at the start and end of the twelve months (%). */
export function roa(ttmPat: View, bsStart: Record<string, string | null | undefined> | null, bsEnd: Record<string, string | null | undefined>): View {
  const ta = (b: Record<string, string | null | undefined> | null) => { const x = b ? b.total_assets ?? b["x:Assets"] : null; return x != null ? dec(x) : null; };
  const avg = averageOf(ta(bsStart), ta(bsEnd));
  if (!avg) return no("total assets must be filed at both the start and the end of the twelve months");
  return pct(ttmPat, ok(avg, []), "ROA");
}

/** Field catalogue §7: TTM EBIT ÷ TTM finance costs, 2 places; unavailable when there are no finance costs. */
export function interestCover(ebit: View, finance: View): View {
  if (ebit.value === null) return ebit;
  if (finance.value === null) return finance;
  if (dec(finance.value).units <= 0n) return no("no finance costs in the last four quarters");
  return ok(div(dec(ebit.value), dec(finance.value), 2), [...new Set([...ebit.from, ...finance.from])]);
}

/** Field catalogue §7: gross borrowings (current + non-current) ÷ equity to owners at a balance-sheet date, 2 places
 *  (industrial only; minority interest left out of the equity, as for ROE). */
export function debtToEquity(b: Record<string, string | null | undefined>, owners: string | null, date: string): View {
  const miss = ["x:BorrowingsNoncurrent", "x:BorrowingsCurrent"].filter((k) => b[k] == null);
  if (miss.length) return no(`balance sheet ${date} lacks ${miss.join(", ")}`);
  if (owners == null) return no(`balance sheet ${date}: equity to owners not filed`);
  if (dec(owners).units <= 0n) return no(`balance sheet ${date}: equity to owners is zero or negative`);
  return ok(div(add(dec(b["x:BorrowingsNoncurrent"]!), dec(b["x:BorrowingsCurrent"]!)), dec(owners), 2), [`balance sheet ${date}`]);
}

const abs = (d: Dec) => (d.units < 0n ? sub(dec("0"), d) : d);

/** TTM cost of goods: four filed quarters of materials + purchases of stock in trade + change in inventories. */
export function cogsTtm(qs: FiledPeriod[], end: string, basis: string): View {
  const by = new Map(qs.filter((q) => q.basis === basis && q.periodKind === "Q").map((q) => [q.periodEnd, q]));
  let s = dec("0"); const from: string[] = []; let k = end;
  for (let i = 0; i < 4; i++) {
    const q = by.get(k);
    if (!q || (q.lines.materials == null && q.lines.purchases_stock_in_trade == null)) return no(`quarter ${k} (${basis}): materials or purchases of stock in trade must be filed`);
    for (const l of ["materials", "purchases_stock_in_trade", "inventory_change"]) if (q.lines[l] != null) s = add(s, dec(q.lines[l]!));
    from.push(k); k = previousQuarterEnd(k);
  }
  return ok(s, from.reverse());
}

/** Receivable, inventory and payable days and working-capital days at a balance-sheet date (365-day year, 1 place). */
export function workingCapital(b: Record<string, string | null | undefined>, revenueTtm: View, cogs: View, date: string): { field: string; view: View }[] {
  const line = (k: string, what: string): View => (b[k] != null ? ok(dec(b[k]!), [`balance sheet ${date}`]) : no(`balance sheet ${date}: ${what} not filed`));
  const days = (x: View, base: View, what: string): View => {
    if (x.value === null) return x;
    if (base.value === null) return base;
    if (dec(base.value).units <= 0n) return no(`${what}: TTM base is zero or negative`);
    return ok(div(mul(dec(x.value), dec("365")), dec(base.value), 1), [...new Set([...x.from, ...base.from])]);
  };
  const rec = days(line("x:TradeReceivablesCurrent", "trade receivables"), revenueTtm, "receivable days");
  const inv = days(line("x:Inventories", "inventories"), cogs, "inventory days");
  const pay = days(line("x:TradePayablesCurrent", "trade payables"), cogs, "payable days");
  // cash conversion cycle (catalogue §7): receivable + inventory − payable days, the last two on cost of goods — none for
  // companies with no cost of goods (services)
  const ccc: View = rec.value === null ? rec : inv.value === null ? inv : pay.value === null ? pay
    : ok(sub(add(dec(rec.value), dec(inv.value)), dec(pay.value)), [...new Set([...rec.from, ...inv.from, ...pay.from])]);
  // working-capital days: (trade receivables + inventories − trade payables) ÷ TTM revenue × 365, so asset-light companies
  // get one too (INFY check, 6 Nov); an inventories line that is not filed counts as none (noted)
  let wc: View;
  if (b["x:TradeReceivablesCurrent"] == null || b["x:TradePayablesCurrent"] == null) wc = no(`balance sheet ${date}: trade receivables and trade payables must be filed`);
  else if (revenueTtm.value === null) wc = revenueTtm;
  else if (dec(revenueTtm.value).units <= 0n) wc = no("working-capital days: TTM revenue is zero or negative");
  else {
    const net = sub(add(dec(b["x:TradeReceivablesCurrent"]!), dec(b["x:Inventories"] ?? "0")), dec(b["x:TradePayablesCurrent"]!));
    wc = ok(div(mul(net, dec("365")), dec(revenueTtm.value), 1), [...new Set([`balance sheet ${date}`, ...revenueTtm.from])], b["x:Inventories"] == null ? "no inventories line filed: taken as none" : undefined);
  }
  return [{ field: "receivable_days", view: rec }, { field: "inventory_days", view: inv }, { field: "payable_days", view: pay }, { field: "cash_conversion_cycle", view: ccc }, { field: "working_capital_days", view: wc }];
}

/** Net debt for EV (industrial only): borrowings (current + non-current) − cash and cash equivalents − other bank
 *  balances; investments are not netted (documented). */
export function netDebt(b: Record<string, string | null | undefined>, layout: string, date: string): View {
  if (layout !== "industrial") return no(`net debt is not used for ${layout}`);
  const need = ["x:BorrowingsNoncurrent", "x:BorrowingsCurrent", "x:CashAndCashEquivalents", "x:BankBalanceOtherThanCashAndCashEquivalents"];
  const miss = need.filter((k) => b[k] == null);
  if (miss.length) return no(`balance sheet ${date} lacks ${miss.join(", ")}`);
  const d = (k: string) => dec(b[k]!);
  return ok(sub(sub(add(d("x:BorrowingsNoncurrent"), d("x:BorrowingsCurrent")), d("x:CashAndCashEquivalents")), d("x:BankBalanceOtherThanCashAndCashEquivalents")), [`balance sheet ${date}`]);
}

/** Valuation inputs for one company on one basis: the latest available TTM figures and balance-sheet values, each as
 *  stored in the feature table (with the periods they came from). */
export interface ValuationInputs {
  mcapRs: string; mcapDate: string; layout: string;
  patOwnersTtm: View; revenueTtm: View; ebitdaTtm: View;
  equityOwners: View; netDebt: View; nci: View;
}
/** D171 / field catalogue §4: valuation on the latest close. Market cap is NSE's own figure (D5), never adjusted.
 *  Stored under period_end 'latest'; P/E is also kept per trading day (owner #360) for its own-history comparison. */
export function valuationFeatures(basis: string, x: ValuationInputs): FeatureRow[] {
  const mcap = dec(x.mcapRs), rows: FeatureRow[] = [];
  const put = (field: string, r: View, periodEnd = "latest") => rows.push({ basis, field, periodEnd, value: r.value, reason: r.value === null ? r.reason : null, inputs: r.value === null ? [] : r.from });
  const close = `close ${x.mcapDate}: market cap ₹${x.mcapRs}`;
  const ratio = (num: Dec, den: View, what: string, positive = true): View => {
    if (den.value === null) return den;
    const d = dec(den.value);
    if (d.units === 0n || (positive && d.units < 0n)) return no(`${what}: the denominator is ${d.units === 0n ? "zero" : "negative (a loss)"}`);
    return ok(div(num, d, 2), [close, ...den.from]);
  };
  const pe = ratio(mcap, x.patOwnersTtm, "P/E");
  put("pe_ttm_rep", pe);
  put("pe_ttm_rep", pe, x.mcapDate); // daily history
  put("pe_ttm", no("adjusted profit to owners is not filed (the tax and minority share of exceptional items are not given); use pe_ttm_rep"));
  put("earnings_yield", x.patOwnersTtm.value === null ? x.patOwnersTtm : mcap.units === 0n ? no("market cap is zero") : ok(div(mul(dec(x.patOwnersTtm.value), dec("100")), mcap, 2), [close, ...x.patOwnersTtm.from]));
  put("mcap_to_sales_ttm", ratio(mcap, x.revenueTtm, "market cap to sales"));
  put("pb", ratio(mcap, x.equityOwners, "P/B"));
  // EV/EBITDA: industrial companies only (no EBITDA for lenders and insurers, D49). EV = market cap + net debt + NCI.
  if (x.layout !== "industrial") put("ev_ebitda_ttm", no(`EV/EBITDA is not used for ${x.layout}`));
  else if (x.netDebt.value === null) put("ev_ebitda_ttm", x.netDebt);
  else if (x.nci.value === null) put("ev_ebitda_ttm", x.nci);
  else {
    const r = ratio(add(add(mcap, dec(x.netDebt.value)), dec(x.nci.value)), x.ebitdaTtm, "EV/EBITDA");
    put("ev_ebitda_ttm", r.value === null ? r : { ...r, from: [...new Set([...r.from, ...x.netDebt.from])] });
  }
  return rows;
}

/** Field catalogue §4: P/E against the median P/E of the company's sector among the companies compared (%: +20 = 20 %
 *  above). "Industry" is NSE's broad sector (D121): the finer industry text leaves most groups of the 250 with one or two
 *  companies. Only positive P/Es count (a loss has none); a sector needs at least `minN` of them, else no median. */
export function peVsSectorMedian(rows: readonly { sid: number; sector: string | null; pe: string | null }[], minN = 5): Map<number, View & { median?: string; n?: number }> {
  const bySector = new Map<string, number[]>();
  for (const r of rows) if (r.sector && r.pe != null && Number(r.pe) > 0) (bySector.get(r.sector) ?? bySector.set(r.sector, []).get(r.sector)!).push(Number(r.pe));
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2; };
  const out = new Map<number, View & { median?: string; n?: number }>();
  for (const r of rows) {
    if (!r.sector) { out.set(r.sid, no("no sector stored for this company")); continue; }
    if (r.pe == null || !(Number(r.pe) > 0)) { out.set(r.sid, no("no P/E (a loss or a missing figure)")); continue; }
    const xs = bySector.get(r.sector)!;
    if (xs.length < minN) { out.set(r.sid, no(`sector ${r.sector}: only ${xs.length} companies with a P/E (needs ${minN})`)); continue; }
    const m = med(xs);
    out.set(r.sid, { value: (Math.round((Number(r.pe) / m - 1) * 10000) / 100).toFixed(2), from: [`sector ${r.sector}: median P/E ${m.toFixed(2)} of ${xs.length} companies`], median: m.toFixed(2), n: xs.length });
  }
  return out;
}
