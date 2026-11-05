import { describe, expect, it } from "vitest";
import { adjustedPat, adjustedPbt, capitalEmployed, ebitda, isLargeOrder, previousQuarterEnd, roce, roe, trend, ttm, type FiledPeriod } from "../src/index.js";

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
