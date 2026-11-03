// disclo-filings Worker (M2): loads canonical results from XBRL in R2 into the filings DB, every few minutes.
import { d1Sql } from "./d1.js";
import { auditJumps } from "./audit.js";
import { backfillBsCf, loadBatch, versionBackfill } from "./load.js";
import { census } from "./census.js";
import { loadEvents } from "./events.js";
import { caLists } from "./calists.js";

export interface Env { DB_FILINGS: D1Database; DB_MARKET: D1Database; RAW: R2Bucket; ENVIRONMENT: string; MONTHLY_WRITE_CAP?: string; BSCF_LOAD?: string }

/** Owner #266: one monthly cap on billed D1 writes, shared with the market worker (ledger in the market DB). */
const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
async function capReached(env: Env, now: Date): Promise<boolean> {
  const r = await env.DB_MARKET.prepare("SELECT sum(rows) AS rows FROM write_budget WHERE day LIKE ?1").bind(istDay(now).slice(0, 7) + "-%").first<{ rows: number | null }>();
  return (r?.rows ?? 0) >= Number(env.MONTHLY_WRITE_CAP ?? 45_000_000);
}

async function getText(bucket: R2Bucket, key: string): Promise<string | null> {
  const o = await bucket.get(key);
  if (!o) return null;
  if (o.customMetadata?.enc === "gzip") return new Response(o.body.pipeThrough(new DecompressionStream("gzip"))).text();
  return o.text();
}

export default {
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      // One run at a time (cron fires every minute; a run can take longer).
      const now = new Date(), holder = crypto.randomUUID();
      const lock = await env.DB_FILINGS.prepare(`INSERT INTO job_lock (name, holder, expires_at) VALUES ('filings', ?1, ?2)
        ON CONFLICT (name) DO UPDATE SET holder = ?1, expires_at = ?2 WHERE job_lock.expires_at < ?3`)
        .bind(holder, new Date(now.getTime() + 5 * 60_000).toISOString(), now.toISOString()).run();
      if (!lock.meta.changes) return;
      if (await capReached(env, now)) { await env.DB_FILINGS.prepare("DELETE FROM job_lock WHERE name='filings' AND holder=?1").bind(holder).run(); console.log(JSON.stringify({ env: env.ENVIRONMENT, skipped: "monthly write cap reached" })); return; }
      const meter = { rows: 0 };
      let out: Awaited<ReturnType<typeof loadBatch>> = [];
      try {
        const ldeps = { filings: d1Sql(env.DB_FILINGS, meter), market: d1Sql(env.DB_MARKET), getText: (k: string) => getText(env.RAW, k), now: () => new Date(), bscf: env.BSCF_LOAD === "1" };
        // C47: events first. Placed last, they never ran while the results backlog filled every run (cursor stuck at
        // job 250168; INFY 20 of NSE's 2,199 insider trades). Lists are small; 150 per run.
        await loadEvents(ldeps.filings, ldeps.getText, 150); // M2 events: PIT, SAST, board meetings, credit ratings (owner #289)
        out = await loadBatch(ldeps, 300, 8);
        if (ldeps.bscf) await backfillBsCf(ldeps, out.length < 300 ? 200 : 60); // M2: BS/CF + FY (D90) for earlier filings; a small share every run (it never started while the backlog filled every run)
        await versionBackfill(ldeps.filings, 150); // D48: label earlier-loaded revisions once
      } finally {
        await env.DB_FILINGS.prepare("DELETE FROM job_lock WHERE name='filings' AND holder=?1").bind(holder).run();
      }
      if (meter.rows > 0) await env.DB_MARKET.prepare("INSERT INTO write_budget (day, rows) VALUES (?1, ?2) ON CONFLICT (day) DO UPDATE SET rows = rows + excluded.rows").bind(istDay(new Date()), meter.rows).run();
      const by: Record<string, number> = {};
      for (const o of out) by[o.status] = (by[o.status] ?? 0) + 1;
      console.log(JSON.stringify({ env: env.ENVIRONMENT, processed: out.length, by }));
    })());
  },
  async fetch(req: Request, env: Env) {
    const path = new URL(req.url).pathname;
    if (path === "/revisions") {
      // Read-only (D48): periods with more than one results filing for the same security and basis, with key figures.
      const rows = (await env.DB_FILINGS.prepare(`SELECT f.security_id, f.period_end, f.period_kind, f.basis, count(*) AS n, group_concat(f.disclosed_at, ' | ') AS disclosed
        FROM filing f WHERE f.kind <> 'shareholding' GROUP BY f.security_id, f.period_end, f.period_kind, f.basis HAVING count(*) > 1 ORDER BY n DESC LIMIT 40`).all()).results;
      const total = (await env.DB_FILINGS.prepare(`SELECT count(*) AS groups, sum(n) AS filings FROM (SELECT count(*) AS n FROM filing WHERE kind <> 'shareholding' GROUP BY security_id, period_end, period_kind, basis HAVING count(*) > 1)`).first());
      return Response.json({ total, sample: rows }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/events-count") {
      // Read-only: loaded event rows for one symbol and date range (owner #290: counts checked against NSE's own lists).
      const u = new URL(req.url), sym = u.searchParams.get("symbol") ?? "", from = Number(u.searchParams.get("from") ?? 0), to = Number(u.searchParams.get("to") ?? 99991231);
      const one = async (sql: string) => ((await env.DB_FILINGS.prepare(sql).bind(sym, from, to).first<{ n: number }>())?.n ?? 0);
      return Response.json({
        symbol: sym,
        insider_trades: await one("SELECT count(*) AS n FROM insider_trade WHERE symbol=?1 AND coalesce(from_d, 0) BETWEEN ?2 AND ?3"),
        sast: await one("SELECT count(*) AS n FROM sast_disclosure WHERE symbol=?1 AND cast(replace(substr(disclosed_at,1,10),'-','') AS INTEGER) BETWEEN ?2 AND ?3"),
        board_meetings: await one("SELECT count(*) AS n FROM board_meeting WHERE symbol=?1 AND coalesce(meeting_d, 0) BETWEEN ?2 AND ?3"),
      }, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/held") {
      // Read-only: held/excluded items of one class, with their file URLs, for class-by-class fixes (D140).
      const u = new URL(req.url);
      const like = (u.searchParams.get("like") ?? "").slice(0, 40) + "%";
      const rows = (await env.DB_FILINGS.prepare("SELECT l.job_id, l.status, substr(l.detail,1,160) AS detail, j.kind, j.symbol, j.url FROM fin_load l JOIN fetch_job j ON j.job_id = l.job_id WHERE l.status IN ('review','failed','excluded') AND l.detail LIKE ?1 ORDER BY l.job_id LIMIT 60").bind(like).all()).results;
      return Response.json(rows, { headers: { "cache-control": "no-store" } });
    }
    if (path === "/ca-lists") {
      const u = new URL(req.url);
      return Response.json(await caLists(d1Sql(env.DB_FILINGS), (k) => getText(env.RAW, k), Number(u.searchParams.get("after") ?? 0), Math.min(200, Number(u.searchParams.get("limit") ?? 200))), { headers: { "cache-control": "no-store" } });
    }
    if (path === "/census") {
      const u = new URL(req.url);
      const after = Number(u.searchParams.get("after") ?? 0), limit = Math.min(50, Math.max(1, Number(u.searchParams.get("limit") ?? 40)));
      return Response.json(await census(d1Sql(env.DB_FILINGS), (k) => getText(env.RAW, k), after, limit), { headers: { "cache-control": "no-store" } });
    }
    if (path === "/audit") return Response.json(await auditJumps(d1Sql(env.DB_FILINGS)), { headers: { "cache-control": "no-store" } });
    if (path !== "/status") return new Response("not found", { status: 404 });
    const q = async (s: string) => (await env.DB_FILINGS.prepare(s).all()).results;
    return Response.json({
      by_status: await q("SELECT status, count(*) AS n FROM fin_load GROUP BY status"),
      review_reasons: await q("SELECT substr(detail,1,60) AS reason, count(*) AS n FROM fin_load WHERE status IN ('review','failed') GROUP BY 1 ORDER BY 2 DESC LIMIT 15"),
      filings: await q("SELECT count(*) AS n FROM filing"),
      values: await q("SELECT basis, count(*) AS n FROM fin_value GROUP BY basis"),
      shareholding_filings: await q("SELECT count(*) AS n FROM filing WHERE kind='shareholding'"),
      bs_cf_values: await q("SELECT statement, count(*) AS n FROM fin_value WHERE statement IN ('bs','cf') GROUP BY statement"),
      restatements: { flags: (await q("SELECT count(*) AS n FROM restatement_flag"))[0], versions: await q("SELECT version, count(*) AS n FROM fin_value GROUP BY version"), backfill: await q("SELECT detail FROM daily_refresh WHERE day='once' AND slot='version_backfill'") },
      bscf_backfill: await q("SELECT detail FROM daily_refresh WHERE day='once' AND slot='bscf_backfill'"),
      events: { cursor: await q("SELECT detail FROM daily_refresh WHERE day='once' AND slot='events_cursor'"), insider_trades: (await q("SELECT count(*) AS n FROM insider_trade"))[0], sast: (await q("SELECT count(*) AS n FROM sast_disclosure"))[0], board_meetings: (await q("SELECT count(*) AS n FROM board_meeting"))[0], credit_ratings: (await q("SELECT count(*) AS n FROM credit_rating"))[0] },
      review_samples: await q("SELECT l.status, substr(l.detail,1,120) AS detail, j.symbol, j.url FROM fin_load l JOIN fetch_job j ON j.job_id = l.job_id WHERE l.status IN ('review','failed') ORDER BY l.at DESC LIMIT 8"),
    }, { headers: { "cache-control": "no-store" } });
  },
};
