// disclo-filings Worker (M2): loads canonical results from XBRL in R2 into the filings DB, every few minutes.
import { d1Sql } from "./d1.js";
import { auditJumps } from "./audit.js";
import { loadBatch } from "./load.js";

export interface Env { DB_FILINGS: D1Database; DB_MARKET: D1Database; RAW: R2Bucket; ENVIRONMENT: string }

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
      let out: Awaited<ReturnType<typeof loadBatch>> = [];
      try {
        out = await loadBatch({ filings: d1Sql(env.DB_FILINGS), market: d1Sql(env.DB_MARKET), getText: (k) => getText(env.RAW, k), now: () => new Date() }, 300, 8);
      } finally {
        await env.DB_FILINGS.prepare("DELETE FROM job_lock WHERE name='filings' AND holder=?1").bind(holder).run();
      }
      const by: Record<string, number> = {};
      for (const o of out) by[o.status] = (by[o.status] ?? 0) + 1;
      console.log(JSON.stringify({ env: env.ENVIRONMENT, processed: out.length, by }));
    })());
  },
  async fetch(req: Request, env: Env) {
    const path = new URL(req.url).pathname;
    if (path === "/audit") return Response.json(await auditJumps(d1Sql(env.DB_FILINGS)), { headers: { "cache-control": "no-store" } });
    if (path !== "/status") return new Response("not found", { status: 404 });
    const q = async (s: string) => (await env.DB_FILINGS.prepare(s).all()).results;
    return Response.json({
      by_status: await q("SELECT status, count(*) AS n FROM fin_load GROUP BY status"),
      review_reasons: await q("SELECT substr(detail,1,60) AS reason, count(*) AS n FROM fin_load WHERE status IN ('review','failed') GROUP BY 1 ORDER BY 2 DESC LIMIT 15"),
      filings: await q("SELECT count(*) AS n FROM filing"),
      values: await q("SELECT basis, count(*) AS n FROM fin_value GROUP BY basis"),
      shareholding_filings: await q("SELECT count(*) AS n FROM filing WHERE kind='shareholding'"),
      review_samples: await q("SELECT l.status, substr(l.detail,1,120) AS detail, j.symbol, j.url FROM fin_load l JOIN fetch_job j ON j.job_id = l.job_id WHERE l.status IN ('review','failed') ORDER BY l.at DESC LIMIT 8"),
    }, { headers: { "cache-control": "no-store" } });
  },
};
