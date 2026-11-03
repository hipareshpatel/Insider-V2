// disclo-market Worker: nightly market job + backfill, both driven by cron (§6, D10, D124).
import { archiveFetcher, r2FirstFetcher } from "./archive.js";
import { d1Sql, r2Raw } from "./d1.js";
import { acceptance } from "./acceptance.js";
import { jumps } from "./jumps.js";
import { evidence } from "./evidence.js";
import { chargeBudget, runPending } from "./runner.js";
import { loadStructure } from "./structure.js";

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
      let structure: Record<string, number> | null = null;
      const out = await withLock(env.DB_MARKET, 14 * 60_000, async () => {
        const t0 = Date.now();
        const r = await runPending(deps, { maxDates: 40, budgetMs: 8 * 60_000, revisitSessions: 5, from: env.BACKFILL_FROM, monthlyCap: env.MONTHLY_WRITE_CAP ? Number(env.MONTHLY_WRITE_CAP) : undefined });
        // M1 market structure (D144): R2 only, in date order, within what is left of this run.
        structure = await loadStructure({ market: deps.market, raw: env.RAW, now: deps.now }, Math.max(0, 11 * 60_000 - (Date.now() - t0)));
        return r;
      });
      // runPending already charged each date's price/factor rows; charge the rest (identity, ledger, reviews, snapshot).
      const charged = (out ?? []).reduce((n, r) => n + (r.written ?? 0), 0);
      if (out && meter.rows > charged) await chargeBudget(d1Sql(env.DB_MARKET), new Date(), meter.rows - charged);
      console.log(JSON.stringify({ env: env.ENVIRONMENT, rows_written: meter.rows, structure, ran: out?.map((r) => ({ d: r.date, s: r.status, c: r.counts, why: r.reasons?.slice(0, 3) })) ?? "locked" }));
    })());
  },

  // Read-only status (no data beyond counts and run states). Useful from a phone: /status
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/closes") {
      // D141 second cycle: one security's closes in a window (read-only).
      const rows = (await env.DB_MARKET.prepare("SELECT p.d, p.series, p.open, p.close, s.issue_size, s.face_value_paise FROM price_daily p LEFT JOIN shares_daily s ON s.security_id = p.security_id AND s.d = p.d WHERE p.security_id=?1 AND p.d BETWEEN ?2 AND ?3 ORDER BY p.d, p.series='EQ' DESC")
        .bind(Number(url.searchParams.get("sid")), Number(url.searchParams.get("from")), Number(url.searchParams.get("to"))).all()).results;
      return Response.json(rows, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/evidence") {
      return Response.json(await evidence(d1Sql(env.DB_MARKET), Number(url.searchParams.get("sid")), String(url.searchParams.get("d"))), { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/jumps") {
      return Response.json(await jumps(d1Sql(env.DB_MARKET), Number(url.searchParams.get("after") ?? 0), Math.min(150, Number(url.searchParams.get("limit") ?? 100))), { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/corp-actions") {
      // Read-only export for the whole-population comparison with NSE's per-company lists (owner #271 follow-up).
      const after = Number(url.searchParams.get("after") ?? 0);
      const rows = (await env.DB_MARKET.prepare(`SELECT c.ca_id, i.value AS symbol, c.ex_date, c.type, c.raw_purpose FROM corp_action c
        LEFT JOIN security_identifier i ON i.security_id = c.security_id AND i.id_type = 'nse_symbol' AND i.valid_to IS NULL
        WHERE c.ca_id > ?1 ORDER BY c.ca_id LIMIT 2000`).bind(after).all()).results;
      return Response.json({ rows, next: rows.length === 2000 ? (rows[rows.length - 1] as { ca_id: number }).ca_id : null }, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/acceptance") {
      return Response.json(await acceptance(d1Sql(env.DB_MARKET), d1Sql(env.DB_APP)), { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/reviews") {
      const kind = url.searchParams.get("kind");
      // Full export for item-by-item decisions (D141): id, evidence and proposal; paged by review_id.
      const after = Number(url.searchParams.get("after") ?? 0);
      const rows = (await env.DB_APP.prepare(`SELECT review_id, kind, subject_ref, summary, evidence, proposed, created_at FROM review_item WHERE status='open' AND review_id > ?1 ${kind ? "AND kind = ?2" : ""} ORDER BY review_id LIMIT 500`)
        .bind(after, ...(kind ? [kind] : [])).all()).results;
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
      market_structure: await q("SELECT source, count(*) AS days, max(d) AS last, sum(rows < 0) AS missing, sum(note LIKE 'possibly truncated%') AS truncated, sum(max(rows,0)) AS rows FROM ms_day GROUP BY source"),
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
