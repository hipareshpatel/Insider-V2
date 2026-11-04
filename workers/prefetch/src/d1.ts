// Cloudflare adapters: D1 -> Sql, R2 -> RawStore.
import type { D1Meter, RawStore, Sql, Stmt } from "@disclo/core";

/** D1 -> Sql. Write counts are D1's billed `rows_written` (includes index writes; owner #266 cap), added to `meter.rows`;
 *  rows read (D1 `rows_read`, what D1 bills for reads) are added to `meter.reads` (read circuit breaker, C56). */
export function d1Sql(db: D1Database, meter?: D1Meter): Sql {
  const read = (m: { rows_read?: number } | undefined) => { if (meter) meter.reads = (meter.reads ?? 0) + (m?.rows_read ?? 0); };
  return {
    async all<T>(sql: string, params: unknown[] = []) {
      const r = await db.prepare(sql).bind(...params).all<T>();
      read(r.meta as { rows_read?: number });
      return r.results;
    },
    async run(sql: string, params: unknown[] = []) {
      const r = await db.prepare(sql).bind(...params).run();
      read(r.meta as { rows_read?: number });
      if (meter) meter.rows += r.meta.rows_written ?? 0;
      return { changes: r.meta.changes ?? 0 };
    },
    async batch(stmts: Stmt[]) {
      if (!stmts.length) return 0;
      const rs = await db.batch(stmts.map((s) => db.prepare(s.sql).bind(...s.params)));
      for (const r of rs) read(r.meta as { rows_read?: number });
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
