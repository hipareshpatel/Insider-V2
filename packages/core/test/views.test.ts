import { describe, expect, it } from "vitest";
import { adjustedPat, adjustedPbt, capitalEmployed, companyFeatures, valuationFeatures, ebitda, isLargeOrder, ownersEquity, previousQuarterEnd, roce, roe, trend, ttm, type FiledPeriod } from "../src/index.js";

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
    // consolidated still needs the owners' line (never assumed equal to net profit)
    const cons = companyFeatures(qs.map((q) => ({ ...q, basis: "consolidated" })), new Map(), "consolidated", "industrial");
    expect(cons.find((r) => r.field === "pat_owners_ttm" && r.periodEnd === "2026-09-30")!.value).toBeNull();
  });
});

describe("owners' equity by layout", () => {
  it("insurers use IRDAI shareholders' funds (either basis); industrial consolidated needs the owners' line", () => {
    expect(ownersEquity({ "x:ShareholdersFunds": "193977400000" }, "consolidated", "life_insurance")).toBe("193977400000");
    expect(ownersEquity({ "x:ShareholdersFunds": "1" }, "standalone", "general_insurance")).toBe("1");
    expect(ownersEquity({}, "standalone", "life_insurance")).toBeNull();
    expect(ownersEquity({ "x:Equity": "5" }, "consolidated", "industrial")).toBeNull();
    expect(ownersEquity({ capital: "1", reserves: "2" }, "consolidated", "bank")).toBe("3");
  });
});
