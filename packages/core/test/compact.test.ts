import { describe, expect, it } from "vitest";
import { diso, dnum, fromPaise, toPaise } from "../src/index.js";

describe("compact storage helpers (D130)", () => {
  it("paise round-trips exactly", () => {
    expect(toPaise("1185.05")).toBe(118505);
    expect(toPaise("9331.00")).toBe(933100);
    expect(toPaise("5784087701812.00")).toBe(578408770181200);
    expect(toPaise("-0.5")).toBe(-50);
    expect(toPaise("-")).toBeNull();
    expect(fromPaise(118505)).toBe("1185.05");
    expect(fromPaise(933100)).toBe("9331");
    expect(fromPaise(93310)).toBe("933.1");
    expect(fromPaise(-50)).toBe("-0.5");
  });
  it("dates", () => {
    expect(dnum("2026-10-30")).toBe(20261030);
    expect(diso(20261030)).toBe("2026-10-30");
  });
});
