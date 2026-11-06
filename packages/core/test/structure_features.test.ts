import { describe, expect, it } from "vitest";
import { dealsCoverage, dealsWindowFrom, structureFeatures, type LedgerDay, type StructureInput } from "../src/index.js";

const asOf = "2026-11-05";
// every source loaded on the as-of session; deals loaded on two sessions of the window
const ledger: LedgerDay[] = [
  { source: "fo_ban", d: 20261105, rows: 3, note: null },
  { source: "price_band", d: 20261105, rows: 2500, note: null },
  { source: "surveillance", d: 20261105, rows: 120, note: null },
  ...(["bulk", "block"] as const).flatMap((k) => [{ source: k, d: 20261001, rows: 10, note: null }, { source: k, d: 20261105, rows: 12, note: "complete daily file" }]),
];
const base: StructureInput = { asOf, symbol: "ABC", ledger, surveillance: [], banned: false, bands: [], deals: [] };
const get = (x: Partial<StructureInput>) => { const r = structureFeatures({ ...base, ...x }); return (k: string) => r.find((f) => f.field === k)!; };

describe("field catalogue §3: surveillance, F&O ban, price band, deals", () => {
  it("90 calendar days ending on the as-of date", () => {
    expect(dealsWindowFrom("2026-11-05")).toBe("2026-08-08");
  });
  it("flags are 0/1 when the lists are loaded", () => {
    const v = get({ surveillance: [{ list: "asm_st", stage: "Stage I" }], banned: true });
    expect([v("in_asm").value, v("in_gsm").value, v("in_fo_ban").value]).toEqual(["1", "0", "1"]);
    expect(get({ surveillance: [{ list: "gsm", stage: "I" }] })("in_gsm").value).toBe("1");
    expect(get({})("in_asm")).toEqual({ field: "in_asm", value: "0", reason: null });
  });
  it("a list not loaded for the session is null with the reason, never 0", () => {
    const v = get({ ledger: ledger.filter((x) => x.source !== "surveillance" && x.source !== "fo_ban") });
    expect(v("in_asm")).toEqual({ field: "in_asm", value: null, reason: "ASM / GSM lists not loaded for 2026-11-05" });
    expect(v("in_fo_ban").reason).toBe("F&O ban list not loaded for 2026-11-05");
    const m = get({ ledger: ledger.map((x) => x.source === "fo_ban" ? { ...x, rows: -1 } : x) });
    expect(m("in_fo_ban").reason).toBe("F&O ban list file missing for 2026-11-05");
  });
  it("price band: the preferred series, latest interval; none listed is null with reason", () => {
    const v = get({ bands: [{ series: "BE", band: "5", validFrom: 20260101 }, { series: "EQ", band: "20", validFrom: 20250101 }, { series: "EQ", band: "10", validFrom: 20261105 }] });
    expect(v("price_band").value).toBe("10");
    expect(get({})("price_band").reason).toBe("no price band listed for ABC (EQ/BE/BZ/SM/ST) on 2026-11-05");
  });
  it("deals: count and net buy − sell in ₹ crore", () => {
    const v = get({ deals: [
      { kind: "bulk", side: "B", qty: 1_000_000, pricePaise: 25_000 }, // ₹25 crore bought
      { kind: "block", side: "S", qty: 200_000, pricePaise: 12_345 },  // ₹2.469 crore sold
    ] });
    expect(v("bulk_block_deals_90d").value).toBe("2");
    expect(v("bulk_block_net_90d_cr").value).toBe("22.53");
    expect(get({})("bulk_block_net_90d_cr").value).toBe("0.00");
  });
  it("deals coverage: not loaded, missing or truncated sessions make the deal fields null", () => {
    expect(dealsCoverage(ledger, asOf)).toBeNull();
    expect(dealsCoverage(ledger.filter((x) => !(x.source === "block" && x.d === 20261105)), asOf)).toBe("block deals not loaded for 2026-11-05");
    expect(dealsCoverage(ledger.map((x) => x.source === "bulk" && x.d === 20261001 ? { ...x, rows: -1 } : x), asOf)).toMatch(/^bulk deals file missing for 1 session/);
    const cut = get({ ledger: ledger.map((x) => x.source === "bulk" && x.d === 20261001 ? { ...x, note: "possibly truncated (API cap 70)" } : x) });
    expect(cut("bulk_block_deals_90d").value).toBeNull();
    expect(cut("bulk_block_deals_90d").reason).toMatch(/possibly truncated \(API cap\) on 1 session/);
    // a session before the window does not count
    expect(dealsCoverage([...ledger, { source: "bulk", d: 20260801, rows: -1, note: null }], asOf)).toBeNull();
  });
  it("no symbol: every field null with the reason; sector return null (no sector index mapped)", () => {
    const r = structureFeatures({ ...base, symbol: null });
    expect(r.filter((f) => f.field !== "ret_vs_sector_3m").every((f) => f.value === null && f.reason === "no NSE symbol valid on 2026-11-05")).toBe(true);
    expect(get({})("ret_vs_sector_3m")).toMatchObject({ value: null, reason: expect.stringMatching(/^no sector index mapped/) });
  });
});
