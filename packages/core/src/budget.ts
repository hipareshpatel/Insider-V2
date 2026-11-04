// D1 rows-read circuit breaker (audit 4 Nov, C56 follow-up). D1 bills rows scanned; until now only writes had a cap.
// Every cron run adds the rows its queries read (D1 meta.rows_read) to one row per IST day in market.read_budget.
// Above the soft cap the optional passes stop; above the hard cap only the essential daily loads run.
import type { Sql } from "./sql.js";
import { istDate } from "./time.js";

export const DAILY_READ_CAP = 150_000_000; // ≈ 4.5 B a month: a fifth of the 25 B included
export type ReadLevel = "ok" | "soft" | "hard";

/** "ok" below the cap, "soft" from the cap (optional passes stop), "hard" from 3× the cap (essential work only). */
export function readLevel(used: number, cap = DAILY_READ_CAP): ReadLevel {
  return used >= 3 * cap ? "hard" : used >= cap ? "soft" : "ok";
}

/** Rows read so far today (IST), by every worker. One primary-key lookup. */
export async function readsToday(market: Sql, now: Date): Promise<number> {
  const [r] = await market.all<{ rows: number }>("SELECT rows FROM read_budget WHERE day=?", [istDate(now)]);
  return r?.rows ?? 0;
}

export async function chargeReads(market: Sql, now: Date, rows: number): Promise<void> {
  if (rows > 0) await market.run("INSERT INTO read_budget (day, rows) VALUES (?, ?) ON CONFLICT (day) DO UPDATE SET rows = rows + excluded.rows", [istDate(now), Math.round(rows)]);
}

/** Meter shared by the D1 adapters: billed rows written (write cap, D136) and rows read (this breaker). */
export interface D1Meter { rows: number; reads?: number }
