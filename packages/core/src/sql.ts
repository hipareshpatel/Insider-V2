// Minimal SQL interface implemented by D1 (Workers) and node:sqlite (tests), so pipeline code is testable offline.
export interface Stmt { sql: string; params: unknown[] }

export interface Sql {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  /** Atomic batch (D1 batch = one transaction). */
  batch(stmts: Stmt[]): Promise<number>; // total rows changed
}

/** D1 allows at most 100 bound parameters per statement: build multi-row INSERTs within that limit. */
export function insertRows(head: string, cols: number, rows: unknown[][], tail = "", maxParams = 99): Stmt[] {
  if (cols > maxParams) throw new Error("insertRows: too many columns");
  const per = Math.max(1, Math.floor(maxParams / cols));
  const tuple = `(${Array(cols).fill("?").join(",")})`;
  const out: Stmt[] = [];
  for (let i = 0; i < rows.length; i += per) {
    const chunk = rows.slice(i, i + per);
    out.push({ sql: `${head} VALUES ${chunk.map(() => tuple).join(",")} ${tail}`.trim(), params: chunk.flat() });
  }
  return out;
}

export async function batchAll(db: Sql, stmts: Stmt[], size = 80): Promise<number> {
  let n = 0;
  for (let i = 0; i < stmts.length; i += size) n += await db.batch(stmts.slice(i, i + size));
  return n;
}

/** Rows of several kinds after a job_id cursor, in job_id order, reading at most `limit` rows per kind (C56 follow-up).
 *  `kind IN (…) ORDER BY job_id` makes SQLite read and sort every matching row; one indexed range per kind
 *  (`WHERE kind = ? AND job_id > ? ORDER BY job_id LIMIT ?`, binding kind, after, limit) reads only what it returns.
 *  The merged list stops at the smallest last id of a kind whose page was full, so no row is skipped. */
export async function byKindAfter<T extends { job_id: number }>(db: Sql, sqlOneKind: string, kinds: readonly string[], after: number, limit: number): Promise<T[]> {
  const pages = await Promise.all(kinds.map((k) => db.all<T>(sqlOneKind, [k, after, limit])));
  let horizon = Infinity;
  for (const p of pages) if (p.length >= limit) horizon = Math.min(horizon, p[p.length - 1]!.job_id);
  return pages.flat().filter((r) => r.job_id <= horizon).sort((a, b) => a.job_id - b.job_id).slice(0, limit);
}
