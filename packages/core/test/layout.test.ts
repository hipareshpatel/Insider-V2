import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BS_INDUSTRIAL, BS_LINES, CF_INDUSTRIAL, CF_LINES, PL_INDUSTRIAL, PL_TAGS, canonicalResult, derivedPl, layoutStatement, parseXbrl, statementDetail, tagLabel, type LayoutNode } from "../src/index.js";

const keys = (t: LayoutNode[]): string[] => t.flatMap((nd) => [nd.key, ...(nd.children ? keys(nd.children) : [])]);
const inst = parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_INFY_IF_Q2FY27_cons_full.xml"), "utf8"));

describe("D157 statement layout (Schedule III Div II, industrial)", () => {
  it("every stored line has a place in its tree, once", () => {
    for (const [tree, stored] of [[BS_INDUSTRIAL, BS_LINES.map((t) => `x:${t}`)], [CF_INDUSTRIAL, CF_LINES.map((t) => `x:${t}`)]] as const) {
      const k = keys(tree);
      expect(new Set(k).size).toBe(k.length);
      expect(stored.filter((s) => !k.includes(s))).toEqual([]);
    }
    expect(keys(PL_INDUSTRIAL).filter((k) => !(k in PL_TAGS))).toEqual([]);
  });
  it("lays a real P&L out in Schedule III order, filed values only, with derived rows labelled", () => {
    const r = canonicalResult(inst);
    const rows = layoutStatement(PL_INDUSTRIAL, r.lines);
    expect(rows.slice(0, 4).map((x) => x.key)).toEqual(["revenue", "other_income", "total_income", "total_expenses"]);
    expect(rows.find((x) => x.key === "employee_cost")).toMatchObject({ level: 1, kind: "filed", value: r.lines.employee_cost });
    expect(rows.every((x) => x.kind === "filed" || x.kind === "head")).toBe(true);
    const d = derivedPl(r.lines);
    expect(d.map((x) => x.kind)).toEqual(["derived", "derived"]);
    const want = BigInt(r.lines.revenue!) - BigInt(r.lines.total_expenses!) + BigInt(r.lines.finance_cost!) + BigInt(r.lines.depreciation!);
    expect(BigInt(d[0]!.value!)).toBe(want);
  });
  it("a head that is not filed keeps its filed sub-rows and shows no value; empty branches are left out", () => {
    const detail = statementDetail(inst, "OneI", "FourD");
    const v = Object.fromEntries(Object.entries(detail.bs?.lines ?? {}).map(([k, val]) => [`x:${k}`, val]));
    expect(Object.keys(v).length).toBeGreaterThan(10);
    delete v["x:CurrentAssets"];
    const rows = layoutStatement(BS_INDUSTRIAL, v);
    expect(rows.find((x) => x.key === "x:CurrentAssets")).toMatchObject({ kind: "head", value: null });
    expect(rows.find((x) => x.key === "x:Inventories")?.level).toBe(2);
    expect(rows.some((x) => x.value === null && !rows.some((y) => y.level > x.level))).toBe(false);
  });
  it("marks deducted lines with sign −1 and keeps the filed value; hideZeros drops zero rows only", () => {
    const rows = layoutStatement(CF_INDUSTRIAL, { "x:CashFlowsFromUsedInInvestingActivities": "-40", "x:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities": "50",
      "x:InterestReceivedClassifiedAsInvestingActivities": "10", "x:PurchaseOfGoodwillClassifiedAsInvestingActivities": "0" }, { hideZeros: true });
    expect(rows.find((r) => r.key === "x:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities")).toMatchObject({ value: "50", sign: -1 });
    expect(rows.find((r) => r.key === "x:InterestReceivedClassifiedAsInvestingActivities")?.sign).toBeUndefined();
    expect(rows.some((r) => r.key === "x:PurchaseOfGoodwillClassifiedAsInvestingActivities")).toBe(false);
    expect(layoutStatement(CF_INDUSTRIAL, { "x:PurchaseOfGoodwillClassifiedAsInvestingActivities": "0" }).length).toBe(2);
  });
  it("labels unlabelled tags readably", () => {
    expect(tagLabel("x:TradeReceivablesCurrent")).toBe("Trade receivables current");
  });
});
