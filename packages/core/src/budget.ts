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

/** D166 (owner #342): two-tier monthly write caps on billed D1 rows written (market + filings, D136 counter).
 *  For the month WRITE_CAP_MONTH (IST, "2026-11"): soft cap (optional passes, one-off passes and back-fills stop) and a
 *  higher hard cap (only the live daily filings + events loading and the market's daily job run up to it). Any other
 *  month: both caps = MONTHLY_WRITE_CAP (54M, the $10 ceiling) — the November raise ends by itself. */
export interface WriteCapEnv { MONTHLY_WRITE_CAP?: string; WRITE_SOFT_CAP?: string; WRITE_HARD_CAP?: string; WRITE_CAP_MONTH?: string }
export function writeCaps(env: WriteCapEnv, now: Date): { soft: number; hard: number } {
  const base = Number(env.MONTHLY_WRITE_CAP ?? 54_000_000);
  if (env.WRITE_CAP_MONTH && istDate(now).slice(0, 7) === env.WRITE_CAP_MONTH)
    return { soft: Number(env.WRITE_SOFT_CAP ?? base), hard: Number(env.WRITE_HARD_CAP ?? base) };
  return { soft: base, hard: base };
}
export function writeLevel(used: number, caps: { soft: number; hard: number }): ReadLevel {
  return used >= caps.hard ? "hard" : used >= caps.soft ? "soft" : "ok";
}
/** Billed rows written this IST month (write_budget rows for the month, incl. the baseline row 'YYYY-MM-00'). */
export async function writesThisMonth(market: Sql, now: Date): Promise<number> {
  const [r] = await market.all<{ rows: number | null }>("SELECT sum(rows) AS rows FROM write_budget WHERE day LIKE ?", [istDate(now).slice(0, 7) + "-%"]);
  return r?.rows ?? 0;
}
