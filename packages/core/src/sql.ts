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
