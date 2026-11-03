import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import { compressStep } from "../src/compress.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations", "filings");
function sqlite(): Sql {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIG).sort()) db.exec(readFileSync(join(MIG, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return {
    async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...norm(params)) as T[]; },
    async run(sql: string, params: unknown[] = []) { return { changes: Number(db.prepare(sql).run(...norm(params)).changes) }; },
    async batch(stmts: Stmt[]) { let n = 0; for (const s of stmts) n += Number(db.prepare(s.sql).run(...norm(s.params)).changes); return n; },
  };
}
describe("R2 compression of older objects (D147)", () => {
  it("gzips plain api/ and att/ objects once, keeps metadata, skips gzip and cache/, then finishes", async () => {
    const db = sqlite();
    const xml = new TextEncoder().encode("<xbrl>" + "<f>1</f>".repeat(500) + "</xbrl>");
    const store = new Map<string, { b: Uint8Array; meta: Record<string, string> }>([
      ["att/x/a.xml", { b: xml, meta: { url: "u1" } }],
      ["api/l/b.json", { b: new Uint8Array(gzipSync(xml)), meta: { url: "u2", enc: "gzip" } }],
      ["cache/c.zip", { b: xml, meta: {} }],
    ]);
    for (const [k, i] of [["att/x/a.xml", 1], ["api/l/b.json", 2], ["cache/c.zip", 3]] as const)
      await db.run("INSERT INTO fetch_job (job_id, kind, url, r2_key, status) VALUES (?, 'k', ?, ?, 'done')", [i, `u${i}`, k]);
    const bucket = {
      async head(k: string) { const o = store.get(k); return o ? { customMetadata: o.meta } : null; },
      async get(k: string) { const o = store.get(k); return o ? { arrayBuffer: async () => o.b.buffer.slice(o.b.byteOffset, o.b.byteOffset + o.b.byteLength), httpMetadata: {}, customMetadata: o.meta } : null; },
      async put(k: string, b: Uint8Array, opt: { customMetadata: Record<string, string> }) { store.set(k, { b, meta: opt.customMetadata }); },
    } as unknown as R2Bucket;
    const r = await compressStep(db, bucket, async (b) => new Uint8Array(gzipSync(b)), 10);
    expect(r).toMatchObject({ packed: 1, done: true });
    const a = store.get("att/x/a.xml")!;
    expect(a.meta).toEqual({ url: "u1", enc: "gzip" });
    expect(new TextDecoder().decode(gunzipSync(a.b))).toBe(new TextDecoder().decode(xml));
    expect(store.get("cache/c.zip")!.meta).toEqual({});
    expect(await compressStep(db, bucket, async (b) => b, 10)).toBeNull(); // finished
  });
});
