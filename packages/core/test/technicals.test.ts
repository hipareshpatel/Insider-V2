import { describe, expect, it } from "vitest";
import { adjustCloses, ema, priceFeatures, rsi, type Session } from "../src/index.js";

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
  });
  it("EMA seeded by the simple average; RSI needs n + 1 closes", () => {
    expect(ema([1, 2, 3], 3)).toBeCloseTo(2, 9);
    expect(ema([1, 2], 3)).toBeNull();
    expect(rsi([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1], 14)).toBeCloseTo(50, 6);
    expect(rsi([1, 2], 14)).toBeNull();
  });
});
