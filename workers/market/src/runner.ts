// Decides which dates to (re)run, in order, within a time budget. Used by both the nightly cron and the backfill.
import { type Sql, batchAll, dec, insertRows, mul, round, toText } from "@disclo/core";
import { type DayReport, type Deps, runDay } from "./daily.js";
import { snapshotIndices } from "./snapshot.js";
import { addDays, datesBetween, eligible, istNow } from "./dates.js";

export const HISTORY_START = "2024-01-01"; // D2

export interface RunOptions { maxDates: number; budgetMs: number; revisitSessions: number; from?: string }

export async function pendingDates(db: Sql, now: Date, revisit: number, from = HISTORY_START): Promise<string[]> {
  const today = istNow(now).date;
  const all = datesBetween(from < HISTORY_START ? HISTORY_START : from, today).filter((d) => eligible(d, now));
  const done = new Set((await db.all<{ run_key: string }>(
    "SELECT DISTINCT run_key FROM pipeline_run WHERE pipeline='market.daily' AND status IN ('ok','skipped')")).map((r) => r.run_key));
  const recentFail = new Set((await db.all<{ run_key: string }>(
    "SELECT DISTINCT run_key FROM pipeline_run WHERE pipeline='market.daily' AND status='failed' AND started_at > ? AND (detail IS NULL OR detail NOT LIKE '%\"status\":\"pending\"%')",
    [new Date(now.getTime() - 3 * 3600_000).toISOString()])).map((r) => r.run_key));
  const todo = all.filter((d) => !done.has(d) && !recentFail.has(d));
  // Revised-file check (§5.2): re-fetch the last N sessions once a day; unchanged bytes cost nothing.
  const recent = (await db.all<{ trade_date: string }>(
    "SELECT trade_date FROM trading_calendar WHERE is_session=1 ORDER BY trade_date DESC LIMIT ?", [revisit])).map((r) => r.trade_date);
  const checkedToday = new Set((await db.all<{ run_key: string }>(
    "SELECT DISTINCT run_key FROM pipeline_run WHERE pipeline='market.daily' AND started_at >= ?", [`${addDays(today, -1)}T16:30:00Z`])).map((r) => r.run_key));
  for (const d of recent) if (!checkedToday.has(d) && !todo.includes(d)) todo.push(d);
  return todo.sort();
}

export async function runPending(deps: Deps, opt: RunOptions): Promise<DayReport[]> {
  const t0 = Date.now();
  const out: DayReport[] = [];
  for (const d of (await pendingDates(deps.market, deps.now(), opt.revisitSessions, opt.from)).slice(0, opt.maxDates)) {
    if (Date.now() - t0 > opt.budgetMs) break;
    const r = await runDay(d, deps);
    out.push(r);
    if (r.status === "failed" && r.reasons?.some((x) => x.includes("ArchiveStopped"))) break;
  }
  await deriveJanuary2024(deps.market);
  await maybeSnapshot(deps);
  return out;
}

/** Once per IST day, after 22:00, and only when prices are caught up (index lists match on current ISINs). */
export async function maybeSnapshot(deps: Deps): Promise<string> {
  const now = deps.now();
  const n = istNow(now);
  if (n.minutes < 22 * 60) return "before 22:00 IST";
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

/** D6: January 2024 has no MCAP file; market cap = close × February's first share count,
 *  scaled back through any split/bonus between the date and that February day. Marked mcap_source = 'derived'. */
export async function deriveJanuary2024(db: Sql): Promise<number> {
  const [feb] = await db.all<{ d: string | null }>("SELECT min(trade_date) AS d FROM shares_daily WHERE trade_date >= '2024-02-01' AND mcap_source='nse'");
  if (!feb?.d) return 0;
  const todo = await db.all<{ security_id: number; trade_date: string; close: string; issue_size: number; face_value: string | null }>(
    `SELECT p.security_id, p.trade_date, p.close, s.issue_size, s.face_value
     FROM price_daily p JOIN shares_daily s ON s.security_id = p.security_id AND s.trade_date = ?
     WHERE p.trade_date < '2024-02-01' AND p.series = 'EQ'
       AND NOT EXISTS (SELECT 1 FROM shares_daily x WHERE x.security_id = p.security_id AND x.trade_date = p.trade_date)
     LIMIT 5000`, [feb.d]);
  if (!todo.length) return 0;
  const factors = await db.all<{ security_id: number; ex_date: string; factor: string }>(
    "SELECT security_id, ex_date, factor FROM adj_factor WHERE ex_date < ? AND ex_date > '2023-12-31'", [feb.d]);
  const rows = todo.map((t) => {
    let issue = dec(t.issue_size);
    for (const f of factors) if (f.security_id === t.security_id && f.ex_date > t.trade_date) issue = mul(issue, dec(f.factor));
    const shares = toText(round(issue, 0));
    return [t.security_id, t.trade_date, Number(shares), t.face_value, toText(round(mul(dec(shares), dec(t.close)), 2)), "derived", null];
  });
  await batchAll(db, insertRows("INSERT INTO shares_daily (security_id,trade_date,issue_size,face_value,mcap_rs,mcap_source,file_id)", 7, rows,
    "ON CONFLICT (security_id,trade_date) DO NOTHING"));
  return rows.length;
}
