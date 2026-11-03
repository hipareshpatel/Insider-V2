// D154: every reported line item of the balance sheet and cash flow, checked against the filing's own subtotals
// (real INFY files: Integrated Filing Sep 2026 and Mar 2026, old in-bse-fin Mar 2024).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type XbrlFact, parseXbrl, statementDetail } from "../src/index.js";

const fx = (n: string) => parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", n), "utf8"));
describe("statement detail (D154)", () => {
  for (const [file, bsLines, cfLines] of [["xbrl_INFY_IF_Q2FY27_cons_full.xml", 59, 88], ["xbrl_INFY_IF_Q4FY26_cons.xml", 51, 88], ["xbrl_INFY_Q4FY24_cons.xml", 57, 89]] as const) {
    it(`${file}: ${bsLines} balance-sheet and ${cfLines} cash-flow lines; every subtotal check holds`, () => {
      const d = statementDetail(fx(file), "OneI", "FourD");
      expect(Object.keys(d.bs!.lines).length).toBe(bsLines);
      expect(Object.keys(d.cf!.lines).length).toBe(cfLines);
      expect(d.cf!.checks.length).toBe(4);
      expect(d.bs!.checks.length).toBeGreaterThanOrEqual(9);
      expect([...d.bs!.checks, ...d.cf!.checks].filter((c) => !c.ok)).toEqual([]);
    });
  }
  it("signs: capex and tax paid reduce their totals (INFY Sep 2026: CFO = 240,740 − 51,160 = 189,580 m)", () => {
    const d = statementDetail(fx("xbrl_INFY_IF_Q2FY27_cons_full.xml"), "OneI", "FourD");
    expect(d.cf!.lines.CashFlowsFromUsedInOperations).toBe("240740000000");
    expect(d.cf!.lines.IncomeTaxesPaidRefundClassifiedAsOperatingActivities).toBe("51160000000");
    expect(d.cf!.lines.CashFlowsFromUsedInOperatingActivities).toBe("189580000000");
    expect(d.cf!.lines.PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities).toBe("15850000000");
  });
  // D154 residual class A (older layout, 574 files): real values of filing 1434505 (FY26 year to date, rupees).
  const older = (extra: Record<string, string> = {}) => {
    const v: Record<string, string> = { AdjustmentsForFinanceCosts: "2754400000", AdjustmentsForDepreciationAndAmortisationExpense: "4342700000", AdjustmentsForUnrealisedForeignExchangeLossesGains: "67200000",
      OtherAdjustmentsForWhichCashEffectsAreInvestingOrFinancingCashFlow: "-3400000", OtherAdjustmentsToReconcileProfitLoss: "-10900000", OtherAdjustmentsForNoncashItems: "-23700000",
      AdjustmentsForDecreaseIncreaseInInventories: "-2943800000", AdjustmentsForDecreaseIncreaseInTradeReceivables: "437700000", AdjustmentsForIncreaseDecreaseInTradePayables: "4807700000",
      AdjustmentsForWorkingCapital: "2301600000", AdjustmentsToProfitLoss: "7126300000", AdjustmentsForReconcileProfitLoss: "9427900000",
      ProceedsFromBorrowingsClassifiedAsFinancingActivities: "5927000000", RepaymentsOfBorrowingsClassifiedAsFinancingActivities: "3442100000", DividendsPaidClassifiedAsFinancingActivities: "362500000",
      InterestPaidClassifiedAsFinancingActivities: "2754400000", OtherInflowsOutflowsOfCashClassifiedAsFinancingActivities: "-99800000", ProceedsFromIssuingShares: "100000",
      CashFlowsFromUsedInFinancingActivities: "-731700000", ...extra };
    const facts: XbrlFact[] = Object.entries(v).map(([t, x]) => ({ tag: `in-capmkt:${t}`, contextRef: "FourD", unitRef: "INR", decimals: "-5", value: x, nil: false }));
    facts.push({ tag: "in-capmkt:DateOfEndOfReportingPeriod", contextRef: "FourD", unitRef: null, decimals: null, value: "2025-03-31", nil: false });
    return { contexts: new Map([["FourD", { id: "FourD", entity: null, start: "2024-04-01", end: "2025-03-31", instant: null, dims: {} }]]), units: new Map(), facts, schemaRef: null };
  };
  it("older layout: undivided receivables/payables and 'issuing shares' close the filed totals; subtotals are not added", () => {
    const d = statementDetail(older(), null, "FourD");
    expect(d.cf!.checks.map((c) => [c.name, c.ok, c.detail])).toEqual([
      ["operating adjustments = total adjustments", true, "9427900000 vs 9427900000"],
      ["financing lines = financing cash flow", true, "-731700000 vs -731700000"]]);
  });
  it("an undivided line is never counted next to its split (no double count)", () => {
    const d = statementDetail(older({ AdjustmentsForDecreaseIncreaseInTradeReceivablesCurrent: "437700000" }), null, "FourD");
    expect(d.cf!.checks[0]).toMatchObject({ ok: true, detail: "9427900000 vs 9427900000" });
  });
});
