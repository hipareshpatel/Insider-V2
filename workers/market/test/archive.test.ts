import { describe, expect, it } from "vitest";
import { r2FirstFetcher } from "../src/archive.js";

// Owner #265: a file downloaded live is kept in R2, so it is never downloaded twice.
describe("R2-first fetcher write-through", () => {
  const store = new Map<string, Uint8Array>();
  const bucket = {
    async get(k: string) { const b = store.get(k); return b ? { arrayBuffer: async () => b.buffer } : null; },
    async put(k: string, b: Uint8Array) { store.set(k, b); },
  } as unknown as R2Bucket;
  let calls = 0;
  const live = async (url: string) => { calls++; return url.endsWith("missing.csv") ? { status: 404, bytes: new Uint8Array(), contentType: null } : { status: 200, bytes: new TextEncoder().encode("a,b"), contentType: "text/csv" }; };
  const f = r2FirstFetcher(bucket, live, "2026-11-02");

  it("saves a live 200 at cache/<path>; the second read comes from R2", async () => {
    const url = "https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_03112026.csv";
    expect((await f(url)).status).toBe(200);
    expect(store.has("cache/products/content/sec_bhavdata_full_03112026.csv")).toBe(true);
    expect((await f(url)).status).toBe(200);
    expect(calls).toBe(1);
  });
  it("does not save a 404", async () => {
    await f("https://nsearchives.nseindia.com/content/missing.csv");
    expect(store.has("cache/content/missing.csv")).toBe(false);
  });
});
