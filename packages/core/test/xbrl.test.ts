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

describe("bank template (HDFCBANK Q2 FY27 consolidated, trimmed real file)", async () => {
  const { canonicalResult } = await import("../src/index.js");
  const r = canonicalResult(parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_HDFCBANK_IF_Q2FY27_trim.xml"), "utf8")));
  it("detects the bank layout and every bank identity holds", () => {
    expect(r.template).toBe("bank");
    expect(r.lines.interest_earned).toBe("951316300000");
    expect(r.lines.pat).toBe("207000300000");
    expect(r.checks.length).toBe(7);
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
  });
});

describe("life-insurance template (SBILIFE Q2 FY27, trimmed real file)", async () => {
  const { canonicalResult } = await import("../src/index.js");
  const r = canonicalResult(parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_SBILIFE_IF_Q2FY27_trim.xml"), "utf8")));
  it("detects the life-insurer layout; identities hold", () => {
    expect(r.template).toBe("life_insurance");
    expect(r.lines.gross_premium).toBe("271151274000");
    expect(r.lines.pat).toBe("5492318000");
    expect(r.checks.length).toBe(4);
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
  });
});

describe("general-insurer Integrated Filing (GODIGIT Q1 FY27 IFGI, real file)", async () => {
  const { canonicalResult, giChecks } = await import("../src/index.js");
  const r = canonicalResult(parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_GODIGIT_Q1FY27_gi.xml"), "utf8")));
  it("detects the IRDAI general-insurance layout (was read as industrial with revenue + PAT missing); all 9 sums hold", () => {
    expect(r).toMatchObject({ template: "general_insurance", periodStart: "2026-04-01", periodEnd: "2026-06-30", periodKind: "Q", basis: "standalone" });
    expect(r.lines.gross_premium).toBe("27308600000");
    expect(r.lines.pat).toBe("863900000");
    expect(r.checks.length).toBe(9);
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
  });
  it("operating profit: provisions inside or outside both hold (NIACL Q4 FY25 figures); a wrong figure fails", () => {
    const l = { operating_income: "110087400000", total_operating_expenses: "105132600000", provision_doubtful_debts: "-920100000", provision_diminution: "348200000", operating_profit: "4954800000" };
    const op = (x: Record<string, string>) => giChecks(x).find((c) => c.name.startsWith("operating income"))!;
    expect(op(l)).toMatchObject({ ok: true, detail: expect.stringContaining("provisions outside") });
    expect(op({ ...l, operating_profit: "5526700000" }).ok).toBe(true); // provisions inside: 4954.8 − (−920.1) − 348.2 = 5526.7
    expect(op({ ...l, operating_profit: "6000000000" }).ok).toBe(false);
  });
});

describe("malformed filing: facts reference an undefined context (20MICRONS Q1 FY22, real file)", async () => {
  const { canonicalResult } = await import("../src/index.js");
  it("period comes from the filing's own reporting-period facts; identities still checked", () => {
    const r = canonicalResult(parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_20MICRONS_Q1FY22_missingctx.xml"), "utf8")));
    expect(r).toMatchObject({ periodStart: "2021-04-01", periodEnd: "2021-06-30", label: "Q1 FY22" });
    expect(r.lines.revenue).toBeTruthy();
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
  });
});

describe("old Indian GAAP (NONINDAS) results, SME company (AFFORDABLE, real file)", async () => {
  const { canonicalResult } = await import("../src/index.js");
  it("reads total income, depreciation and PAT under their non-Ind AS names; identities hold", () => {
    const r = canonicalResult(parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_AFFORDABLE_nonIndAS.xml"), "utf8")));
    expect(r.lines).toMatchObject({ revenue: "413933000", total_income: "414604000", depreciation: "5749000", pat: "-79120000" });
    expect(r.checks.filter((c) => !c.ok)).toEqual([]);
    expect(r.checks.length).toBeGreaterThanOrEqual(4);
  });
});

describe("old-GAAP aliases never touch Ind AS / Integrated Filing results (owner #265)", async () => {
  const { canonicalResult, isOldGaap } = await import("../src/index.js");
  const fx = (n: string) => parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", n), "utf8"));
  for (const n of ["xbrl_INFY_Q3FY25.xml", "xbrl_20MICRONS_Q1FY22_missingctx.xml", "xbrl_INFY_IF_Q2FY27_trim.xml", "xbrl_HDFCBANK_IF_Q2FY27_trim.xml", "xbrl_SBILIFE_IF_Q2FY27_trim.xml"]) {
    it(`${n}: not old GAAP; result identical with aliases off`, () => {
      const inst = fx(n);
      expect(isOldGaap(inst)).toBe(false);
      expect(canonicalResult(inst)).toEqual(canonicalResult(inst, { aliases: "none" }));
    });
  }
  it("AFFORDABLE (old GAAP) is detected and needs the aliases", () => {
    const inst = fx("xbrl_AFFORDABLE_nonIndAS.xml");
    expect(isOldGaap(inst)).toBe(true);
    expect(canonicalResult(inst, { aliases: "none" }).missing).toContain("pat");
    expect(canonicalResult(inst).missing).not.toContain("pat");
  });
});

describe("decimals in exponent form (census: 3 Integrated Filings)", async () => {
  const { dec, toText } = await import("../src/index.js");
  it("reads 1.83025364E+15 exactly", () => {
    expect(toText(dec("1.83025364E+15"))).toBe("1830253640000000");
    expect(toText(dec("1.37563219E+16"))).toBe("13756321900000000");
    expect(toText(dec("-2.5e-3"))).toBe("-0.0025");
    expect(toText(dec("12.50"))).toBe("12.5");
  });
});

describe("alternative tag names accepted only when the file's sums prove them (V1 hint #276)", async () => {
  const { canonicalResult } = await import("../src/index.js");
  const base = readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_INFY_IF_Q2FY27_trim.xml"), "utf8");
  const renamed = base.replace(/in-capmkt:ProfitLossForPeriod(?![A-Za-z])/g, "in-capmkt:ProfitLossForThePeriod");
  it("Integrated Filing using ProfitLossForThePeriod: accepted, same PAT as the original", () => {
    const want = canonicalResult(parseXbrl(base)).lines.pat;
    const r = canonicalResult(parseXbrl(renamed));
    expect(r.aliasProven).toBe(true);
    expect(r.lines.pat).toBe(want);
  });
  it("refused when a sum in the file does not hold", () => {
    // break total income so "revenue + other income = total income" fails
    const broken = renamed.replace(/(<in-capmkt:Income\b[^>]*contextRef="OneD"[^>]*>)(\d+)/, (_m, a, v) => a + String(Number(v) + 99_000_000));
    const r = canonicalResult(parseXbrl(broken));
    expect(r.aliasProven).toBeUndefined();
    expect(r.missing).toContain("pat");
  });
});
