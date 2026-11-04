// D50/D51: primary basis and basis-switch breaks.
import { describe, expect, it } from "vitest";
import { decideBasis } from "../src/basis.js";

const q = (end: string, basis: string, income: number | null = 100) => ({ period_end: end, basis, income });
describe("primary basis (D50)", () => {
  it("bank → standalone, whatever it files", () => {
    expect(decideBasis({ template: "bank", quarters: [q("2026-06-30", "consolidated"), q("2026-06-30", "standalone")] }).basis).toBe("standalone");
  });
  it("operating company → consolidated; standalone-only company → standalone", () => {
    expect(decideBasis({ template: "industrial", quarters: [q("2026-06-30", "consolidated", 100), q("2026-06-30", "standalone", 80)] })).toMatchObject({ basis: "consolidated" });
    expect(decideBasis({ template: "industrial", quarters: [q("2026-06-30", "standalone")] })).toMatchObject({ basis: "standalone", reason: "no consolidated results filed" });
  });
  it("holding company (standalone income < 20% of consolidated) → both", () => {
    expect(decideBasis({ template: "industrial", quarters: [q("2026-06-30", "consolidated", 1000), q("2026-06-30", "standalone", 50)] })).toMatchObject({ basis: "both", saShare: 0.05 });
  });
  it("consolidated starting or stopping after the first quarter is a series break", () => {
    const d = decideBasis({ template: "industrial", quarters: [q("2025-06-30", "standalone"), q("2025-09-30", "standalone"), q("2025-09-30", "consolidated"), q("2025-12-31", "standalone")] });
    expect(d.breaks).toEqual([{ period_end: "2025-09-30", change: "consolidated starts" }, { period_end: "2025-12-31", change: "consolidated stops" }]);
  });
  it("a consolidated quarter that NSE lists but we did not load is a coverage gap, not a basis switch", () => {
    const quarters = [q("2022-03-31", "consolidated"), q("2022-06-30", "standalone"), q("2022-09-30", "consolidated")];
    expect(decideBasis({ template: "industrial", quarters }).breaks.length).toBe(2);
    expect(decideBasis({ template: "industrial", quarters, nseConsolidated: new Set(["2022-06-30"]) }).breaks).toEqual([]);
  });
  it("NSE list rows → (quarter, basis): Integrated Filing qe_Date and results toDate; annual rows skipped", async () => {
    const { nseListed } = await import("../src/basis.js");
    const s = nseListed([JSON.stringify({ data: [{ qe_Date: "31-MAR-2026", consolidated: "Consolidated" }, { qe_Date: "31-MAR-2026", consolidated: "Standalone" }] }),
      JSON.stringify([{ toDate: "31-Dec-2024", consolidated: "Non-Consolidated", period: "Quarterly" }, { toDate: "31-Mar-2024", consolidated: "Consolidated", period: "Annual" }])]);
    expect([...s].sort()).toEqual(["2024-12-31|standalone", "2026-03-31|consolidated", "2026-03-31|standalone"]);
  });
});
