import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STRUCTURE_API_CAP, isoFromNseDate, parseDealsApi, parseDealsCsv, parseFiiDii, parseFoBan, parseParticipantOi, parseSecList, parseShortApi, parseSurveillance } from "../src/index.js";

const fx = (n: string) => readFileSync(join(import.meta.dirname, "fixtures", "nse", n), "utf8");
describe("market-structure readers on real NSE files (M1)", () => {
  it("participant OI: 5 client types, trimmed column names, totals", () => {
    const r = parseParticipantOi(fx("fao_participant_oi_30102026.csv"));
    expect(r.map((x) => x.clientType)).toEqual(["Client", "DII", "FII", "Pro", "TOTAL"]);
    expect(r[0]!.values.future_index_long).toBe(246926);
    expect(r[0]!.values.total_long_contracts).toBe(12083374);
    expect(Object.keys(r[0]!.values)).toHaveLength(14);
  });
  it("F&O ban list", () => {
    expect(parseFoBan(fx("fo_secban_16062025.csv"))).toMatchObject({ date: "2025-06-16", symbols: expect.arrayContaining(["ABFRL", "BSOFT"]) });
    expect(parseFoBan("Securities in Ban For Trade Date 03-NOV-2026:\n")).toEqual({ date: "2026-11-03", symbols: [] });
  });
  it("price bands", () => {
    const b = parseSecList(fx("sec_list_30102026_head.csv"));
    expect(b[0]).toEqual({ symbol: "ABAN", series: "BE", band: "2" });
  });
  it("deals: API rows and the complete daily file; short selling; cap constant", () => {
    const api = parseDealsApi(fx("api_bulk_deals_30102026.json"));
    expect(api.length).toBe(STRUCTURE_API_CAP); // a busy day hits the cap
    expect(api[0]).toMatchObject({ date: "2026-10-30", symbol: "AARTECH", side: "S", qty: 200000, price: "40.51" });
    const csv = parseDealsCsv(fx("bulk_snapshot.csv"));
    expect(csv.length).toBe(87);
    expect(csv[0]).toMatchObject({ date: "2026-11-02", symbol: "AARTECH", side: "B", qty: 189020, price: "40.92" });
    const ss = parseShortApi(fx("api_short_selling_30102026.json"));
    expect(ss[0]).toEqual({ date: "2026-10-30", symbol: "ADANIPORTS", qty: 9501 });
  });
  it("ASM / GSM / FII-DII snapshots", () => {
    const s = parseSurveillance(fx("api_reportASM.json"), fx("api_reportGSM.json"));
    expect(s.filter((x) => x.list === "asm_lt").length).toBe(139);
    expect(s.filter((x) => x.list === "asm_st").length).toBe(47);
    expect(s.filter((x) => x.list === "gsm").length).toBe(76);
    expect(parseFiiDii(fx("api_fiidiiTradeReact.json"))).toContainEqual({ date: "2026-11-02", category: "DII", buy: "14988.48", sell: "15380.68", net: "-392.2" });
    expect(isoFromNseDate("2-Jan-2024")).toBe("2024-01-02");
  });
});
