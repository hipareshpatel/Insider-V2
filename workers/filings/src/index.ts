// disclo-filings Worker (M2): loads canonical results from XBRL in R2 into the filings DB, every few minutes.
import { d1Sql } from "./d1.js";
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
      const out = await loadBatch({ filings: d1Sql(env.DB_FILINGS), market: d1Sql(env.DB_MARKET), getText: (k) => getText(env.RAW, k), now: () => new Date() });
      const by: Record<string, number> = {};
      for (const o of out) by[o.status] = (by[o.status] ?? 0) + 1;
      console.log(JSON.stringify({ env: env.ENVIRONMENT, processed: out.length, by }));
    })());
  },
  async fetch(req: Request, env: Env) {
    if (new URL(req.url).pathname !== "/status") return new Response("not found", { status: 404 });
    const q = async (s: string) => (await env.DB_FILINGS.prepare(s).all()).results;
    return Response.json({
      by_status: await q("SELECT status, count(*) AS n FROM fin_load GROUP BY status"),
      review_reasons: await q("SELECT substr(detail,1,60) AS reason, count(*) AS n FROM fin_load WHERE status IN ('review','failed') GROUP BY 1 ORDER BY 2 DESC LIMIT 15"),
      filings: await q("SELECT count(*) AS n FROM filing"),
      values: await q("SELECT basis, count(*) AS n FROM fin_value GROUP BY basis"),
    }, { headers: { "cache-control": "no-store" } });
  },
};
