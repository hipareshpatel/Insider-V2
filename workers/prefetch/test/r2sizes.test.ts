import { describe, expect, it } from "vitest";
import { r2PrefixSizes } from "../src/r2sizes.js";

describe("R2 prefix census", () => {
  it("groups by prefix, splits gzip/plain, pages through the listing, and never writes", async () => {
    const objs = [
      { key: "att/A/1.xml", size: 100, customMetadata: { enc: "gzip" } },
      { key: "att/A/2.xml", size: 900, customMetadata: {} },
      { key: "api/pit/A/x.json", size: 50, customMetadata: { enc: "gzip" } },
      { key: "api/pit/B/y.json", size: 70 },
      { key: "cache/z.zip", size: 10 },
    ];
    let calls = 0;
    const bucket = {
      async list(o: { cursor?: string; limit: number }) {
        calls++;
        const from = o.cursor ? Number(o.cursor) : 0;
        const objects = objs.slice(from, from + 2);
        return from + 2 < objs.length ? { objects, truncated: true, cursor: String(from + 2) } : { objects, truncated: false };
      },
    } as unknown as R2Bucket;
    const r = await r2PrefixSizes(bucket);
    expect(calls).toBe(3);
    expect(r.total).toMatchObject({ objects: 5, bytes: 1130, plainBytes: 980 });
    expect(r.largest[0]).toMatchObject({ prefix: "att/A/", bytes: 1000, gzObjects: 1, plainObjects: 1, plainBytes: 900 });
    expect(r.largest.map((x) => x.prefix)).toEqual(["att/A/", "api/pit/", "cache/"]);
    expect(Object.keys(r.topLevel)).toEqual(["att/", "api/", "cache/"]);
    expect(r).toMatchObject({ truncated: false, done: true });
  });
  it("stops at maxPages and says so", async () => {
    const bucket = { async list() { return { objects: [{ key: "a/b/c", size: 1 }], truncated: true, cursor: "n" }; } } as unknown as R2Bucket;
    const r = await r2PrefixSizes(bucket, { maxPages: 3 });
    expect(r).toMatchObject({ pages: 3, truncated: true, cursor: "n" });
  });
});
