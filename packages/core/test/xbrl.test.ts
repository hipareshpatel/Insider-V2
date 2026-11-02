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

describe("canonical results (INFY Q3 FY25 standalone)", async () => {
  const { canonicalResult } = await import("../src/index.js");
  const r = canonicalResult(parseXbrl(x));
  it("period, basis and label", () => {
    expect(r).toMatchObject({ symbol: "INFY", periodStart: "2024-10-01", periodEnd: "2024-12-31", periodKind: "Q", label: "Q3 FY25", basis: "standalone", audited: "Audited" });
  });
  it("lines in exact rupees", () => {
    expect(r.lines.revenue).toBe("349150000000");
    expect(r.lines.pat).toBe("63580000000");
    expect(r.lines.eps_basic).toBe("15.31");
  });
  it("all accounting identities hold", () => {
    expect(r.checks.length).toBeGreaterThanOrEqual(4);
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
  });
});

describe("canonical results from a SEBI Integrated Filing (in-capmkt, INFY Q2 FY27, trimmed real file)", async () => {
  const { canonicalResult } = await import("../src/index.js");
  const r = canonicalResult(parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_INFY_IF_Q2FY27_trim.xml"), "utf8")));
  it("reads the same canonical lines under the in-capmkt prefix", () => {
    expect(r).toMatchObject({ periodStart: "2026-07-01", periodEnd: "2026-09-30", label: "Q2 FY27", basis: "standalone" });
    expect(r.lines.revenue).toBe("407190000000");
    expect(r.lines.pat).toBe("78930000000");
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
  });
});
