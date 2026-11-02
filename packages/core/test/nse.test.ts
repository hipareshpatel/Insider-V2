import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EQUITY_SERIES, affectsPrice, dedupeBc, nseDate, parseBc, parseCsv, parseEquityList, parseIndexList, parseMcap,
  parsePrBundle, parsePurpose, parseUdiffCsv, parseUdiffZip,
} from "../src/index.js";

const fx = (n: string) => join(import.meta.dirname, "fixtures", "nse", n);
const text = (n: string) => readFileSync(fx(n), "utf8");
const bytes = (n: string) => new Uint8Array(readFileSync(fx(n)));

describe("csv + dates", () => {
  it("handles quotes, CRLF and padding", () => {
    expect(parseCsv('a, "b,c" ,d\r\n1,"x""y",3\r\n\r\n')).toEqual([["a", "b,c", "d"], ["1", 'x"y', "3"]]);
  });
  it("reads every NSE date format seen", () => {
    expect(nseDate("2026-10-30")).toBe("2026-10-30");
    expect(nseDate("16/06/2025")).toBe("2025-06-16");
    expect(nseDate("13 JUN 2025")).toBe("2025-06-13");
    expect(nseDate("06-OCT-2008")).toBe("2008-10-06");
    expect(nseDate(" - ")).toBeNull();
    expect(() => nseDate("31/02/2025")).toThrow();
    expect(() => nseDate("Oct 30")).toThrow();
  });
});

describe("UDiFF bhavcopy (real file sample)", () => {
  it("parses the zipped file, keeps CM stock rows", async () => {
    const rows = await parseUdiffZip(bytes("udiff_20261030.csv.zip"));
    expect(rows).toEqual(parseUdiffCsv(text("udiff_20261030.csv")));
    const infy = rows.find((r) => r.symbol === "INFY" && r.series === "EQ")!;
    expect(infy.tradeDate).toBe("2026-10-30");
    expect(infy.isin).toBe("INE009A01021");
    expect(infy.volume).toBeGreaterThan(0);
    expect(rows.some((r) => r.series === "SM")).toBe(true);
  });
  it("shows the BAJFINANCE ISIN change and unadjusted prev close across the split (Appendix B)", () => {
    const before = parseUdiffCsv(text("udiff_20250613.csv")).find((r) => r.symbol === "BAJFINANCE" && r.series === "EQ")!;
    const after = parseUdiffCsv(text("udiff_20250616.csv")).find((r) => r.symbol === "BAJFINANCE" && r.series === "EQ")!;
    expect(before.isin).toBe("INE296A01024");
    expect(after.isin).toBe("INE296A01032");
    expect(before.close).toBe("9331.00");
    expect(after.prevClose).toBe("9331.00");
    expect(after.close).toBe("938.00");
  });
  it("fails loudly when a column is renamed (schema check)", () => {
    expect(() => parseUdiffCsv("TradDt,Sgmt\n2026-10-30,CM\n")).toThrow(/missing columns/);
  });
});

describe("PR bundle: MCAP + Bc", () => {
  it("reads both files from the zip despite name variations", async () => {
    const b = await parsePrBundle(bytes("PR160625.zip"));
    expect(b.mcap?.find((r) => r.symbol === "BAJFINANCE")?.issueSize).toBe(6198786520);
    expect(b.bc.length).toBeGreaterThan(0);
  });
  it("MCAP: exact issue size and market cap text", () => {
    const r = parseMcap(text("MCAP13062025.csv")).find((x) => x.symbol === "BAJFINANCE")!;
    expect(r).toMatchObject({ tradeDate: "2025-06-13", issueSize: 619878652, faceValue: "2.00", mcapRs: "5784087701812.00" });
    expect(parseMcap(text("mcap30102026.csv")).length).toBeGreaterThan(0);
  });
  it("Bc: dedupes series copies; BAJFINANCE had a split and a bonus on the same day", () => {
    const rows = dedupeBc(parseBc(text("Bc160625.csv")), EQUITY_SERIES).filter((r) => r.symbol === "BAJFINANCE");
    expect(rows.map((r) => r.purpose).sort()).toEqual(["BONUS 4:1", "FV SPLT FRM RS 2 TO RE 1"]);
    expect(rows.every((r) => r.exDate === "2025-06-16")).toBe(true);
    const infy = dedupeBc(parseBc(text("bc30102026.csv")), EQUITY_SERIES);
    expect(infy).toHaveLength(1);
    expect(infy[0]).toMatchObject({ exDate: "2026-11-03", purpose: "INTDIV - RS 26 PER SH" });
  });
});

describe("Bc purpose parser (patterns from 2024–2026 files)", () => {
  const c = (p: string) => parsePurpose(p);
  it.each([
    ["FV SPLT FRM RS 2 TO RE 1", { type: "split", fromFv: "2", toFv: "1" }],
    ["FVSPLT FRM RS 10 TO RS 2", { type: "split", fromFv: "10", toFv: "2" }],
    ["FV SPLT FRM RS 1 TO RS 10", { type: "consolidation", fromFv: "1", toFv: "10" }],
    ["BONUS 4:1", { type: "bonus", newShares: "4", held: "1" }],
    ["RIGHTS 1:5 @ PRM RS 120/-", { type: "rights", newShares: "1", held: "5", premium: "120" }],
    ["RIGHTS 3:10@ PRM RS 45", { type: "rights", newShares: "3", held: "10", premium: "45" }],
  ])("%s", (p, want) => {
    expect(c(p).components).toEqual([want]);
    expect(affectsPrice(c(p))).toBe(true);
  });
  it.each([
    ["INTDIV - RS 26 PER SH", [{ type: "dividend", amount: "26", kind: "interim" }]],
    ["DIV - RE 0.50 PER SH", [{ type: "dividend", amount: "0.50", kind: "final" }]],
    ["AGM/DIV-RS 5 PER SH", [{ type: "meeting" }, { type: "dividend", amount: "5", kind: "final" }]],
    ["AGM/DIV - RS 7PER SH/", [{ type: "meeting" }, { type: "dividend", amount: "7", kind: "final" }]],
    ["AGM/DIV-RS-5/SPDV-RS 3", [{ type: "meeting" }, { type: "dividend", amount: "5", kind: "final" }, { type: "dividend", amount: "3", kind: "special" }]],
    ["DVSPDV - RS 5/RS 3", [{ type: "dividend", amount: "5", kind: "final" }, { type: "dividend", amount: "3", kind: "special" }]],
    ["SPLDIV - RS 10 PER SH", [{ type: "dividend", amount: "10", kind: "special" }]],
    ["ANNUAL GENERAL MEETING", [{ type: "meeting" }]],
  ])("%s (not price-affecting, D7)", (p, want) => {
    expect(c(p).components).toEqual(want);
    expect(c(p).unparsed).toEqual([]);
    expect(affectsPrice(c(p))).toBe(false);
  });
  it("sends anything not understood to review instead of guessing", () => {
    expect(c("SCH AGMT-BONUS NCRPS 1:1").unparsed).toEqual(["SCH AGMT-BONUS NCRPS 1:1"]);
    expect(c("DEMERGER").components).toEqual([{ type: "demerger" }]);
    expect(affectsPrice(c("DEMERGER"))).toBe(true);
  });
});

describe("masters", () => {
  it("EQUITY_L", () => {
    expect(parseEquityList(text("EQUITY_L.csv")).find((r) => r.symbol === "INFY")).toMatchObject({ isin: "INE009A01021", listedOn: "1995-02-08", series: "EQ" });
  });
  it("index list gives sector (D121)", () => {
    expect(parseIndexList(text("ind_niftytotalmarket_list.csv")).find((r) => r.symbol === "ITC")?.sector).toBe("Fast Moving Consumer Goods");
  });
});
