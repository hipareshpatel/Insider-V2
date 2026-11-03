// Cloudflare adapters: D1 -> Sql, R2 -> RawStore.
import type { RawStore, Sql, Stmt } from "@disclo/core";

/** D1 -> Sql. Write counts are D1's billed `rows_written` (includes index writes; owner #266 cap), added to `meter` if given. */
export function d1Sql(db: D1Database, meter?: { rows: number }): Sql {
  return {
    async all<T>(sql: string, params: unknown[] = []) {
      return (await db.prepare(sql).bind(...params).all<T>()).results;
    },
    async run(sql: string, params: unknown[] = []) {
      const r = await db.prepare(sql).bind(...params).run();
      if (meter) meter.rows += r.meta.rows_written ?? 0;
      return { changes: r.meta.changes ?? 0 };
    },
    async batch(stmts: Stmt[]) {
      if (!stmts.length) return 0;
      const rs = await db.batch(stmts.map((s) => db.prepare(s.sql).bind(...s.params)));
      const n = rs.reduce((t, r) => t + (r.meta.rows_written ?? r.meta.changes ?? 0), 0);
      if (meter) meter.rows += n;
      return n;
    },
  };
}

export function r2Raw(bucket: R2Bucket): RawStore {
  return {
    async put(key, bytes, contentType) {
      await bucket.put(key, bytes, contentType ? { httpMetadata: { contentType } } : undefined);
    },
  };
}
