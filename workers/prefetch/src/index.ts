// disclo-prefetch Worker (D128): fetch raw NSE API responses for every company into R2, as fast as NSE allows.
import { EQUITY_SERIES, type Sql, batchAll, insertRows, parseEquityList, sha256Hex } from "@disclo/core";
import { d1Sql } from "./d1.js";
import { bulkJobs, companyJobs } from "./jobs.js";

export interface Env { DB_FILINGS: D1Database; RAW: R2Bucket; ENVIRONMENT: string; PARALLEL?: string; PER_RUN?: string }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function seed(db: Sql, raw: R2Bucket, today: string): Promise<number> {
  const [n] = await db.all<{ n: number }>("SELECT count(*) AS n FROM fetch_job");
  if ((n?.n ?? 0) > 0) return 0;
  // Company list: prefetched copy in R2 first (D128), else NSE with retries.
  let text: string | null = null;
  const cached = await raw.get("cache/content/equities/EQUITY_L.csv");
  if (cached) text = await cached.text();
  for (let i = 0; !text && i < 4; i++) {
    const r = await fetch("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv", { headers: { "User-Agent": UA, Accept: "*/*" } });
    if (r.ok) text = await r.text(); else { await r.body?.cancel(); await new Promise((x) => setTimeout(x, 3000 * (i + 1))); }
  }
  if (!text) throw new Error("EQUITY_L not available (R2 cache missing, NSE refused)");
  const symbols = parseEquityList(text).filter((x) => EQUITY_SERIES.has(x.series) || x.series === "EQ").map((x) => x.symbol);
  const jobs = [...bulkJobs(today).map((j) => [j.kind, null, j.url, j.key]), ...companyJobs(symbols, today).map((j) => [j.kind, j.symbol, j.url, j.key])];
  await batchAll(db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key)", 4, jobs));
  return jobs.length;
}

async function cookies(): Promise<string> {
  try {
    const r = await fetch("https://www.nseindia.com/", { headers: { "User-Agent": UA, Accept: "text/html" } });
    await r.body?.cancel();
    return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  } catch { return ""; }
}

export async function runBatch(env: Env, now = new Date()) {
  const db = d1Sql(env.DB_FILINGS);
  const today = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const seeded = await seed(db, env.RAW, today);
  const perRun = Number(env.PER_RUN ?? 240);
  const parallel = Number(env.PARALLEL ?? 6);
  const todo = await db.all<{ job_id: number; url: string; r2_key: string; attempts: number }>(
    "SELECT job_id, url, r2_key, attempts FROM fetch_job WHERE status='todo' OR (status='failed' AND attempts < 4) ORDER BY attempts, job_id LIMIT ?", [perRun]);
  if (!todo.length) return { seeded, done: 0, left: 0 };
  const ck = await cookies();
  const headers = { "User-Agent": UA, Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", Referer: "https://www.nseindia.com/", Cookie: ck };
  let refusals = 0, ok = 0, empty = 0, failed = 0;
  const results: unknown[][] = [];
  let i = 0;
  let stop = false;
  const worker = async () => {
    while (i < todo.length && !stop) {
      const j = todo[i++]!;
      try {
        const r = await fetch(j.url, { headers });
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (r.status === 403 || r.status === 429 || r.status === 503) {
          refusals++; failed++;
          results.push([j.job_id, "failed", j.attempts + 1, r.status, bytes.length, null, now.toISOString(), `refused ${r.status}`]);
          if (refusals >= 5) stop = true; // NSE is pushing back: end this run, next minute continues
          continue;
        }
        if (r.status !== 200) { failed++; results.push([j.job_id, "failed", j.attempts + 1, r.status, bytes.length, null, now.toISOString(), `HTTP ${r.status}`]); continue; }
        const sha = await sha256Hex(bytes);
        const isEmpty = bytes.length <= 4 || /^\s*(\[\s*\]|\{\s*"data"\s*:\s*\[\s*\]\s*\})/.test(new TextDecoder().decode(bytes.subarray(0, 64)));
        await env.RAW.put(j.r2_key, bytes, { httpMetadata: { contentType: r.headers.get("content-type") ?? "application/json" }, customMetadata: { url: j.url, fetched_at: now.toISOString() } });
        if (isEmpty) empty++; else ok++;
        results.push([j.job_id, isEmpty ? "empty" : "done", j.attempts + 1, 200, bytes.length, sha, now.toISOString(), null]);
      } catch (e) {
        failed++;
        results.push([j.job_id, "failed", j.attempts + 1, null, null, null, now.toISOString(), String(e).slice(0, 200)]);
      }
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  await batchAll(db, results.map((r) => ({
    sql: "UPDATE fetch_job SET status=?2, attempts=?3, http_status=?4, bytes=?5, sha256=?6, fetched_at=?7, error=?8 WHERE job_id=?1",
    params: r,
  })));
  const [left] = await db.all<{ n: number }>("SELECT count(*) AS n FROM fetch_job WHERE status='todo' OR (status='failed' AND attempts < 4)");
  return { seeded, done: ok, empty, failed, refusals, left: left?.n ?? 0 };
}

async function withLock<T>(db: D1Database, fn: () => Promise<T>): Promise<T | null> {
  const now = new Date(), holder = crypto.randomUUID();
  const r = await db.prepare(`INSERT INTO job_lock (name, holder, expires_at) VALUES ('prefetch', ?1, ?2)
    ON CONFLICT (name) DO UPDATE SET holder = ?1, expires_at = ?2 WHERE job_lock.expires_at < ?3`)
    .bind(holder, new Date(now.getTime() + 5 * 60_000).toISOString(), now.toISOString()).run();
  if (!r.meta.changes) return null;
  try { return await fn(); } finally { await db.prepare("DELETE FROM job_lock WHERE name='prefetch' AND holder=?1").bind(holder).run(); }
}

export default {
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      let detail: unknown;
      try { detail = (await withLock(env.DB_FILINGS, () => runBatch(env))) ?? "locked"; } catch (e) { detail = { error: String(e instanceof Error ? e.message : e) }; }
      if (detail !== "locked") await env.DB_FILINGS.prepare("INSERT INTO prefetch_log (at, detail) VALUES (?1, ?2)").bind(new Date().toISOString(), JSON.stringify(detail)).run();
    })());
  },
  async fetch(req: Request, env: Env) {
    if (new URL(req.url).pathname !== "/status") return new Response("not found", { status: 404 });
    const q = async (s: string) => (await env.DB_FILINGS.prepare(s).all()).results;
    return Response.json({
      environment: env.ENVIRONMENT,
      by_status: await q("SELECT status, count(*) AS n, sum(bytes) AS bytes FROM fetch_job GROUP BY status"),
      by_kind: await q("SELECT kind, sum(status='done') AS done, sum(status='empty') AS empty, sum(status='failed') AS failed, sum(status='todo') AS todo FROM fetch_job GROUP BY kind"),
      recent_errors: await q("SELECT kind, symbol, http_status, error FROM fetch_job WHERE status='failed' ORDER BY fetched_at DESC LIMIT 5"),
      last_runs: await q("SELECT at, detail FROM prefetch_log ORDER BY id DESC LIMIT 5"),
    }, { headers: { "cache-control": "no-store" } });
  },
};
