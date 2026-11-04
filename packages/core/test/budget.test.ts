import { describe, expect, it } from "vitest";
import { readLevel, statusAuthorized } from "../src/index.js";

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
});
