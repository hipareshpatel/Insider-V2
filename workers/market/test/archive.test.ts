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

import { rowCountOk } from "../src/daily.js";
describe("row-count gate (FMEA C14)", () => {
  it("accepts the day after a lasting step change (2026-08-18: 2548 vs median 2392.5, previous 2550)", () => {
    expect(rowCountOk(2548, 2392.5, 2550)).toBe(true);
  });
  it("still rejects a truncated file (far from both references)", () => {
    expect(rowCountOk(1800, 2392.5, 2550)).toBe(false);
  });
  it("rejects a jump far above both", () => {
    expect(rowCountOk(2900, 2392.5, 2450)).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { affectsPrice, parsePurpose } from "@disclo/core";
describe("per-company corporate actions missing from Bc (market/0016)", () => {
  const sql = readFileSync(join(import.meta.dirname, "..", "..", "..", "db", "migrations", "market", "0016_corp_action_extra.sql"), "utf8");
  const purposes = [...sql.matchAll(/\('[^']*', '\d{4}-\d{2}-\d{2}', '((?:[^']|'')*)'/g)].map((m) => m[1]!.replace(/''/g, "'"));
  it("all 72 purposes parse with no unknown parts; 19 affect prices", () => {
    expect(purposes.length).toBe(72);
    expect(purposes.filter((p) => parsePurpose(p).unparsed.length)).toEqual([]);
    expect(purposes.filter((p) => affectsPrice(parsePurpose(p))).length).toBe(19);
  });
});
