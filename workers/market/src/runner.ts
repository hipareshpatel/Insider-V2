// Decides which dates to (re)run, in order, within a time budget. Used by both the nightly cron and the backfill.
import { type Sql, batchAll, dec, diso, dnum, insertRows, mul, round, toText } from "@disclo/core";
import { type DayReport, type Deps, runDay } from "./daily.js";
import { snapshotIndices } from "./snapshot.js";
import { addDays, datesBetween, eligible, istNow } from "./dates.js";

export const HISTORY_START = "2024-01-01"; // D2

export interface RunOptions { maxDates: number; budgetMs: number; from?: string; monthlyCap?: number }

/** Dates not loaded yet, in order. P1 (audit 4 Nov): the daily "re-fetch the last 5 sessions" check is gone — the
 *  fetcher reads R2 first, so it re-read our own stored copies and never asked NSE for a revised file; a file that
 *  arrives late is picked up by the C49 gap pass (fillGaps). */
export async function pendingDates(db: Sql, now: Date, from = HISTORY_START): Promise<string[]> {
  const today = istNow(now).date;
  const all = datesBetween(from < HISTORY_START ? HISTORY_START : from, today).filter((d) => eligible(d, now));
  const done = new Set((await db.all<{ run_key: string }>(
    "SELECT DISTINCT run_key FROM pipeline_run WHERE pipeline='market.daily' AND status IN ('ok','skipped')")).map((r) => r.run_key));
  return all.filter((d) => !done.has(d)).sort();
}

export async function runPending(deps: Deps, opt: RunOptions): Promise<DayReport[]> {
  const t0 = Date.now();
  const out: DayReport[] = [];
  for (const d of (await pendingDates(deps.market, deps.now(), opt.from)).slice(0, opt.maxDates)) {
    if (Date.now() - t0 > opt.budgetMs) break;
    if (await paused(deps.market)) break; // maintenance: a reset must not race a running load
    // Owner #266: no daily limit; bulk work stops once the month's billed writes reach the cap. The normal daily job
    // (dates within the last 7 days) always runs, so prices never go stale (≈10k rows/day).
    if (d < addDays(istNow(deps.now()).date, -7) && (await capLeft(deps.market, deps.now(), opt.monthlyCap)) <= 0) break;
    const r = await runDay(d, deps);
    out.push(r);
    await chargeBudget(deps.market, deps.now(), r.written ?? 0);
    // Strict date order: corporate-action factors compare with the previous session, so a date that didn't load
    // (refused, failed, rejected by a gate) stops this run; the next run retries it first.
    if (!["loaded", "unchanged", "no_session"].includes(r.status)) break;
  }
  if (await paused(deps.market)) return out;
  // D163 (P1): the January-2024 derivation (done once) and the versioned factor repair run when started explicitly
  // (POST /maint/derive_jan2024, /maint/repair_factors), not on every run.
  await maybeSnapshot(deps);
  if (!out.length) await fillGaps(deps, 4, Math.max(0, opt.budgetMs - (Date.now() - t0))); // only when caught up; reported via /gaps
  return out;
}

/** C49 repair: loaded sessions with no delivery or index-close file in the ledger are re-run from stored files (a few
 *  per run; each date tried at most once a week, so a file that truly doesn't exist costs nothing). */
export async function gapDates(m: Deps["market"], now: Date, limit = 50): Promise<string[]> {
  const until = addDays(istNow(now).date, -2);
  return (await m.all<{ trade_date: string }>(
    `SELECT t.trade_date FROM trading_calendar t WHERE t.is_session = 1 AND t.universe_rows IS NOT NULL AND t.trade_date <= ?
       AND (NOT EXISTS (SELECT 1 FROM source_file s WHERE s.source = 'delivery' AND s.file_date = t.trade_date)
         OR NOT EXISTS (SELECT 1 FROM source_file s WHERE s.source = 'index_close' AND s.file_date = t.trade_date))
       AND NOT EXISTS (SELECT 1 FROM pipeline_run r WHERE r.pipeline = 'market.gapfill' AND r.run_key = t.trade_date AND r.started_at > ?)
     ORDER BY t.trade_date LIMIT ?`, [until, new Date(now.getTime() - 7 * 86400_000).toISOString(), limit])).map((r) => r.trade_date);
}
async function fillGaps(deps: Deps, limit: number, budgetMs: number): Promise<DayReport[]> {
  const t0 = Date.now(), out: DayReport[] = [];
  for (const d of await gapDates(deps.market, deps.now(), limit)) {
    if (Date.now() - t0 > budgetMs) break;
    await deps.market.run("INSERT INTO pipeline_run (pipeline, run_key, started_at, finished_at, status) VALUES ('market.gapfill', ?, ?, ?, 'ok')", [d, deps.now().toISOString(), deps.now().toISOString()]);
    const r = await runDay(d, deps);
    out.push(r);
    await chargeBudget(deps.market, deps.now(), r.written ?? 0);
  }
  return out;
}

/** Once per IST day, after 22:00, and only when prices are caught up (index lists match on current ISINs). */
export async function maybeSnapshot(deps: Deps): Promise<string> {
  const now = deps.now();
  const n = istNow(now);
  const ever = await deps.market.all("SELECT 1 FROM pipeline_run WHERE pipeline='market.snapshot' AND status='ok' LIMIT 1");
  if (n.minutes < 22 * 60 && ever.length) return "before 22:00 IST"; // the first snapshot runs as soon as prices are caught up
  const [last] = await deps.market.all<{ d: string | null }>("SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1");
  if (!last?.d || last.d < addDays(n.date, -5)) return "prices not caught up";
  const done = await deps.market.all("SELECT 1 FROM pipeline_run WHERE pipeline='market.snapshot' AND run_key=? AND status='ok'", [n.date]);
  if (done.length) return "already done";
  const started = now.toISOString();
  try {
    const r = await snapshotIndices(n.date, deps.market, deps.fetch);
    await deps.market.run("INSERT INTO pipeline_run (pipeline, run_key, started_at, finished_at, status, detail) VALUES ('market.snapshot', ?, ?, ?, 'ok', ?)",
      [n.date, started, deps.now().toISOString(), JSON.stringify({ ...r, unmatched: r.unmatched.slice(0, 50), unmatchedCount: r.unmatched.length })]);
    return "ok";
  } catch (e) {
    await deps.market.run("INSERT INTO pipeline_run (pipeline, run_key, started_at, finished_at, status, detail) VALUES ('market.snapshot', ?, ?, ?, 'failed', ?)",
      [n.date, started, deps.now().toISOString(), JSON.stringify({ error: String(e) })]);
    return "failed";
  }
}

export async function maybeCaughtUp(deps: Deps): Promise<boolean> {
  const [last] = await deps.market.all<{ d: string | null }>("SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND universe_rows IS NOT NULL");
  return !!last?.d && last.d >= addDays(istNow(deps.now()).date, -5);
}

/** D6: January 2024 has no MCAP file; market cap = close × February's first share count,
 *  scaled back through any split/bonus between the date and that February day. Marked mcap_source = 'derived'. */
export async function deriveJanuary2024(db: Sql): Promise<number> {
  // Done once: a marker row in pipeline_run (indexed) instead of two scans of shares_daily on every run (owner #271).
  if ((await db.all("SELECT 1 FROM pipeline_run WHERE pipeline='market.derive_jan2024' AND status='ok' LIMIT 1")).length) return 0;
  const [feb] = await db.all<{ d: string | null }>("SELECT min(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND trade_date >= '2024-02-01' AND universe_rows IS NOT NULL");
  if (!feb?.d) return 0;
  const febD = dnum(feb.d)!;
  const todo = await db.all<{ security_id: number; d: number; close: number; issue_size: number; face_value_paise: number | null }>(
    `SELECT p.security_id, p.d, p.close, s.issue_size, s.face_value_paise
     FROM price_daily p JOIN shares_daily s ON s.security_id = p.security_id AND s.d = ?
     WHERE p.d < 20240201 AND p.series = 'EQ'
       AND NOT EXISTS (SELECT 1 FROM shares_daily x WHERE x.security_id = p.security_id AND x.d = p.d)
     LIMIT 5000`, [febD]);
  if (!todo.length) {
    // Prices load in strict date order, so once March 2024 is loaded, January and the February share counts are final.
    const [m] = await db.all<{ d: string | null }>("SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND universe_rows IS NOT NULL");
    if (m?.d && m.d >= "2024-03-01") await db.run("INSERT INTO pipeline_run (pipeline, run_key, started_at, finished_at, status) VALUES ('market.derive_jan2024', '2024-01', ?, ?, 'ok')", [new Date().toISOString(), new Date().toISOString()]);
    return 0;
  }
  const factors = await db.all<{ security_id: number; ex_date: string; factor: string }>(
    "SELECT security_id, ex_date, factor FROM adj_factor WHERE status IN ('auto','confirmed') AND ex_date < ? AND ex_date > '2023-12-31'", [feb.d]);
  const rows = todo.map((t) => {
    let issue = dec(t.issue_size);
    const iso = diso(t.d);
    for (const f of factors) if (f.security_id === t.security_id && f.ex_date > iso) issue = mul(issue, dec(f.factor));
    const shares = round(issue, 0);
    const mcapPaise = Number(toText(round(mul(shares, dec(t.close)), 0))); // close is in paise
    return [t.security_id, t.d, Number(toText(shares)), mcapPaise, "derived", t.face_value_paise];
  });
  await batchAll(db, insertRows("INSERT INTO shares_daily (security_id,d,issue_size,mcap_paise,mcap_source,face_value_paise)", 6, rows,
    "ON CONFLICT (security_id,d) DO NOTHING"));
  return rows.length;
}

/** Owner #266 monthly write cap (D1 billed rows across market + filings, per IST month). Rows are kept per IST day;
 *  a 'YYYY-MM-00' row holds the month-to-date baseline measured from Cloudflare analytics. */
export const MONTHLY_WRITE_CAP = 45_000_000; // MONTHLY_WRITE_CAP env var overrides
export async function monthUsed(db: Sql, now: Date): Promise<number> {
  const [r] = await db.all<{ rows: number | null }>("SELECT sum(rows) AS rows FROM write_budget WHERE day LIKE ?", [istNow(now).date.slice(0, 7) + "-%"]);
  return r?.rows ?? 0;
}
export async function capLeft(db: Sql, now: Date, cap = MONTHLY_WRITE_CAP): Promise<number> {
  return cap - (await monthUsed(db, now));
}
export async function chargeBudget(db: Sql, now: Date, rows: number): Promise<void> {
  if (rows > 0) await db.run("INSERT INTO write_budget (day, rows) VALUES (?, ?) ON CONFLICT (day) DO UPDATE SET rows = rows + excluded.rows", [istNow(now).date, rows]);
}

/** Maintenance pause: a row 'paused' in job_lock stops runs before the next date. */
export async function paused(db: Sql): Promise<boolean> {
  return (await db.all("SELECT 1 FROM job_lock WHERE name='paused'")).length > 0;
}
