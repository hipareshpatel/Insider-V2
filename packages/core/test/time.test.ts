import { describe, expect, it } from "vitest";
import { istDate, istToUtc } from "../src/index.js";

describe("time (D114)", () => {
  it("maps a UTC instant to its IST calendar date across midnight", () => {
    expect(istDate(new Date("2026-11-02T18:31:00Z"))).toBe("2026-11-03");
    expect(istDate(new Date("2026-11-02T18:29:00Z"))).toBe("2026-11-02");
  });
  it("converts IST wall-clock time to UTC", () => {
    expect(istToUtc("2026-11-02", "23:31:58")).toBe("2026-11-02T18:01:58.000Z");
    expect(istToUtc("2026-11-03")).toBe("2026-11-02T18:30:00.000Z");
  });
  it("rejects malformed input", () => {
    expect(() => istToUtc("02-11-2026")).toThrow();
    expect(() => istToUtc("2026-13-40")).toThrow();
  });
});
