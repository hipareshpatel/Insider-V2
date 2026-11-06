import { describe, expect, it } from "vitest";
import { adjustCloses, BUYBACK_PURPOSE, buybackFeatures, dividendYieldTtm, ema, priceFeatures, rsi, SECTOR_INDEX, SECTORAL_INDICES, sectorIndexNames, sectorIndexOf, type SectorInput, type Session } from "../src/index.js";

// 300 sessions on weekdays from 2025-07-01, close rising 1 a day from 100; a 1:1 bonus (factor 0.5) on 2026-01-05
function series(): Session[] {
  const out: Session[] = []; const d = new Date("2025-07-01T00:00:00Z"); let i = 0;
  while (out.length < 300) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) {
      const iso = d.toISOString().slice(0, 10), raw = 100 + i;
      out.push({ date: iso, close: iso >= "2026-01-05" ? raw / 2 : raw, volume: 1000, turnoverRs: 1e7 }); i++;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

describe("field catalogue §3: price features on adjusted closes", () => {
  const s = series(), f = [{ exDate: "2026-01-05", factor: 0.5 }];
  it("adjusts closes before the ex-date by the factor (the bonus is no price fall)", () => {
    const a = adjustCloses(s, f), i = s.findIndex((x) => x.date === "2026-01-05");
    expect(a[i]! - a[i - 1]!).toBeCloseTo(0.5, 6); // a steady +1 raw step, halved
  });
  it("returns, 52-week range, averages and flags from the adjusted series", () => {
    const { asOf, rows } = priceFeatures(s, f);
    const v = (k: string) => rows.find((r) => r.field === k)!;
    expect(asOf).toBe(s[299]!.date);
    expect(v("close").value).toBe("199.50");    // (100 + 299) / 2
    expect(v("close_raw").value).toBe("199.50");
    expect(Number(v("ret_1w").value)).toBeCloseTo((399 - 394) / 394 * 100, 1); // 5 sessions back
    expect(Number(v("ret_1y").value)).toBeGreaterThan(0);
    expect(v("pct_from_52w_high").value).toBe("0.00"); // a rising series closes at its high
    expect(Number(v("pct_from_52w_low").value)).toBeGreaterThan(0);
    // a short history says why a field is missing
    const short = priceFeatures(s.slice(0, 100), f).rows;
    expect(short.find((r) => r.field === "ret_1y")!.reason).toMatch(/no stored close/);
    expect(short.find((r) => r.field === "dma_200")!.reason).toMatch(/needs 200 sessions/);
    expect(v("above_dma_200").value).toBe("1");
    expect(v("rsi_14").value).toBe("100.00"); // only gains
    expect(v("avg_turnover_20d_cr").value).toBe("1.00");
    expect(v("volume_vs_20d").value).toBe("1.00");
    expect(v("delivery_pct_20d").reason).toMatch(/not stored/);
    expect(v("ret_vs_nifty_3m").reason).toMatch(/no Nifty 50 closes/);
  });
  it("relative return vs the Nifty 50 (percentage points) and 20-day delivery %", () => {
    const withDel = s.map((x) => ({ ...x, deliverableQty: 400 }));
    const flat = s.map((x) => ({ date: x.date, close: 1000 })); // a flat index: relative return = own return
    const { rows } = priceFeatures(withDel, f, flat);
    const v = (k: string) => rows.find((r) => r.field === k)!;
    expect(v("ret_vs_nifty_3m").value).toBe(v("ret_3m").value);
    expect(v("delivery_pct_20d").value).toBe("40.00");
    const stale = priceFeatures(s, f, flat.slice(0, -1)).rows.find((r) => r.field === "ret_vs_nifty_3m")!;
    expect(stale.reason).toMatch(/Nifty 50 closes end/);
  });
  it("return vs the sector index (G5): hand-checked, the sector map and a stored constituent membership", () => {
    // stock: 2026-08-03 close 100, 2026-11-05 close 115 → +15.00 %; base date = 2026-11-05 − 3 months = 2026-08-05,
    // last close on or before it is 2026-08-03 (no session on 4–5 Aug in this series)
    const st: Session[] = [["2026-07-31", 98], ["2026-08-03", 100], ["2026-08-06", 103], ["2026-11-04", 112], ["2026-11-05", 115]]
      .map(([date, close]) => ({ date: date as string, close: close as number, volume: 1, turnoverRs: 1 }));
    // Nifty IT 2026-08-03 40000 → 2026-11-05 42000 = +5.00 % → 15.00 − 5.00 = 10.00 pp
    // Nifty Bank 2026-08-03 50000 → 2026-11-05 47500 = −5.00 % → 15.00 − (−5.00) = 20.00 pp
    const it3 = [{ date: "2026-08-03", close: 40000 }, { date: "2026-08-06", close: 41000 }, { date: "2026-11-05", close: 42000 }];
    const bank = [{ date: "2026-08-03", close: 50000 }, { date: "2026-11-05", close: 47500 }];
    const closes = new Map([["NIFTY IT", it3], ["NIFTY BANK", bank], ["NIFTY FINANCIAL SERVICES", it3.slice(0, -1)]]);
    const get = (x: SectorInput | undefined) => { const r = priceFeatures(st, [], undefined, x).rows; return (k: string) => r.find((f) => f.field === k)!; };
    const viaMap = get({ sector: "Information Technology", members: [], closes });
    expect(viaMap("ret_3m").value).toBe("15.00");
    expect(viaMap("ret_vs_sector_3m")).toEqual({ field: "ret_vs_sector_3m", value: "10.00", reason: null });
    expect(viaMap("ret_vs_sector_3m_inputs").value).toBe("Nifty IT; sector map: NSE sector Information Technology (no sectoral index membership stored); company 15.00%, index 5.00% from 2026-08-05");
    // a stored membership wins over the sector map, matched in any case ("NIFTY BANK" as the index lists spell it)
    const viaMember = get({ sector: "Information Technology", members: ["NIFTY BANK"], closes });
    expect(viaMember("ret_vs_sector_3m").value).toBe("20.00");
    expect(viaMember("ret_vs_sector_3m_inputs").value).toMatch(/^Nifty Bank; constituent of Nifty Bank; company 15.00%, index -5.00%/);
    // narrowest sectoral index first: a member of both Nifty Financial Services and Nifty Bank uses Nifty Bank
    expect(get({ sector: "Financial Services", members: ["NIFTY FINANCIAL SERVICES", "Nifty Bank"], closes })("ret_vs_sector_3m").value).toBe("20.00");
    // nulls, each with its reason (and the inputs row with the same reason)
    const why = (x: SectorInput | undefined) => get(x)("ret_vs_sector_3m");
    expect(why({ sector: "Capital Goods", members: [], closes })).toMatchObject({ value: null, reason: "NSE publishes no sectoral index for the sector Capital Goods" });
    expect(get({ sector: "Capital Goods", members: [], closes })("ret_vs_sector_3m_inputs")).toMatchObject({ value: null, reason: "NSE publishes no sectoral index for the sector Capital Goods" });
    expect(why({ sector: null, members: [], closes }).reason).toMatch(/^company is Unclassified/);
    expect(why({ sector: undefined, members: [], closes }).reason).toMatch(/^no sector stored/);
    expect(why(undefined).reason).toBe("sector index closes not read");
    expect(why({ sector: "Healthcare", members: [], closes }).reason).toBe("no Nifty Healthcare Index closes stored (sector map: NSE sector Healthcare (no sectoral index membership stored))");
    expect(why({ sector: "Financial Services", members: [], closes }).reason).toMatch(/^Nifty Financial Services closes end 2026-08-06, the stock's 2026-11-05/);
    expect(why({ sector: "Information Technology", members: [], closes: new Map([["NIFTY IT", it3.slice(1)]]) }).reason).toMatch(/^no Nifty IT close on or before 2026-08-05/);
    // a stock without 3 months of closes: the company's own reason first
    expect(priceFeatures(st.slice(2), [], undefined, { sector: "Information Technology", members: [], closes }).rows.find((f) => f.field === "ret_vs_sector_3m")!.reason).toMatch(/^no stored close on or before 2026-08-05/);
  });
  it("sector → index map: only sectors NSE publishes a sectoral index for; every name is read in both spellings", () => {
    expect(sectorIndexOf({ sector: "Power", members: [], closes: new Map() })).toMatchObject({ index: "Nifty Energy" });
    for (const s of ["Capital Goods", "Construction", "Construction Materials", "Consumer Services", "Telecommunication", "Services", "Textiles", "Diversified", "Forest Materials"])
      expect(sectorIndexOf({ sector: s, members: [], closes: new Map() })).toHaveProperty("why");
    for (const n of Object.values(SECTOR_INDEX)) expect(SECTORAL_INDICES as readonly string[]).toContain(n);
    expect(sectorIndexNames()).toEqual(expect.arrayContaining(["Nifty IT", "NIFTY IT", "Nifty Oil & Gas", "NIFTY OIL & GAS"]));
  });
  it("EMA seeded by the simple average; RSI needs n + 1 closes", () => {
    expect(ema([1, 2, 3], 3)).toBeCloseTo(2, 9);
    expect(ema([1, 2], 3)).toBeNull();
    expect(rsi([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1], 14)).toBeCloseTo(50, 6);
    expect(rsi([1, 2], 14)).toBeNull();
  });
});

describe("§4 dividend yield (TTM)", () => {
  it("sums dividends in the last 12 months on today's share basis, over the latest unadjusted close", () => {
    // ₹10 before a 1:2 split (factor 0.5) counts as ₹5; ₹4 + ₹1 combined purpose; one outside the window ignored
    const r = dividendYieldTtm("2026-11-05", 300, [
      { exDate: "2025-11-05", amount: "50" }, { exDate: "2026-01-10", amount: "10" }, { exDate: "2026-08-01", amount: "4+1" }],
      [{ exDate: "2026-03-01", factor: 0.5 }]);
    expect(r).toMatchObject({ value: "3.33", reason: null }); // (5 + 5) ÷ 300
    expect(dividendYieldTtm("2026-11-05", 300, [], []).value).toBe("0.00");
    expect(dividendYieldTtm("2026-11-05", 300, [{ exDate: "2026-06-01", amount: "abc" }], []).reason).toMatch(/not readable/);
  });
});

describe("§13 buyback (G10) from stored corporate-action purposes", () => {
  const f = (asOf: string, a: { exDate: string; purpose: string }[]) => Object.fromEntries(buybackFeatures(asOf, a).map((x) => [x.field, x]));
  it("matches NSE's buyback spellings (Bc and per-company lists), alone or in a combined purpose; nothing else", () => {
    for (const p of ["BUY BACK", "BUYBACK", "Buyback", "Buy Back", "BUY BACK OF SHARES", "Buy-Back", "DIV RS 5/BUY BACK"]) expect(BUYBACK_PURPOSE.test(p), p).toBe(true);
    for (const p of ["Interim Dividend - Rs 21 Per Share", "BONUS 1:1", "PAYBACK", "Buy", "BACK", "Demerger"]) expect(BUYBACK_PURPOSE.test(p), p).toBe(false);
  });
  it("INFY: buyback within 12 months gives 1 and its date; one after asOf is not counted", () => {
    // INFY's 2025 tender buyback (record date 14 Nov 2025) as the Bc file states it, and a dividend
    const r = f("2026-11-05", [{ exDate: "2025-11-14", purpose: "BUY BACK" }, { exDate: "2026-10-27", purpose: "INT DIV RS 23 PER SH" }, { exDate: "2026-12-01", purpose: "BUYBACK" }]);
    expect(r.buyback_12m).toMatchObject({ value: "1", reason: null });
    expect(r.last_buyback_date).toMatchObject({ value: "2025-11-14", reason: null });
  });
  it("last buyback more than 12 months ago gives 0 and that date; window edge is (asOf − 12 m, asOf] (illustrative TCS-style rows)", () => {
    const r = f("2026-11-05", [{ exDate: "2024-01-25", purpose: "Buyback" }, { exDate: "2025-11-05", purpose: "BUY BACK OF SHARES" }]);
    expect(r.buyback_12m).toMatchObject({ value: "0", reason: null });       // 2025-11-05 is exactly 12 months back: outside
    expect(r.last_buyback_date!.value).toBe("2025-11-05");
    expect(f("2026-11-04", [{ exDate: "2025-11-05", purpose: "BUY BACK OF SHARES" }]).buyback_12m!.value).toBe("1");
  });
  it("nothing stored: 0 when the window is covered by stored actions, null with reason otherwise; date null with reason", () => {
    const r = f("2026-11-05", [{ exDate: "2026-07-01", purpose: "DIVIDEND - RS 10 PER SHARE" }]);
    expect(r.buyback_12m).toMatchObject({ value: "0", reason: null });
    expect(r.last_buyback_date).toMatchObject({ value: null, reason: "no buyback stored (corporate actions are stored from 2024-01-01)" });
    expect(f("2024-12-31", []).buyback_12m).toMatchObject({ value: "0", reason: null });     // window starts 2024-01-01
    expect(f("2024-12-30", []).buyback_12m).toMatchObject({ value: null, reason: expect.stringMatching(/before corporate actions are stored/) });
    expect(f("2024-12-30", [{ exDate: "2024-06-01", purpose: "BUYBACK" }]).buyback_12m!.value).toBe("1"); // a stored one still answers yes
  });
});
