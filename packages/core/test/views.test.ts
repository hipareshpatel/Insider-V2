import { describe, expect, it } from "vitest";
import { adjustedPat, adjustedPbt, capitalEmployed, companyFeatures, nbfcSubtype, insurerFeatures, insurerInvestments, marginFlags, peVsSectorMedian, valuationFeatures, ebitda, isLargeOrder, ownersEquity, previousQuarterEnd, roce, roe, trend, ttm, type FiledPeriod } from "../src/index.js";

const q = (periodEnd: string, lines: Record<string, string>, basis = "consolidated"): FiledPeriod => ({ periodEnd, periodKind: "Q", basis, lines });
const four = [q("2025-12-31", { revenue: "100" }), q("2026-03-31", { revenue: "110" }), q("2026-06-30", { revenue: "120" }), q("2026-09-30", { revenue: "130" })];

describe("item 6: computed views (worked out when shown, never stored)", () => {
  it("quarter ends step back three months, month ends kept", () => {
    expect(previousQuarterEnd("2026-03-31")).toBe("2025-12-31");
    expect(previousQuarterEnd("2026-09-30")).toBe("2026-06-30");
    expect(previousQuarterEnd("2026-06-30")).toBe("2026-03-31");
  });
  it("TTM = four filed quarters on one basis; unavailable if one is missing or on another basis", () => {
    expect(ttm(four, "revenue", "2026-09-30", "consolidated")).toEqual({ value: "460", from: ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"] });
    expect(ttm(four.filter((x) => x.periodEnd !== "2026-03-31"), "revenue", "2026-09-30", "consolidated")).toEqual({ value: null, reason: "quarter 2026-03-31 (consolidated) has no filed revenue" });
    expect(ttm(four, "revenue", "2026-09-30", "standalone").value).toBeNull();
    // a half-year or full-year period never stands in for a quarter (D170)
    const withHalf = [...four.slice(0, 2), { ...four[2]!, periodKind: "H" }, four[3]!];
    expect(ttm(withHalf, "revenue", "2026-09-30", "consolidated").value).toBeNull();
  });
  it("EBITDA (D49) excludes other income; not used for lenders and insurers", () => {
    // INFY Sep 2026 consolidated (₹): 492,440 m revenue, 390,290 m expenses, 1,150 m finance, 13,590 m depreciation
    const infy = q("2026-09-30", { revenue: "492440000000", total_expenses: "390290000000", finance_cost: "1150000000", depreciation: "13590000000", other_income: "8480000000" });
    expect(ebitda(infy)).toEqual({ value: "116890000000", from: ["2026-09-30"] });
    expect(ebitda(infy, "bank").value).toBeNull();
    expect(ebitda(q("2026-09-30", { revenue: "1" })).value).toBeNull();
  });
  it("adjusted PBT is the filed line; adjusted PAT says the tax on exceptional items is not filed", () => {
    expect(adjustedPbt(q("x", { pbt_before_exceptional: "90" }))).toMatchObject({ value: "90" });
    expect(adjustedPat(q("x", { pat: "70", exceptional_items: "0" }))).toMatchObject({ value: "70", note: "no exceptional items: equals reported" });
    expect(adjustedPat(q("x", { pat: "70", exceptional_items: "-10" }))).toMatchObject({ value: "80" });
    expect((adjustedPat(q("x", { pat: "70", exceptional_items: "-10" })) as { note: string }).note).toMatch(/tax on them is not filed/);
  });
  it("ROE / ROCE on average capital; unavailable without both balance sheets", () => {
    expect(roe({ value: "20", from: ["q"] }, "90", "110")).toMatchObject({ value: "20" });
    expect(roe({ value: "20", from: ["q"] }, null, "110").value).toBeNull();
    const bs = (eq: string, b1: string, b2: string) => ({ "x:Equity": eq, "x:BorrowingsNoncurrent": b1, "x:BorrowingsCurrent": b2 });
    expect(capitalEmployed(bs("100", "30", "20"))?.units).toBe(150n);
    expect(roce({ value: "30", from: ["q"] }, bs("100", "30", "20"), bs("100", "30", "20"))).toMatchObject({ value: "20" });
    expect(roce({ value: "30", from: ["q"] }, { "x:Equity": "100" }, bs("100", "30", "20")).value).toBeNull();
  });
  it("rising trend (D66): positive slope and at least n − 2 rises; a gap makes it unavailable", () => {
    expect(trend(["1", "2", "3", "4"], 4).rising).toBe(true);
    expect(trend(["1", "3", "2", "4"], 4).rising).toBe(true);
    expect(trend(["4", "1", "5", "2"], 4).rising).toBe(false);
    expect(trend(["1", null, "3", "4"], 4).rising).toBeNull();
  });
  it("large order (D66): at least 2 % of TTM revenue", () => {
    const t = { value: "1000", from: [] };
    expect(isLargeOrder("20", t).large).toBe(true);
    expect(isLargeOrder("19.99", t).large).toBe(false);
    expect(isLargeOrder("20", { value: null, reason: "quarter missing" }).large).toBeNull();
  });
});

describe("item 6: feature-table values for one company (D171)", () => {
  const qs = ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"].map((e, i) =>
    ({ periodEnd: e, periodKind: "Q", basis: "consolidated", lines: { revenue: String(100 + 10 * i), total_expenses: String(70 + 5 * i), finance_cost: "2", depreciation: "3",
      pat: String(20 + i), pat_owners: String(19 + i), pbt_before_exceptional: String(28 + i), exceptional_items: "0" } }));
  const bs = new Map([["2025-09-30", { "x:EquityAttributableToOwnersOfParent": "400", "x:Equity": "420", "x:BorrowingsNoncurrent": "50", "x:BorrowingsCurrent": "30" }],
    ["2026-09-30", { "x:EquityAttributableToOwnersOfParent": "500", "x:Equity": "520", "x:BorrowingsNoncurrent": "50", "x:BorrowingsCurrent": "30" }]]);
  const rows = companyFeatures(qs, bs, "consolidated", "industrial");
  const at = (f: string, e: string) => rows.find((r) => r.field === f && r.periodEnd === e)!;
  it("TTM, EBITDA, margin and growth from the filed quarters, each with its inputs", () => {
    expect(at("revenue_ttm", "2026-09-30")).toMatchObject({ value: "540", inputs: ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"] });
    expect(at("revenue_ttm", "2025-12-31")).toMatchObject({ value: null });
    expect(at("revenue_ttm", "2025-12-31").reason).toMatch(/2025-03-31/);
    // EBITDA = revenue − expenses + finance + depreciation: 150 − 95 + 5 = 60
    expect(at("ebitda_q", "2026-09-30").value).toBe("60");
    expect(at("ebitda_margin_q", "2026-09-30").value).toBe("40");
    expect(at("revenue_yoy_q", "2026-09-30").value).toBe("36.36"); // 150 vs 110
    expect(at("revenue_qoq", "2026-09-30").value).toBe("7.14"); // 150 vs 140
  });
  it("ROE on average equity to owners at balance-sheet dates; ROCE on average capital employed", () => {
    // TTM PAT to owners to Sep 2026 = 21+22+23+24 = 90; average equity (400+500)/2 = 450 → 20 %
    expect(at("roe", "2026-09-30").value).toBe("20");
    // TTM EBIT = (pbt_be + finance) = 30+31+32+33 + 4×2 = 134; capital employed 500 and 600 → avg 550 → 24.36 %
    expect(at("roce", "2026-09-30").value).toBe("24.36");
    expect(rows.some((r) => r.field === "roe" && r.periodEnd === "2026-06-30")).toBe(false); // no balance sheet that date
  });
  it("interest cover = TTM EBIT ÷ TTM finance costs; debt to equity = borrowings ÷ equity to owners", () => {
    // TTM EBIT to Sep 2026 = 134 (above); finance costs 4 × 2 = 8 → 16.75
    expect(at("interest_coverage_ttm", "2026-09-30")).toMatchObject({ value: "16.75" });
    expect(at("interest_coverage_ttm", "2025-12-31").value).toBeNull(); // not four quarters yet
    // borrowings 50 + 30 = 80 ÷ owners' equity 500 = 0.16
    expect(at("debt_to_equity", "2026-09-30")).toMatchObject({ value: "0.16", inputs: ["balance sheet 2026-09-30"] });
    const noDebt = companyFeatures(qs.map((x) => ({ ...x, lines: { ...x.lines, finance_cost: "0" } })), bs, "consolidated", "industrial");
    expect(noDebt.find((r) => r.field === "interest_coverage_ttm" && r.periodEnd === "2026-09-30")!.reason).toMatch(/no finance costs/);
    const bank = companyFeatures(qs, bs, "consolidated", "bank");
    expect(bank.find((r) => r.field === "debt_to_equity")!.reason).toMatch(/not used for bank/);
  });
  it("working-capital days on TTM revenue and TTM cost of goods; capex and free cash flow per full year", () => {
    const q2 = qs.map((x) => ({ ...x, lines: { ...x.lines, materials: "50" } })); // TTM COGS = 200
    const bs2 = new Map([...bs].map(([k, v]) => [k, { ...v, "x:TradeReceivablesCurrent": "54", "x:Inventories": "40", "x:TradePayablesCurrent": "20", "x:CapitalWorkInProgress": "7" }]));
    const cf = new Map([["2026-03-31", { "x:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities": "-30", cfo: "100" }]]);
    const r = companyFeatures(q2, bs2, "consolidated", "industrial", cf);
    const g = (f: string, e: string) => r.find((x) => x.field === f && x.periodEnd === e)!;
    expect(g("receivable_days", "2026-09-30").value).toBe("36.5"); // 54 × 365 ÷ 540
    expect(g("inventory_days", "2026-09-30").value).toBe("73");    // 40 × 365 ÷ 200
    expect(g("payable_days", "2026-09-30").value).toBe("36.5");
    expect(g("cash_conversion_cycle", "2026-09-30").value).toBe("73"); // 36.5 + 73 − 36.5
    expect(g("working_capital_days", "2026-09-30").value).toBe("50"); // (54 + 40 − 20) × 365 ÷ 540 = 50.0
    // services company: no cost of goods → no inventory / payable days or cycle, but working-capital days on revenue
    const svc = companyFeatures(qs, new Map([...bs].map(([k, v]) => [k, { ...v, "x:TradeReceivablesCurrent": "54", "x:TradePayablesCurrent": "9" }])), "consolidated", "industrial");
    const sv = (f: string) => svc.find((x) => x.field === f && x.periodEnd === "2026-09-30")!;
    expect(sv("cash_conversion_cycle").value).toBeNull();
    expect(sv("working_capital_days").value).toBe("30.4"); // (54 − 9) × 365 ÷ 540
    expect(g("cwip", "2026-09-30").value).toBe("7");
    expect(g("capex_fy", "2026-03-31").value).toBe("30");
    expect(g("fcf_fy", "2026-03-31").value).toBe("70");
    expect(companyFeatures(qs, bs2, "consolidated", "industrial").find((x) => x.field === "inventory_days")!.reason).toMatch(/materials or purchases/);
  });
  it("§5 EPS growth with the share-count guard; growth vs the 8 quarters before", () => {
    // 13 quarters 2023-09 … 2026-09; revenue grows 10 % a year until the last quarter (+30 %: 157.3 vs 121)
    const ends: string[] = []; let e = "2026-09-30";
    for (let i = 0; i < 13; i++) { ends.unshift(e); e = previousQuarterEnd(e); }
    const lines = (i: number, eps: string) => ({ revenue: i === 12 ? "157.3" : ["100", "110", "121"][Math.floor(i / 4)]!, pat: "10", pat_owners: "10", eps_basic: eps });
    const series = ends.map((en, i) => q(en, lines(i, i >= 4 ? "2" : "1")));
    const r = companyFeatures(series, new Map(), "consolidated", "industrial");
    const g = (f: string, en: string) => r.find((x) => x.field === f && x.periodEnd === en)!;
    expect(g("revenue_vs_trend_q", "2026-09-30").value).toBe("20"); // 30 % now vs 10 % average
    expect(g("revenue_vs_trend_q", "2026-06-30").reason).toMatch(/8 quarters before/); // not enough history
    // EPS doubled while profit stayed 10: the share count halved (×0.5) → withheld, never shown as +100 %
    expect(g("eps_yoy_q", "2024-09-30").reason).toMatch(/share count changed ×0.50/);
    // zero profit to owners in both quarters: 0 ÷ 0 — a reason, never "NaN"
    const z = companyFeatures(ends.map((en, i) => q(en, { ...lines(i, "1"), pat: "0", pat_owners: "0" })), new Map(), "consolidated", "industrial"); // a true zero profit
    expect(z.find((x) => x.field === "eps_yoy_q" && x.periodEnd === "2026-09-30")!.reason).toMatch(/share-count check not possible/);
    // same share count: plain growth
    const ok2 = companyFeatures(ends.map((en, i) => q(en, { ...lines(i, "1"), pat: String(10 + i), pat_owners: String(10 + i), eps_basic: String((10 + i) / 10) })), new Map(), "consolidated", "industrial");
    expect(ok2.find((x) => x.field === "eps_yoy_q" && x.periodEnd === "2026-09-30")!.value).toBe("22.22"); // EPS 2.2 vs 1.8, share count 10 both
  });
  it("§6 margin flags: erosion at 200 bps below the 8-quarter peak or two falls; recovery from a 4-quarter low", () => {
    const ends: string[] = ["2026-09-30"]; for (let i = 0; i < 10; i++) ends.push(previousQuarterEnd(ends[ends.length - 1]!));
    const flags = (ms: (number | null)[]) => Object.fromEntries(marginFlags([], ends[0]!, (k) => {
      const x = ms[ends.indexOf(k)];
      return x == null ? { value: null, reason: "not filed" } : { value: String(x), from: [k] };
    }).map((f) => [f.field, f.view.value ?? f.view.reason]));
    // newest first: 18 now vs a 20.5 peak → 250 bps below → erosion; not two rises → no recovery
    expect(flags([18, 19, 18.5, 20.5, 19, 19, 19, 19, 19])).toMatchObject({ margin_erosion: "1", margin_recovery: "0" });
    // 150 bps below the peak, no two falls → no erosion
    expect(flags([19, 18, 18.5, 20.5, 19, 19, 19, 19, 19]).margin_erosion).toBe("0");
    // rose twice from 15, the low of its trailing four → recovery
    expect(flags([17, 16, 15, 18, 19, 20, 20, 20, 20]).margin_recovery).toBe("1");
    expect(flags([17, 16, 15, null, 19, 20, 20, 20, 20]).margin_recovery).toMatch(/not available/);
  });
  it("§6 tax rate, other-income share, exceptional items, ROA and OCF ÷ PAT", () => {
    const qs6 = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"].map((en) => q(en, { revenue: "100", pat: "30", pbt: "40", tax: "10", other_income: "4" }));
    qs6[1]!.lines.exceptional_items = "-2";
    const bs6 = new Map([["2025-09-30", { total_assets: "1000" }], ["2026-09-30", { total_assets: "1400" }]]);
    const cf = new Map([["2026-03-31", { cfo: "90" }]]);
    const fy = { periodEnd: "2026-03-31", periodKind: "FY", basis: "consolidated", lines: { pat: "120" } };
    const r = companyFeatures([...qs6, fy], bs6, "consolidated", "industrial", cf);
    const g = (f: string, en: string) => r.find((x) => x.field === f && x.periodEnd === en)!;
    expect(g("effective_tax_rate_ttm", "2026-09-30").value).toBe("25");
    expect(g("other_income_share_pbt_ttm", "2026-09-30").value).toBe("10");
    expect(g("exceptional_items_ttm", "2026-09-30").value).toBe("-2");
    expect(g("roa", "2026-09-30").value).toBe("10"); // 120 ÷ 1,200
    expect(g("ocf_to_pat_fy", "2026-03-31").value).toBe("0.75");
    const bank = companyFeatures(qs6, new Map(), "consolidated", "bank");
    expect(bank.find((x) => x.field === "other_income_share_pbt_ttm")!.reason).toMatch(/industrial companies only/);
    const loss = companyFeatures(qs6.map((x) => ({ ...x, lines: { ...x.lines, pbt: "-5" } })), new Map(), "consolidated", "industrial");
    expect(loss.find((x) => x.field === "effective_tax_rate_ttm" && x.periodEnd === "2026-09-30")!.reason).toMatch(/zero or a loss/);
  });
  it("a bank gets no EBITDA or ROCE (reasons stored) and uses total income as revenue", () => {
    const bank = qs.map((q) => ({ ...q, lines: { total_income: q.lines.revenue, pat: q.lines.pat, pat_after_minority: q.lines.pat_owners } }));
    const b = companyFeatures(bank, new Map(), "consolidated", "bank");
    expect(b.find((r) => r.field === "ebitda_q")!.reason).toMatch(/not used for bank/);
    expect(b.find((r) => r.field === "revenue_ttm" && r.periodEnd === "2026-09-30")!.value).toBe("540");
  });
});

describe("item 6: valuation on the latest close (D171)", () => {
  const base = { mcapRs: "1000", mcapDate: "2026-11-04", layout: "industrial",
    patOwnersTtm: { value: "50", from: ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"] }, revenueTtm: { value: "400", from: ["q"] }, ebitdaTtm: { value: "100", from: ["q"] },
    equityOwners: { value: "250", from: ["balance sheet 2026-09-30"] }, netDebt: { value: "50", from: ["balance sheet 2026-09-30"] }, nci: { value: "10", from: ["balance sheet 2026-09-30"] } };
  const get = (rows: ReturnType<typeof valuationFeatures>, f: string) => rows.find((r) => r.field === f)!;
  it("P/E, earnings yield, P/B, market cap to sales and EV/EBITDA, each naming the close and the periods used", () => {
    const r = valuationFeatures("consolidated", base);
    expect(get(r, "pe_ttm_rep")).toMatchObject({ value: "20", periodEnd: "latest" });
    expect(get(r, "pe_ttm_rep").inputs[0]).toBe("close 2026-11-04: market cap ₹1000");
    expect(get(r, "earnings_yield").value).toBe("5");
    expect(get(r, "pb").value).toBe("4");
    expect(get(r, "mcap_to_sales_ttm").value).toBe("2.5");
    // EV = 1000 + 60 + 40 − 30 − 20 + 10 = 1060 → ÷ 100
    expect(get(r, "ev_ebitda_ttm").value).toBe("10.6");
    expect(get(r, "pe_ttm").reason).toMatch(/adjusted profit to owners is not filed/);
    // daily history row (owner #360)
    expect(r.find((x) => x.field === "pe_ttm_rep" && x.periodEnd === "2026-11-04")!.value).toBe("20");
  });
  it("a loss, a missing quarter and a bank are stated, never turned into a number", () => {
    const loss = valuationFeatures("consolidated", { ...base, patOwnersTtm: { value: "-5", from: ["q"] } });
    expect(get(loss, "pe_ttm_rep").reason).toMatch(/negative \(a loss\)/);
    expect(get(loss, "earnings_yield").value).toBe("-0.5");
    const gap = valuationFeatures("consolidated", { ...base, revenueTtm: { value: null, reason: "quarter 2026-03-31 (consolidated) has no filed revenue" } });
    expect(get(gap, "mcap_to_sales_ttm").reason).toMatch(/2026-03-31/);
    const bank = valuationFeatures("consolidated", { ...base, layout: "bank", netDebt: { value: null, reason: "net debt is not used for bank" } });
    expect(get(bank, "ev_ebitda_ttm").reason).toMatch(/not used for bank/);
    expect(get(bank, "pb").value).toBe("4");
  });
});

describe("feature build stores the valuation inputs (owner #360 cost trim) and the insurer revenue base", () => {
  it("equity to owners, net debt and NCI at balance-sheet dates; layout; insurers use gross premium / premium earned", () => {
    const qs = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"].map((e) => ({ periodEnd: e, periodKind: "Q", basis: "consolidated", lines: { revenue: "100", pat: "20", pat_owners: "19", gross_premium: "300", premium_earned: "250" } }));
    const bs = new Map([["2026-09-30", { "x:EquityAttributableToOwnersOfParent": "500", "x:BorrowingsNoncurrent": "60", "x:BorrowingsCurrent": "40", "x:CashAndCashEquivalents": "30", "x:BankBalanceOtherThanCashAndCashEquivalents": "20", "x:NonControllingInterest": "10" }]]);
    const rows = companyFeatures(qs, bs, "consolidated", "industrial");
    const at = (f: string, e: string) => rows.find((r) => r.field === f && r.periodEnd === e);
    expect(at("equity_owners", "2026-09-30")!.value).toBe("500");
    expect(at("net_debt", "2026-09-30")!.value).toBe("50");
    expect(at("nci", "2026-09-30")!.value).toBe("10");
    expect(at("layout", "latest")!.value).toBe("industrial");
    expect(companyFeatures(qs, new Map(), "consolidated", "life_insurance").find((r) => r.field === "revenue_ttm" && r.periodEnd === "2026-09-30")!.value).toBe("1200");
    expect(companyFeatures(qs, new Map(), "consolidated", "general_insurance").find((r) => r.field === "revenue_ttm" && r.periodEnd === "2026-09-30")!.value).toBe("1000");
  });
});

describe("standalone statements have no owners' line (live INFY check, 5 Nov)", () => {
  it("standalone owners' profit is net profit and equity to owners is total equity", () => {
    const qs = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"].map((e) => ({ periodEnd: e, periodKind: "Q", basis: "standalone", lines: { revenue: "100", pat: "20" } }));
    const bs = new Map([["2025-09-30", { "x:Equity": "180" }], ["2026-09-30", { "x:Equity": "220" }]]);
    const rows = companyFeatures(qs, bs, "standalone", "industrial");
    expect(rows.find((r) => r.field === "pat_owners_ttm" && r.periodEnd === "2026-09-30")!.value).toBe("80");
    expect(rows.find((r) => r.field === "roe" && r.periodEnd === "2026-09-30")!.value).toBe("40"); // 80 ÷ avg 200
    // consolidated with no balance sheet stored: no evidence of "no minority", so no owners' profit is assumed
    const cons = companyFeatures(qs.map((q) => ({ ...q, basis: "consolidated" })), new Map(), "consolidated", "industrial");
    expect(cons.find((r) => r.field === "pat_owners_ttm" && r.periodEnd === "2026-09-30")!.value).toBeNull();
  });
});

describe("owners' equity by layout", () => {
  it("insurers use IRDAI shareholders' funds (either basis); industrial consolidated needs the owners' line", () => {
    expect(ownersEquity({ "x:ShareholdersFunds": "193977400000" }, "consolidated", "life_insurance")).toBe("193977400000");
    // ICICIGI Sep 2026: capital + share application money + reserves + FV change (shareholders) = 1,88,233.4 (₹ million)
    expect(ownersEquity({ "x:ShareCapital": "4996100000", "x:ShareApplicationMoneyReceivedPendingAllotmentOfShares": "34300000", "x:ReservesAndSurplus": "175056900000",
      "x:ShareholdersFunds": "8146100000" }, "standalone", "general_insurance")).toBe("188233400000");
    expect(ownersEquity({ "x:ShareholdersFunds": "8146100000" }, "standalone", "general_insurance")).toBeNull(); // never the FV change account alone
    expect(ownersEquity({}, "standalone", "life_insurance")).toBeNull();
    expect(ownersEquity({ "x:Equity": "5" }, "consolidated", "industrial")).toBeNull();
    expect(ownersEquity({ capital: "1", reserves: "2" }, "consolidated", "bank")).toBe("3");
  });
});

describe("§4 P/E vs the sector median", () => {
  it("median of positive P/Es per sector, at least 5; a loss or a small sector gives a reason", () => {
    const rows = [10, 20, 30, 40, 50].map((pe, i) => ({ sid: i + 1, sector: "IT", pe: String(pe) }))
      .concat([{ sid: 6, sector: "IT", pe: null as unknown as string }, { sid: 7, sector: "Power", pe: "15" }, { sid: 8, sector: null as unknown as string, pe: "9" }]);
    const r = peVsSectorMedian(rows);
    expect(r.get(1)!.value).toBe("-66.67"); // 10 vs median 30
    expect(r.get(5)!.value).toBe("66.67");
    expect(r.get(6)!.value).toBeNull();
    expect((r.get(7) as { reason: string }).reason).toMatch(/only 1 companies/);
    expect((r.get(8) as { reason: string }).reason).toMatch(/no sector/);
  });
});

describe("bank pack (owner 6 Nov)", () => {
  it("NII, cost to income, credit cost, computed NIM, NPA ratios, PCR, loan / deposit growth, CD ratio", () => {
    const ends = ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"];
    const qs = ends.map((e) => ({ periodEnd: e, periodKind: "Q", basis: "standalone", lines: {
      interest_earned: "100", interest_expended: "60", other_income: "10", operating_expenses: "25", operating_profit: "25", provisions: "5",
      pat: "15", total_income: "110", gnpa_pct: "2.1", nnpa_pct: "0.5", cet1_ratio: "14.2", gross_npa: "200", net_npa: "50" } }));
    const bs = new Map([["2025-09-30", { advances: "800", deposits: "1000", investments: "300", cash_rbi: "50", balances_banks: "50", total_assets: "1300", capital: "10", reserves: "140" }],
      ["2026-09-30", { advances: "1000", deposits: "1200", investments: "300", cash_rbi: "50", balances_banks: "50", total_assets: "1500", capital: "10", reserves: "160" }]]);
    const r = companyFeatures(qs, bs, "standalone", "bank");
    const g = (f: string) => r.find((x) => x.field === f && x.periodEnd === "2026-09-30")!;
    expect(g("nii_q").value).toBe("40");
    expect(g("nii_ttm").value).toBe("160");
    expect(g("cost_to_income_ttm").value).toBe("50");    // 100 ÷ (160 + 40)
    expect(g("credit_cost_ttm").value).toBe("2.22");     // 20 ÷ avg(800, 1000)
    expect(g("nim_computed_ttm").value).toBe("12.31");   // 160 ÷ avg(1200, 1400) = 160 ÷ 1300
    expect(g("pcr_q").value).toBe("75");
    expect(g("gnpa_pct_q").value).toBe("2.1");
    expect(g("advances_yoy").value).toBe("25");
    expect(g("deposits_yoy").value).toBe("20");
    expect(g("cd_ratio").value).toBe("83.33");
    expect(companyFeatures(qs, bs, "standalone", "industrial").some((x) => x.field === "nii_q")).toBe(false);
  });
});

describe("NBFC pack (owner #389, Division III lines as filed)", () => {
  const ends = ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"];
  const qs = ends.map((e, i) => ({ periodEnd: e, periodKind: "Q", basis: "standalone", lines: {
    interest_earned: String(100 + 10 * i), fees_commission_income: "20", total_income: String(135 + 10 * i), finance_cost: "50",
    impairment_financial_instruments: "6", total_expenses: "90", pbt: "40", tax: "10", pat: "30", debt_equity_ratio: "4.1" } }));
  const bs = new Map<string, Record<string, string>>([
    ["2025-09-30", { "x:Loans": "800", "x:Investments": "100", "x:DebtSecurities": "400", "x:Borrowings": "300", "x:FinancialLiabilities": "750", "x:Equity": "200", "x:Assets": "1000" }],
    ["2026-09-30", { "x:Loans": "1000", "x:Investments": "100", "x:DebtSecurities": "500", "x:Borrowings": "350", "x:Deposits": "50", "x:FinancialLiabilities": "950", "x:Equity": "250", "x:Assets": "1250" }]]);
  it("NII, net total income, opex, cost to income, credit cost, computed NIM, loan / borrowing growth, debt to equity", () => {
    const r = companyFeatures(qs, bs, "standalone", "nbfc");
    const g = (f: string) => r.find((x) => x.field === f && x.periodEnd === "2026-09-30")!;
    expect(g("nii_q")).toMatchObject({ value: "100", inputs: ["2026-09-30"] }); // 150 − 50
    expect(g("nii_yoy_q").value).toBe("66.67");                // 100 vs 110 − 50 = 60
    expect(g("nii_ttm").value).toBe("340");                    // (120 + 130 + 140 + 150) − 4 × 50
    expect(g("net_total_income_ttm").value).toBe("480");       // (155 + 165 + 175 + 185) − 200
    expect(g("opex_ttm").value).toBe("136");                   // 4 × (90 − 50 − 6)
    expect(g("cost_to_income_ttm").value).toBe("28.33");       // 136 ÷ 480
    expect(g("credit_cost_ttm")).toMatchObject({ value: "2.67", inputs: ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30", "balance sheets 2025-09-30, 2026-09-30"] }); // 24 ÷ avg(800, 1000)
    expect(g("nim_computed_ttm").value).toBe("34");            // 340 ÷ avg(900, 1100)
    expect(g("loans_yoy").value).toBe("25");
    expect(g("borrowings_yoy").value).toBe("28.57");           // 900 vs 700 (deposits / subordinated not filed in 2025: none)
    expect(g("debt_to_equity").value).toBe("3.6");             // 900 ÷ 250
    expect(g("debt_equity_filed_q").value).toBe("4.1");
    expect(r.filter((x) => x.field === "debt_to_equity" && x.periodEnd === "2026-09-30")).toHaveLength(1);
    // not offered from the results files: no sentinel rows for them
    for (const f of ["gnpa_pct_q", "nnpa_pct_q", "crar_q", "aum_yoy"]) expect(r.some((x) => x.field === f)).toBe(false);
    expect(companyFeatures(qs, bs, "standalone", "industrial").some((x) => x.field === "nii_q")).toBe(false);
  });
  it("a missing line or balance sheet gives a reason, never a number", () => {
    const gap = qs.map((q) => (q.periodEnd === "2026-03-31" ? { ...q, lines: { ...q.lines, impairment_financial_instruments: undefined } } : q));
    const noFl = new Map([...bs].map(([d, b]) => [d, d === "2025-09-30" ? { ...b, "x:FinancialLiabilities": undefined, "x:Loans": undefined } : b]));
    const r = companyFeatures(gap, noFl, "standalone", "nbfc");
    const g = (f: string) => r.find((x) => x.field === f && x.periodEnd === "2026-09-30")!;
    expect(g("opex_ttm")).toMatchObject({ value: null, reason: expect.stringMatching(/2026-03-31.*impairment/) });
    expect(g("credit_cost_ttm").reason).toMatch(/2026-03-31.*impairment_financial_instruments/);
    expect(g("nii_ttm").value).toBe("340");
    expect(g("loans_yoy").reason).toMatch(/loans must be filed at 2025-09-30/);
    expect(g("borrowings_yoy").reason).toMatch(/2025-09-30: Division III financial liabilities not filed/);
    expect(g("debt_to_equity").value).toBe("3.6");
    expect(g("nim_computed_ttm").reason).toMatch(/loans and investments must be filed/);
  });
  it("G18: sub-type by NSE symbol — the named holding companies, AMCs and the lessor; every other filer a lender", () => {
    for (const s of ["BAJAJHLDNG", "BAJAJFINSV", "TATAINVEST", "MFSL"]) expect(nbfcSubtype([s])).toBe("holding");
    for (const s of ["HDFCAMC", "NAM-INDIA", "ICICIAMC"]) expect(nbfcSubtype([s])).toBe("amc");
    expect(nbfcSubtype(["IRFC"])).toBe("lessor");
    for (const s of ["BAJFINANCE", "CHOLAFIN", "SHRIRAMFIN", "LICHSGFIN", "PFC", "RECLTD", "MUTHOOTFIN"]) expect(nbfcSubtype([s])).toBe("lender");
    expect(nbfcSubtype([])).toBe("lender");
    expect(nbfcSubtype(["OLDSYM", "nam-india"])).toBe("amc"); // any symbol it traded under
  });
  const lending = ["nii_q", "nii_yoy_q", "nii_ttm", "credit_cost_ttm", "nim_computed_ttm", "loans_yoy", "borrowings_yoy"];
  for (const [subtype, label] of [["holding", "holding company"], ["amc", "asset manager"], ["lessor", "lessor"]] as const) {
    it(`G18: a ${label} gets the lending fields as a reason, keeps net total income, opex and the debt ratios`, () => {
      const r = companyFeatures(qs, bs, "standalone", "nbfc", new Map(), subtype);
      const g = (f: string) => r.find((x) => x.field === f && x.periodEnd === "2026-09-30")!;
      for (const f of lending) expect(g(f), f).toMatchObject({ value: null, reason: `not used for ${label} (Division III filer, not a lender)`, inputs: [] });
      for (const f of lending) expect(r.filter((x) => x.field === f).every((x) => x.value === null), f).toBe(true);
      expect(g("net_total_income_ttm").value).toBe("480");
      expect(g("opex_ttm").value).toBe("136");
      expect(g("cost_to_income_ttm").value).toBe("28.33"); // kept: opex ÷ net total income is meaningful for non-lenders too
      expect(g("debt_to_equity").value).toBe("3.6");
      expect(g("debt_equity_filed_q").value).toBe("4.1");
      expect(r.find((x) => x.field === "nbfc_subtype")).toMatchObject({ periodEnd: "latest", value: subtype });
    });
  }
  it("G18: a lender is unchanged (default and explicit) and labelled lender", () => {
    const strip = (rs: ReturnType<typeof companyFeatures>) => rs.filter((x) => x.field !== "nbfc_subtype");
    const d = companyFeatures(qs, bs, "standalone", "nbfc"), l = companyFeatures(qs, bs, "standalone", "nbfc", new Map(), "lender");
    expect(l).toEqual(d);
    expect(strip(d).find((x) => x.field === "nii_ttm" && x.periodEnd === "2026-09-30")!.value).toBe("340");
    expect(d.find((x) => x.field === "nbfc_subtype")).toMatchObject({ periodEnd: "latest", value: "lender" });
    expect(companyFeatures(qs, bs, "standalone", "industrial", new Map(), "holding").some((x) => x.field === "nbfc_subtype")).toBe(false);
  });
});

describe("gap census fixes (6 Nov)", () => {
  const qs = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"].map((e) => ({ periodEnd: e, periodKind: "Q", basis: "consolidated", lines: { revenue: "100", pat: "10" } as Record<string, string> }));
  const eqBs = (nci?: string) => new Map(["2025-09-30", "2026-03-31", "2026-09-30"].map((d) => [d, { "x:Equity": nci ? "520" : "500", "x:EquityAttributableToOwnersOfParent": "500", ...(nci ? { "x:NonControllingInterest": nci } : {}) }]));
  const ttmAt = (r: ReturnType<typeof companyFeatures>) => r.find((x) => x.field === "pat_owners_ttm" && x.periodEnd === "2026-09-30")!.value;
  it("no minority on the quarter's balance sheet: profit to owners = net profit (labelled); not with an NCI on it", () => {
    const r = companyFeatures(qs, eqBs(), "consolidated", "industrial");
    expect(ttmAt(r)).toBe("40");
    expect(r.find((x) => x.field === "owners_profit_source")!.value).toBe("net profit");
    expect(ttmAt(companyFeatures(qs, eqBs("20"), "consolidated", "industrial"))).toBeNull();
    // no balance sheet at all: no evidence, nothing assumed
    expect(ttmAt(companyFeatures(qs, new Map(), "consolidated", "industrial"))).toBeNull();
  });
  it("filed owners' figures are kept; only missing quarters are filled", () => {
    const mixed = qs.map((q, i) => ({ ...q, lines: { ...q.lines, pat: "100000000", ...(i < 2 ? { pat_owners: "100050000" } : {}) } }));
    expect(ttmAt(companyFeatures(mixed, eqBs(), "consolidated", "industrial"))).toBe("400100000"); // two filed + two filled
  });
  it("owners' profit filed as 0 with non-zero net profit (NESTLEIND, OBEROIRLTY) is not a figure: filled from net profit", () => {
    const zeros = qs.map((q, i) => (i < 2 ? { ...q, lines: { ...q.lines, pat_owners: "0", pat_nci: "0" } } : q));
    const r = companyFeatures(zeros, eqBs(), "consolidated", "industrial");
    expect(ttmAt(r)).toBe("40");
    expect(r.find((x) => x.field === "pat_owners_q" && x.periodEnd === "2025-12-31")!.value).toBe("10");
  });
  it("owners' figure missing but profit to NCI filed: owners = net profit − NCI (even with a minority on the balance sheet)", () => {
    const r = companyFeatures(qs.map((q) => ({ ...q, lines: { ...q.lines, pat_nci: "2" } })), eqBs("20"), "consolidated", "industrial");
    expect(ttmAt(r)).toBe("32");
  });
  it("insurer (IRDAI) with shareholders' funds and no minority line: profit to owners = net profit", () => {
    const ins = new Map(["2025-09-30", "2026-03-31", "2026-09-30"].map((d) => [d, { "x:ShareholdersFunds": "500" }]));
    expect(ttmAt(companyFeatures(qs.map((q) => ({ ...q, lines: { gross_premium: "100", pat: "10" } })), ins, "consolidated", "life_insurance"))).toBe("40");
  });
  it("NCI = total equity − equity to owners when no NCI line is filed", () => {
    const r = companyFeatures(qs.map((q) => ({ ...q, lines: { ...q.lines, pat_owners: "9" } })), new Map([["2026-09-30", { "x:Equity": "520", "x:EquityAttributableToOwnersOfParent": "500" }]]), "consolidated", "industrial");
    expect(r.find((x) => x.field === "nci" && x.periodEnd === "2026-09-30")!.value).toBe("20");
  });
});

describe("insurer pack (owner #389, Part 2 G3: IRDAI lines as filed)", () => {
  const ends = ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"];
  const unique = (r: ReturnType<typeof companyFeatures>) => new Set(r.map((x) => `${x.field}|${x.periodEnd}`)).size === r.length;
  // life: first-year + renewal + single = gross premium (the filed identity holds in every quarter)
  const life = ends.map((e, i) => ({ periodEnd: e, periodKind: "Q", basis: "standalone", lines: {
    gross_premium: String(1000 + 100 * i), net_premium: String(980 + 100 * i), premium_first_year: String(200 + 20 * i), premium_single: "100",
    premium_renewal: String(700 + 80 * i), investment_income_policyholders: "50", expenses_of_management: "120", pat: "30" } as Record<string, string | undefined> }));
  // HDFCLIFE Sep 2026 standalone (filed; the three investment lines add to its filed "Investments" 40,96,725.5 ₹ m); a year before: hand-made
  const lifeBs = new Map<string, Record<string, string | undefined>>([
    ["2025-09-30", { "x:ShareholdersFunds": "170000000000", "x:ApplicationOfFunds": "2700000000000", "x:InvestmentsShareholders": "200000000000", "x:InvestmentsPolicyholders": "2400000000000" }],
    ["2026-09-30", { "x:ShareholdersFunds": "193977400000", "x:ApplicationOfFunds": "4124862500000", "x:InvestmentsShareholders": "219010000000",
      "x:InvestmentsPolicyholders": "2733618200000", "x:AssetsHeldToCoverLinkLiabilities": "1144097300000" }]]);
  it("life: premium growth and TTM, new business premium, expenses of management ratio, shareholders' funds and investments", () => {
    const r = companyFeatures(life, lifeBs, "standalone", "life_insurance");
    const g = (f: string) => r.find((x) => x.field === f && x.periodEnd === "2026-09-30")!;
    expect(g("gross_premium_yoy_q")).toMatchObject({ value: "36.36", inputs: ["2025-09-30", "2026-09-30"] }); // 1,500 vs 1,100
    expect(g("net_premium_yoy_q").value).toBe("37.04");                // 1,480 vs 1,080
    expect(g("gross_premium_ttm").value).toBe("5400");                 // 1,200 + 1,300 + 1,400 + 1,500
    expect(g("net_premium_ttm").value).toBe("5320");
    expect(g("gross_premium_ttm_yoy")).toMatchObject({ value: null, reason: expect.stringMatching(/2025-03-31.*gross_premium/) }); // year-ago TTM needs 2024-12, 2025-03
    expect(g("new_business_premium_q")).toMatchObject({ value: "400" }); // 300 + 100
    expect(g("new_business_premium_yoy_q").value).toBe("25");          // 400 vs 220 + 100
    expect(g("new_business_premium_ttm").value).toBe("1480");          // (240 + 260 + 280 + 300) + 4 × 100
    expect(g("renewal_premium_yoy_q").value).toBe("41.03");            // 1,100 vs 780
    expect(g("expenses_of_management_ratio_computed_q").value).toBe("8"); // 120 ÷ 1,500
    expect(g("expenses_of_management_ratio_computed_ttm").value).toBe("8.89"); // 480 ÷ 5,400
    expect(g("investment_income_policyholders_ttm").value).toBe("200");
    expect(g("shareholders_funds_yoy").value).toBe("14.1");            // 19,397.74 vs 17,000 ₹ cr
    expect(g("investments_total")).toMatchObject({ value: "4096725500000", inputs: ["balance sheet 2026-09-30"] });
    expect(g("investments_yoy")).toMatchObject({ value: "57.57", inputs: ["balance sheet 2025-09-30", "balance sheet 2026-09-30"] }); // vs 2,00,000 + 24,00,000 (no linked line filed: none)
    // general-insurer fields are not offered for a life insurer; no field is given twice for one date
    for (const f of ["claims_ratio_computed_q", "combined_ratio_computed_ttm", "underwriting_result_ttm", "investment_income_ttm"]) expect(r.some((x) => x.field === f)).toBe(false);
    expect(r.filter((x) => x.field === "debt_to_equity" && x.periodEnd === "2026-09-30")).toHaveLength(1);
    expect(unique(r)).toBe(true);
    // the generic rows still carry profit growth and the premium revenue base (not repeated in the pack)
    expect(g("revenue_ttm").value).toBe("5400");
    expect(companyFeatures(life, lifeBs, "standalone", "industrial").some((x) => x.field === "gross_premium_ttm")).toBe(false);
  });
  it("notes say what is computed and what a missing part was taken as", () => {
    const rows = insurerFeatures(life, lifeBs, "standalone", "life_insurance");
    expect(rows.some((x) => x.field === "investments_total")).toBe(true);
    const nb = insurerFeatures(life.slice(-1), new Map(), "standalone", "life_insurance").find((x) => x.field === "new_business_premium_q")!;
    expect(nb.inputs).toEqual(["2026-09-30"]);
    expect(insurerInvestments(lifeBs.get("2025-09-30"), "2025-09-30", "life_insurance")).toMatchObject({ value: "2600000000000", note: expect.stringMatching(/taken as none.*AssetsHeldToCoverLinkLiabilities/) });
    expect(insurerInvestments(lifeBs.get("2026-09-30"), "2026-09-30", "life_insurance")).toEqual({ value: "4096725500000", from: ["balance sheet 2026-09-30"] });
    expect(insurerFeatures(life, lifeBs, "standalone", "bank")).toEqual([]);
  });
  it("life: SBILIFE Q2 FY27 standalone as filed — new business premium and the expenses of management ratio (filed 0.1139)", () => {
    const sbi = { periodEnd: "2026-09-30", periodKind: "Q", basis: "standalone", lines: { gross_premium: "271151274000", premium_first_year: "57558640000",
      premium_renewal: "157636352000", premium_single: "55956282000", expenses_of_management: "30874746000", pat: "5492318000" } };
    const r = companyFeatures([sbi], new Map(), "standalone", "life_insurance");
    const g = (f: string) => r.find((x) => x.field === f && x.periodEnd === "2026-09-30")!;
    expect(g("new_business_premium_q").value).toBe("113514922000");
    expect(g("expenses_of_management_ratio_computed_q").value).toBe("11.39");
    expect(g("gross_premium_yoy_q").reason).toMatch(/2025-09-30.*gross_premium/);
  });
  it("filed ratios (G3 follow-up): SBILIFE Q2 FY27 as filed — fractions not rescaled, NPAs summed over the five funds, reasons when absent", () => {
    const npa = Object.fromEntries(["nonlinked_par", "nonlinked_nonpar", "linked_par", "linked_nonpar", "shareholders"].flatMap((f) => [[`npa_gross_${f}`, "0"], [`npa_net_${f}`, "0"]]));
    const sbi = { periodEnd: "2026-09-30", periodKind: "Q", basis: "standalone", lines: { gross_premium: "271151274000", expenses_of_management: "30874746000",
      expenses_of_management_ratio_filed: "0.1139", persistency_13m: "0.8582", persistency_25m: "0.7775", persistency_37m: "0.7122", persistency_49m: "0.6885",
      persistency_61m: "0.5801", conservation_ratio: "0.8171", investment_income_shareholders: "3558307000", ...npa, npa_gross_linked_par: "12500000", pat: "5492318000" } as Record<string, string | undefined> };
    const r = insurerFeatures([sbi], new Map(), "standalone", "life_insurance");
    const g = (f: string) => r.find((x) => x.field === f && x.periodEnd === "2026-09-30")!;
    expect(g("expenses_of_management_ratio_filed_q")).toMatchObject({ value: "0.1139", inputs: ["2026-09-30"] });
    expect(g("expenses_of_management_ratio_computed_q").value).toBe("11.39"); // the same ratio in %: 30,874.746 ÷ 2,71,151.274
    expect(g("persistency_13m_filed_q").value).toBe("0.8582");
    expect(g("persistency_25m_filed_q").value).toBe("0.7775");
    expect(g("persistency_37m_filed_q").value).toBe("0.7122");
    expect(g("persistency_49m_filed_q").value).toBe("0.6885");
    expect(g("persistency_61m_filed_q").value).toBe("0.5801");
    expect(g("conservation_ratio_filed_q").value).toBe("0.8171");
    expect(g("investments_gross_npa_filed_q").value).toBe("12500000");  // 0 + 0 + 1.25 ₹ cr + 0 + 0 (hand-made: SBILIFE files 0)
    expect(g("investments_net_npa_filed_q").value).toBe("0");
    expect(g("investment_income_shareholders_ttm").reason).toMatch(/2026-06-30.*investment_income_shareholders/); // one quarter only
    const four = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"].map((e) => ({ ...sbi, periodEnd: e }));
    expect(insurerFeatures(four, new Map(), "standalone", "life_insurance").find((x) => x.field === "investment_income_shareholders_ttm" && x.periodEnd === "2026-09-30")!.value).toBe("14233228000"); // 4 × 3,558.307 ₹ m
    // general-insurer filed ratios are not offered for a life insurer; solvency is never offered
    for (const f of ["claims_ratio_filed_q", "combined_ratio_filed_q", "net_retention_ratio_filed_q", "solvency_ratio_filed_q"]) expect(r.some((x) => x.field === f)).toBe(false);
    expect(unique(r)).toBe(true);
    // absent: a reason, never a number
    const gap = insurerFeatures([{ ...sbi, lines: { ...sbi.lines, persistency_13m: undefined, npa_net_shareholders: undefined } }], new Map(), "standalone", "life_insurance");
    const h = (f: string) => gap.find((x) => x.field === f)!;
    expect(h("persistency_13m_filed_q")).toMatchObject({ value: null, reason: "quarter 2026-09-30 (standalone) has no filed persistency_13m", inputs: [] });
    expect(h("investments_net_npa_filed_q")).toMatchObject({ value: null, reason: expect.stringMatching(/2026-09-30.*net NPA of investments of every fund/) });
    expect(h("investments_gross_npa_filed_q").value).toBe("12500000");
  });
  // general: GODIGIT Q1 FY27 standalone as filed (₹), repeated over four quarters; the year-ago quarter's gross premium 2,500 ₹ cr
  const digit = { gross_premium: "27308600000", net_premium: "20941900000", premium_earned: "20069600000", claims_incurred: "14718700000", commission: "6151200000",
    operating_expenses: "2019800000", underwriting_result: "-2820100000", investment_income_policyholders: "3518300000", investment_income_shareholders: "682300000", pat: "863900000",
    claims_ratio_filed: "0.733", combined_ratio_filed: "1.123", expenses_of_management_ratio_filed: "0.39", net_retention_ratio_filed: "0.767",
    npa_gross_policyholders: "0", npa_net_policyholders: "0" };
  const gi = ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30"].map((e, i) => ({ periodEnd: e, periodKind: "Q", basis: "standalone",
    lines: { ...digit, ...(i === 0 ? { gross_premium: "25000000000" } : {}) } as Record<string, string | undefined> }));
  // ICICIGI Sep 2026 standalone B-BS lines (filed), placed at the GI test's quarter end; a year before: hand-made
  const giBs = new Map<string, Record<string, string | undefined>>([
    ["2025-06-30", { "x:ShareCapital": "4996100000", "x:ReservesAndSurplus": "150000000000", "x:ShareholdersFunds": "5000000000", "x:ApplicationOfFunds": "1",
      "x:InvestmentsShareholders": "150000000000", "x:InvestmentsPolicyholders": "400000000000" }],
    ["2026-06-30", { "x:ShareCapital": "4996100000", "x:ShareApplicationMoneyReceivedPendingAllotmentOfShares": "34300000", "x:ReservesAndSurplus": "175056900000",
      "x:ShareholdersFunds": "8146100000", "x:ApplicationOfFunds": "208915200000", "x:InvestmentsShareholders": "169531700000", "x:InvestmentsPolicyholders": "473785100000" }]]);
  it("general: computed claims / expense / combined ratios agree with the filed 0.733 / 0.39 / 1.123 (Q1 FY27); retention, underwriting, investment income", () => {
    const r = companyFeatures(gi, giBs, "standalone", "general_insurance");
    const g = (f: string) => r.find((x) => x.field === f && x.periodEnd === "2026-06-30")!;
    expect(g("claims_ratio_computed_q")).toMatchObject({ value: "73.34", inputs: ["2026-06-30"] });
    expect(g("expense_ratio_computed_q").value).toBe("39.02");         // (6,151.2 + 2,019.8) ÷ 20,941.9
    expect(g("combined_ratio_computed_q").value).toBe("112.36");       // 73.338… + 39.017…, rounded once
    expect(g("claims_ratio_computed_ttm")).toMatchObject({ value: "73.34", inputs: ["2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30"] });
    expect(g("expense_ratio_computed_ttm").value).toBe("39.02");
    expect(g("combined_ratio_computed_ttm").value).toBe("112.36");
    expect(g("retention_ratio_computed_ttm").value).toBe("76.69");     // filed NetRetentionRatio 0.767
    expect(g("underwriting_result_ttm").value).toBe("-11280400000");   // 4 × −2,820.1 ₹ m, sign as filed
    expect(g("investment_income_policyholders_ttm").value).toBe("14073200000");
    expect(g("investment_income_shareholders_ttm").value).toBe("2729200000");
    expect(g("investment_income_ttm").value).toBe("16802400000");
    expect(g("gross_premium_yoy_q").value).toBe("9.23");               // 2,730.86 vs 2,500 ₹ cr
    expect(g("net_premium_yoy_q").value).toBe("0");
    expect(g("gross_premium_ttm").value).toBe("109234400000");
    expect(g("shareholders_funds_yoy").value).toBe("17.65");           // 18,823.34 vs 499.61 + 15,000 + 500 ₹ cr
    expect(g("investments_total").value).toBe("643316800000");         // = ICICIGI's filed "Investments"
    expect(g("investments_yoy").value).toBe("16.97");
    // the company's own ratios as filed (fractions, not rescaled), next to the computed ones in %
    expect(g("claims_ratio_filed_q")).toMatchObject({ value: "0.733", inputs: ["2026-06-30"] });       // computed 73.34 %
    expect(g("combined_ratio_filed_q").value).toBe("1.123");                                          // computed 112.36 %
    expect(g("expenses_of_management_ratio_filed_q").value).toBe("0.39");
    expect(g("net_retention_ratio_filed_q").value).toBe("0.767");                                     // computed 76.69 %
    expect(g("investments_gross_npa_filed_q").value).toBe("0");
    expect(g("investments_net_npa_filed_q").value).toBe("0");
    for (const f of ["new_business_premium_q", "expenses_of_management_ratio_computed_q", "solvency_ratio", "solvency_ratio_filed_q", "vnb", "persistency_13m", "persistency_13m_filed_q", "conservation_ratio_filed_q"]) expect(r.some((x) => x.field === f)).toBe(false);
    expect(unique(r)).toBe(true);
  });
  it("a missing line or balance sheet gives a reason, never a number", () => {
    const gap = gi.map((q) => (q.periodEnd === "2026-03-31" ? { ...q, lines: { ...q.lines, claims_incurred: undefined, commission: undefined } } : q));
    const noAof = new Map([...giBs].map(([d, b]) => [d, d === "2025-06-30" ? { ...b, "x:ApplicationOfFunds": undefined } : b]));
    const r = companyFeatures(gap, noAof, "standalone", "general_insurance");
    const g = (f: string) => r.find((x) => x.field === f && x.periodEnd === "2026-06-30")!;
    expect(g("claims_ratio_computed_ttm")).toMatchObject({ value: null, reason: expect.stringMatching(/2026-03-31.*claims_incurred/) });
    expect(g("combined_ratio_computed_ttm").value).toBeNull();
    expect(g("expense_ratio_computed_ttm").reason).toMatch(/2026-03-31.*net commission and operating expenses must be filed/);
    expect(g("claims_ratio_computed_q").value).toBe("73.34");          // the quarter itself is complete
    expect(g("investments_yoy").reason).toMatch(/2025-06-30: IRDAI application of funds not filed/);
    expect(g("investments_total").value).toBe("643316800000");
    const lr = companyFeatures(life, new Map([...lifeBs].map(([d, b]) => [d, d === "2025-09-30" ? { ...b, "x:ShareholdersFunds": undefined } : b])), "standalone", "life_insurance");
    expect(lr.find((x) => x.field === "shareholders_funds_yoy" && x.periodEnd === "2026-09-30")!.reason).toMatch(/2025-09-30: shareholders' funds not filed/);
  });
});
