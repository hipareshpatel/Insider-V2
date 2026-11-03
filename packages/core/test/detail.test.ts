// D154: every reported line item of the balance sheet and cash flow, checked against the filing's own subtotals
// (real INFY files: Integrated Filing Sep 2026 and Mar 2026, old in-bse-fin Mar 2024).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseXbrl, statementDetail } from "../src/index.js";

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
});
