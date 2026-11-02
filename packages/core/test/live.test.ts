// Opt-in live check against today's full NSE files: LIVE=1 npx vitest run packages/core/test/live.test.ts
import { describe, expect, it } from "vitest";
import { EQUITY_SERIES, dedupeBc, parseEquityList, parseIndexList, parsePrBundle, parsePurpose, parseUdiffZip, prBundleUrl, udiffUrl, indexListUrl } from "../src/index.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const get = async (u: string) => {
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${u} -> ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};
const day = process.env.LIVE_DATE ?? "2026-10-30";
const [y, m, d] = day.split("-");

describe.runIf(process.env.LIVE === "1")(`live NSE files for ${day}`, () => {
  it("full UDiFF bhavcopy parses", async () => {
    const rows = await parseUdiffZip(await get(udiffUrl(`${y}${m}${d}`)));
    const eq = rows.filter((r) => EQUITY_SERIES.has(r.series));
    console.log(`udiff: ${rows.length} rows, ${eq.length} EQ/BE/BZ`);
    expect(eq.length).toBeGreaterThan(2000);
    expect(new Set(eq.map((r) => `${r.symbol}|${r.series}`)).size).toBe(eq.length);
  }, 60_000);
  it("full PR bundle (MCAP + Bc) parses; every price-affecting purpose is understood or flagged", async () => {
    const b = await parsePrBundle(await get(prBundleUrl(`${d}${m}${y!.slice(2)}`)));
    const bc = dedupeBc(b.bc, EQUITY_SERIES);
    const unparsed = bc.filter((r) => parsePurpose(r.purpose).unparsed.length);
    console.log(`mcap: ${b.mcap?.length} rows; bc: ${b.bc.length} rows, ${bc.length} equity after dedupe, unparsed -> review: ${unparsed.map((r) => r.purpose).join(" | ") || "none"}`);
    // MCAP is absent before 2024-02-01 (Appendix B); January 2024 market cap is derived (D6).
    if (day < "2024-02-01") expect(b.mcap).toBeNull();
    else expect(b.mcap!.length).toBeGreaterThan(2000);
    // Truncated purpose text (seen 2024-02-01: "FV SPLT FRM RS 216.75 TO") must go to review, never be guessed.
    for (const r of unparsed) expect(parsePurpose(r.purpose).components.some((c) => c.type === "split")).toBe(false);
  }, 60_000);
  it("EQUITY_L and Total Market list parse", async () => {
    const eq = parseEquityList(new TextDecoder().decode(await get("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv")));
    const tm = parseIndexList(new TextDecoder().decode(await get(indexListUrl("ind_niftytotalmarket_list"))));
    console.log(`EQUITY_L: ${eq.length}; total market: ${tm.length}, sectors ${new Set(tm.map((r) => r.sector)).size}`);
    expect(eq.length).toBeGreaterThan(1500);
    expect(new Set(tm.map((r) => r.sector)).size).toBe(22);
  }, 60_000);
});
