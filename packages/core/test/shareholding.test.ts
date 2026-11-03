import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseShareholding, parseXbrl } from "../src/index.js";

const load = (f: string) => parseShareholding(parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", f), "utf8")));

describe("shareholding pattern (real filings, Sep 2026)", () => {
  const infy = load("shp_INFY_2026-09.xml");
  it("INFY: top-level categories sum exactly to total shares (FMEA B3)", () => {
    expect(infy.totalShares).toBe(4058276578);
    expect(infy.categories.find((c) => c.category === "promoter")).toMatchObject({ shares: 516677914, pct: "0.1273", filedPct: "0.139" });
    expect(infy.categories.find((c) => c.category === "public")?.shares).toBe(3191448097);
    expect(infy.checks.filter((c) => !c.ok)).toEqual([]);
    expect(infy.asOf).toBe("2026-09-30");
  });
  it("INFY: sub-categories read separately (mutual funds, FII) and never summed into the total", () => {
    expect(infy.categories.find((c) => c.category === "mutual_funds")?.shares).toBe(853161465);
    expect(infy.categories.find((c) => c.category === "fii")?.shares).toBe(1019626105);
  });
  it("INFY: named holders paired by their own context (FMEA B4)", () => {
    const n = infy.namedHolders.find((h) => h.name === "NANDAN M NILEKANI");
    expect(n).toMatchObject({ shares: 40789562, pct: "0.0101", filedPct: "0.011" });
    const mf = infy.namedHolders.find((h) => h.name === "ICICI PRUDENTIAL MUTUAL FUND");
    expect(mf?.shares).toBe(146692156);
  });
  it("VEDL: promoter encumbrance split, % is of the promoter holding (not of the company)", () => {
    const v = load("shp_VEDL_2026-09.xml");
    expect(v.checks.filter((c) => !c.ok)).toEqual([]);
    expect(v.promoterEncumbrance).toMatchObject({ encumbered: 2139651763, nonDisposal: 107342705, other: 2032309058, pledged: 0, pctOfPromoterHolding: "1" });
    expect(v.categories.find((c) => c.category === "promoter")).toMatchObject({ pct: "0.5472", filedPct: "0.5472" });
  });
});
