// disclo-market Worker: nightly market job + backfill, both driven by cron (§6, D10, D124).
import { archiveFetcher, r2FirstFetcher } from "./archive.js";
import { d1Sql, r2Raw } from "./d1.js";
import { acceptance } from "./acceptance.js";
import { chargeBudget, runPending } from "./runner.js";

export interface Env {
  DB_MARKET: D1Database;
  DB_APP: D1Database;
  RAW: R2Bucket;
  ENVIRONMENT: string;
  BACKFILL_FROM?: string; // staging loads recent dates only
  MONTHLY_WRITE_CAP?: string;  // owner #266: billed D1 rows per IST month (market + filings); bulk work stops at the cap
  CACHE_AUTHORITATIVE_UNTIL?: string; // D128: archive prefetch complete up to this date
}

const LOCK = "market.daily";

async function withLock<T>(db: D1Database, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
  const now = new Date();
  const holder = crypto.randomUUID();
  const r = await db.prepare(
    `INSERT INTO job_lock (name, holder, expires_at) VALUES (?1, ?2, ?3)
     ON CONFLICT (name) DO UPDATE SET holder = ?2, expires_at = ?3 WHERE job_lock.expires_at < ?4`)
    .bind(LOCK, holder, new Date(now.getTime() + ttlMs).toISOString(), now.toISOString()).run();
  if (!r.meta.changes) return null;
  try { return await fn(); } finally {
    await db.prepare("DELETE FROM job_lock WHERE name = ?1 AND holder = ?2").bind(LOCK, holder).run();
  }
}

export default {
  async scheduled(_ev: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      const meter = { rows: 0 }; // every billed row this run writes (owner #266 cap)
      const deps = { market: d1Sql(env.DB_MARKET, meter), app: d1Sql(env.DB_APP, meter), raw: r2Raw(env.RAW), fetch: r2FirstFetcher(env.RAW, archiveFetcher(), env.CACHE_AUTHORITATIVE_UNTIL), now: () => new Date(), cachedFromR2: true };
      const out = await withLock(env.DB_MARKET, 14 * 60_000, () => runPending(deps, { maxDates: 40, budgetMs: 8 * 60_000, revisitSessions: 5, from: env.BACKFILL_FROM, monthlyCap: env.MONTHLY_WRITE_CAP ? Number(env.MONTHLY_WRITE_CAP) : undefined }));
      // runPending already charged each date's price/factor rows; charge the rest (identity, ledger, reviews, snapshot).
      const charged = (out ?? []).reduce((n, r) => n + (r.written ?? 0), 0);
      if (out && meter.rows > charged) await chargeBudget(d1Sql(env.DB_MARKET), new Date(), meter.rows - charged);
      console.log(JSON.stringify({ env: env.ENVIRONMENT, rows_written: meter.rows, ran: out?.map((r) => ({ d: r.date, s: r.status, c: r.counts, why: r.reasons?.slice(0, 3) })) ?? "locked" }));
    })());
  },

  // Read-only status (no data beyond counts and run states). Useful from a phone: /status
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/acceptance") {
      return Response.json(await acceptance(d1Sql(env.DB_MARKET), d1Sql(env.DB_APP)), { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/reviews") {
      const kind = url.searchParams.get("kind");
      const rows = (await env.DB_APP.prepare(`SELECT kind, subject_ref, summary, created_at FROM review_item WHERE status='open' ${kind ? "AND kind = ?1" : ""} ORDER BY review_id DESC LIMIT 200`)
        .bind(...(kind ? [kind] : [])).all()).results;
      return Response.json(rows, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname !== "/status") return new Response("not found", { status: 404 });
    const db = env.DB_MARKET;
    const q = async (sql: string) => (await db.prepare(sql).all()).results;
    const body = {
      environment: env.ENVIRONMENT,
      paused: (await q("SELECT count(*) AS n FROM job_lock WHERE name='paused'"))[0],
      running_lock: (await q("SELECT expires_at FROM job_lock WHERE name='market.daily'"))[0] ?? null,
      sessions_loaded: (await q("SELECT count(*) AS n, min(trade_date) AS first, max(trade_date) AS last FROM trading_calendar WHERE is_session=1"))[0],
      securities: (await q("SELECT count(*) AS n FROM security"))[0],
      // Owner #271: no count(*) over price_daily here (1.6M rows read per call); latest session's rows instead.
      latest_session_rows: (await q("SELECT trade_date, universe_rows FROM trading_calendar WHERE is_session=1 AND universe_rows IS NOT NULL ORDER BY trade_date DESC LIMIT 1"))[0],
      ledger_keys: await q("SELECT substr(r2_key, 1, instr(r2_key, '/')) AS store, count(*) AS n FROM source_file GROUP BY 1"),
      written_today: (await q("SELECT day, rows FROM write_budget ORDER BY day DESC LIMIT 2")),
      written_month: (await q("SELECT substr(day,1,7) AS month, sum(rows) AS rows FROM write_budget GROUP BY 1 ORDER BY 1 DESC LIMIT 1"))[0],
      factors: (await q("SELECT status, count(*) AS n FROM adj_factor GROUP BY status")),
      last_runs: await q("SELECT run_key, status, started_at, substr(detail,1,300) AS detail FROM pipeline_run ORDER BY run_id DESC LIMIT 10"),
      failed_or_rejected: (await q("SELECT count(*) AS n FROM pipeline_run WHERE status='failed'"))[0],
      open_reviews: (await (env.DB_APP.prepare("SELECT kind, count(*) AS n FROM review_item WHERE status='open' GROUP BY kind").all())).results,
    };
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  },
};
