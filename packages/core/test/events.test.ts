import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nseDateTime, parseBoardMeetings, parseCreditRatings, parsePit, parseSast } from "../src/index.js";

const fx = (n: string) => readFileSync(join(import.meta.dirname, "fixtures", "nse", n), "utf8");
describe("M2 event readers on real NSE lists", () => {
  it("insider trades (PIT): one row per trade, stable unique keys, dates and quantities", () => {
    const raw = JSON.parse(fx("api_pit_INFY_2024Q1.json")) as Record<string, unknown>[];
    const t = parsePit(fx("api_pit_INFY_2024Q1.json"));
    expect(t.length).toBe(40);
    // NSE's list repeats some identical rows; keys collapse exactly those, never two different trades
    expect(new Set(t.map((x) => x.key)).size).toBe(new Set(raw.map((r) => JSON.stringify(r))).size);
    expect(t[0]).toMatchObject({ symbol: "INFY", person: "Infosys Employee Benefits Trust", txn: expect.any(String), qty: 5765, fromDate: "2024-03-19", disclosedAt: "2024-03-22T16:55:00" });
    expect(parsePit(fx("api_pit_INFY_2024Q1.json")).map((x) => x.key)).toEqual(t.map((x) => x.key)); // stable
  });
  it("SAST Reg 29: application number as key, promoter flag, shares after", () => {
    const s = parseSast(fx("api_sast_INFY.json"));
    expect(s.length).toBe(54);
    expect(new Set(s.map((x) => x.key)).size).toBe(54);
    expect(s.find((x) => x.acquirer.includes("Nilekani"))).toMatchObject({ promoter: true, regType: "Reg29(2)" });
  });
  it("board meetings: meeting date, purpose, announcement time", () => {
    const b = parseBoardMeetings(fx("api_board_meetings_2026-10.json"));
    expect(b.length).toBe(60);
    expect(b[0]!.meetingDate).toMatch(/^2026-1[01]-\d{2}$/);
    expect(b[0]!.announcedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
  it("credit ratings: agency, rating, action, dd-mm-yyyy rating date; one application can cover several instruments", () => {
    const raw = JSON.parse(fx("api_credit_rating_2024-01.json")) as Record<string, unknown>[];
    const c = parseCreditRatings(fx("api_credit_rating_2024-01.json"));
    expect(c.length).toBeGreaterThan(50);
    // repeats differ only in NSE's posting timestamp: same rating, one key
    const strip = (r: Record<string, unknown>) => JSON.stringify({ ...r, TimeStamp: null, TimeDifference: null });
    expect(new Set(c.map((x) => x.key)).size).toBe(new Set(raw.filter((r) => r.NameOfCRAgency && r.CreditRating).map(strip)).size);
    expect(c[0]!.ratedOn).toMatch(/^2024-01-\d{2}$|^2023-\d{2}-\d{2}$/);
    expect(nseDateTime("03-NOV-2026 11:21:41")).toBe("2026-11-03T11:21:41");
  });
});
