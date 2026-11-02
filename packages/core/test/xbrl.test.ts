import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeXml, parseXbrl } from "../src/index.js";

const x = readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_INFY_Q3FY25.xml"), "utf8");

describe("XBRL instance reader (INFY Q3 FY25 results, real filing)", () => {
  const inst = parseXbrl(x);
  it("reads contexts with periods and the NSE symbol", () => {
    const one = inst.contexts.get("OneD")!;
    expect(one).toMatchObject({ entity: "INFY", start: "2024-10-01", end: "2024-12-31", instant: null });
    expect(inst.contexts.size).toBe(23);
  });
  it("reads every fact with its unit and decimals; contexts all resolve", () => {
    expect(inst.facts.length).toBeGreaterThan(50);
    expect(inst.facts.every((f) => inst.contexts.has(f.contextRef))).toBe(true);
    const rev = inst.facts.find((f) => f.tag === "in-bse-fin:RevenueFromOperations" && f.contextRef === "OneD");
    expect(rev?.value).toMatch(/^\d+(\.\d+)?$/);
    expect(rev?.unitRef).toBeTruthy();
    expect(inst.units.get(rev!.unitRef!)).toMatch(/INR/);
  });
  it("dimension members are captured", () => {
    expect([...inst.contexts.values()].some((c) => Object.keys(c.dims).length > 0)).toBe(true);
  });
  it("decodes entities", () => {
    expect(decodeXml("A &amp; B &#39;x&#39; &#x41;")).toBe("A & B 'x' A");
  });
});
