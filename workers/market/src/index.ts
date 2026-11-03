// disclo-market Worker: nightly market job + backfill, both driven by cron (§6, D10, D124).
import { archiveFetcher, r2FirstFetcher } from "./archive.js";
import { d1Sql, r2Raw } from "./d1.js";
import { acceptance } from "./acceptance.js";
import { runPending } from "./runner.js";

export interface Env {
  DB_MARKET: D1Database;
  DB_APP: D1Database;
  RAW: R2Bucket;
  ENVIRONMENT: string;
  BACKFILL_FROM?: string; // staging loads recent dates only
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
      const deps = { market: d1Sql(env.DB_MARKET), app: d1Sql(env.DB_APP), raw: r2Raw(env.RAW), fetch: r2FirstFetcher(env.RAW, archiveFetcher()), now: () => new Date(), cachedFromR2: true };
      const out = await withLock(env.DB_MARKET, 14 * 60_000, () => runPending(deps, { maxDates: 40, budgetMs: 8 * 60_000, revisitSessions: 5, from: env.BACKFILL_FROM }));
      console.log(JSON.stringify({ env: env.ENVIRONMENT, ran: out?.map((r) => ({ d: r.date, s: r.status, c: r.counts, why: r.reasons?.slice(0, 3) })) ?? "locked" }));
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
      price_rows: (await q("SELECT count(*) AS n FROM price_daily"))[0],
      written_today: (await q("SELECT day, rows FROM write_budget ORDER BY day DESC LIMIT 2")),
      factors: (await q("SELECT status, count(*) AS n FROM adj_factor GROUP BY status")),
      last_runs: await q("SELECT run_key, status, started_at, substr(detail,1,300) AS detail FROM pipeline_run ORDER BY run_id DESC LIMIT 10"),
      failed_or_rejected: (await q("SELECT count(*) AS n FROM pipeline_run WHERE status='failed'"))[0],
      open_reviews: (await (env.DB_APP.prepare("SELECT kind, count(*) AS n FROM review_item WHERE status='open' GROUP BY kind").all())).results,
    };
    return Response.json(body, { headers: { "cache-control": "no-store" } });
  },
};
