import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { balanceAndCash, parseXbrl } from "../src/index.js";

const fx = (n: string) => parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", n), "utf8"));
describe("balance sheet + cash flow (M2) on real files", () => {
  it("INFY Sep 2026 Integrated Filing (consolidated): balance sheet balances, cash flow reconciles", () => {
    const r = balanceAndCash(fx("xbrl_INFY_IF_Q2FY27_cons_full.xml"));
    expect(r.template).toBe("indas");
    expect(r.bs!.date).toBe("2026-09-30");
    expect(r.bs!.checks.length).toBeGreaterThanOrEqual(4);
    expect(r.bs!.checks.filter((c) => !c.ok)).toEqual([]);
    expect(r.cf).toMatchObject({ start: "2026-04-01", end: "2026-09-30" });
    expect(r.cf!.lines.cfo).toBe("189580000000");
    expect(r.cf!.checks.filter((c) => !c.ok)).toEqual([]);
  });
  it("INFY Sep 2024 old format: cash flow read from FourD as April–September although FourD carries the quarter's dates", () => {
    const r = balanceAndCash(fx("xbrl_INFY_Q2FY25_cons.xml"));
    expect(r.cf).toMatchObject({ start: "2024-04-01", end: "2024-09-30" });
    expect(r.cf!.lines.cfo).toBe("164580000000");
    expect(r.bs!.checks.filter((c) => !c.ok)).toEqual([]);
  });
  it("HDFCBANK Sep 2026 (bank layout): deposits/advances; balance checks", () => {
    const r = balanceAndCash(fx("xbrl_HDFCBANK_IF_Q2FY27_full.xml"));
    expect(r.template).toBe("bank");
    expect(r.bs!.lines.deposits).toBeDefined();
    expect(r.bs!.lines.advances).toBeDefined();
    expect(r.bs!.checks.filter((c) => !c.ok)).toEqual([]);
  });
  it("old Indian GAAP (AFFORDABLE Sep 2024)", () => {
    const r = balanceAndCash(fx("xbrl_AFFORDABLE_nonIndAS.xml"));
    expect(r.template).toBe("oldgaap");
    expect(r.bs!.lines.shareholders_funds).toBeDefined();
    expect(r.bs!.checks.filter((c) => !c.ok)).toEqual([]);
  });
});

describe("assets held for sale shown outside current / non-current (census class, 3,862 files)", () => {
  it("balances once held-for-sale assets are counted", () => {
    const r = balanceAndCash(fx("xbrl_heldforsale_Q2FY25.xml"));
    expect(r.bs!.lines.assets_held_for_sale).toBe("8500000");
    expect(r.bs!.checks.filter((c) => !c.ok)).toEqual([]);
  });
});

describe("prior-year columns are NOT in NSE's results XBRL (owner #334)", () => {
  it("INFY Q4 FY26: PY_I carries only the opening cash of the cash flow, so no prior-year balance sheet is readable", () => {
    const inst = fx("xbrl_INFY_IF_Q4FY26_cons.xml");
    expect(inst.facts.filter((f) => f.contextRef === "PY_I").map((f) => f.tag.split(":")[1])).toEqual(["CashAndCashEquivalentsCashFlowStatement"]);
    expect(balanceAndCash(inst, { prior: true }).bs).toBeNull();
  });
});
