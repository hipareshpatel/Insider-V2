import { describe, expect, it } from "vitest";
import { readLevel, statusAuthorized, writeCaps, writeLevel } from "../src/index.js";

describe("read breaker and status token (audit P0)", () => {
  it("levels: below the cap ok, from the cap soft, from 3× hard", () => {
    expect(readLevel(0, 100)).toBe("ok"); expect(readLevel(99, 100)).toBe("ok");
    expect(readLevel(100, 100)).toBe("soft"); expect(readLevel(300, 100)).toBe("hard");
  });
  it("status pages: closed without a configured token; only the exact bearer token opens them", () => {
    const req = (h?: string) => ({ headers: { get: (n: string) => (n === "authorization" ? h ?? null : null) } });
    expect(statusAuthorized(req("Bearer x"), undefined)).toBe(false);
    expect(statusAuthorized(req(), "secret")).toBe(false);
    expect(statusAuthorized(req("Bearer secreT"), "secret")).toBe(false);
    expect(statusAuthorized(req("Bearer secret"), "secret")).toBe(true);
  });
  it("write caps (D166): soft 60M / hard 68M in November 2026 only, 54M for both afterwards", () => {
    const env = { MONTHLY_WRITE_CAP: "54000000", WRITE_CAP_MONTH: "2026-11", WRITE_SOFT_CAP: "60000000", WRITE_HARD_CAP: "68000000" };
    const nov = writeCaps(env, new Date("2026-11-20T06:00:00Z")), dec = writeCaps(env, new Date("2026-11-30T19:00:00Z")); // 1 Dec 00:30 IST
    expect(nov).toEqual({ soft: 60e6, hard: 68e6 }); expect(dec).toEqual({ soft: 54e6, hard: 54e6 });
    expect([59e6, 61e6, 68e6].map((u) => writeLevel(u, nov))).toEqual(["ok", "soft", "hard"]);
  });
});
