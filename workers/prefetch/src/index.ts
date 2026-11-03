// disclo-prefetch Worker (D128): fetch raw NSE API responses for every company into R2, as fast as NSE allows.
import { EQUITY_SERIES, type Sql, batchAll, insertRows, parseEquityList, sha256Hex } from "@disclo/core";
import { d1Sql } from "./d1.js";
import { attachmentKey, attachments } from "./discover.js";
import { bulkJobs, companyJobs } from "./jobs.js";
import { dailyRefresh, dueSlot, seedFullHistory, seedStructureHistory } from "./daily.js";
import { compressStep } from "./compress.js";

export interface Env { DB_FILINGS: D1Database; DB_MARKET: D1Database; RAW: R2Bucket; ENVIRONMENT: string; PARALLEL?: string; PER_RUN?: string; INGEST_TOKEN?: string }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function seed(db: Sql, raw: R2Bucket, today: string): Promise<number> {
  if ((await db.all("SELECT 1 FROM fetch_job LIMIT 1")).length) return 0; // owner #271: not count(*) every minute
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

/** Queue archive-hosted XML attachments found in downloaded lists (fetched by the GitHub runner, D128). */
async function discover(env: Env, db: Sql): Promise<number> {
  const lists = await db.all<{ job_id: number; kind: string; symbol: string | null; r2_key: string }>(
    "SELECT job_id, kind, symbol, r2_key FROM fetch_job WHERE status='done' AND discovered=0 AND url LIKE 'https://www.nseindia.com/%' AND kind NOT IN ('announcements','credit_rating') LIMIT 300");
  const rows: unknown[][] = [];
  for (const l of lists) {
    const obj = await env.RAW.get(l.r2_key);
    if (!obj) continue;
    for (const u of attachments(l.kind, await readText(obj), "2021-04-01")) rows.push([`xbrl_${l.kind}`, l.symbol, u, attachmentKey(u), l.job_id]);
  }
  const stmts = insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key, parent_id)", 5, rows);
  for (let i = 0; i < lists.length; i += 90) {
    const ids = lists.slice(i, i + 90).map((l) => l.job_id);
    stmts.push({ sql: `UPDATE fetch_job SET discovered=1 WHERE job_id IN (${ids.map(() => "?").join(",")})`, params: ids }); // D1: <= 100 params
  }
  await batchAll(db, stmts);
  return rows.length;
}

async function cookies(): Promise<string> {
  try {
    const r = await fetch("https://www.nseindia.com/", { headers: { "User-Agent": UA, Accept: "text/html" } });
    await r.body?.cancel();
    return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  } catch { return ""; }
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
}

/** Complete XML: ends with a closing tag (after trailing whitespace). A cut-off download ends mid-element. */
export function xmlComplete(bytes: Uint8Array): boolean {
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 256))).trimEnd();
  return bytes.length > 0 && /<\/[\w:.-]+>$/.test(tail);
}

/** D131: gzip text objects in R2 (marked with customMetadata.enc = "gzip"); readers accept both. */
async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
}
export async function readText(obj: R2ObjectBody): Promise<string> {
  if (obj.customMetadata?.enc !== "gzip") return obj.text();
  return new Response(obj.body.pipeThrough(new DecompressionStream("gzip"))).text();
}

export async function runBatch(env: Env, now = new Date()) {
  const db = d1Sql(env.DB_FILINGS);
  const today = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const seeded = await seed(db, env.RAW, today);
  const perRun = Number(env.PER_RUN ?? 240);
  const parallel = Number(env.PARALLEL ?? 6);
  const todo = await db.all<{ job_id: number; url: string; r2_key: string; attempts: number }>(
    "SELECT job_id, url, r2_key, attempts FROM fetch_job WHERE url LIKE 'https://www.nseindia.com/%' AND (status='todo' OR (status='failed' AND attempts < 4)) ORDER BY attempts, job_id LIMIT ?", [perRun]);
  let discovered: number | string = 0;
  try { discovered = await discover(env, db); } catch (e) { discovered = `discover error: ${String(e).slice(0, 120)}`; }
  if (!todo.length) return { seeded, discovered, done: 0, left: 0 };
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
        const head = new TextDecoder().decode(bytes.subarray(0, 64));
        // V1 lesson #280: an error page is not data. NSE can answer 200 with HTML; only JSON counts as fetched.
        if (!/^\s*[[{]/.test(head)) { failed++; results.push([j.job_id, "failed", j.attempts + 1, r.status, bytes.length, null, now.toISOString(), "not JSON (HTML/error page)"]); continue; }
        const isEmpty = bytes.length <= 4 || /^\s*(\[\s*\]|\{\s*"data"\s*:\s*\[\s*\]\s*\})/.test(head);
        await env.RAW.put(j.r2_key, await gzip(bytes), { httpMetadata: { contentType: r.headers.get("content-type") ?? "application/json" }, customMetadata: { url: j.url, fetched_at: now.toISOString(), enc: "gzip" } });
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
  const [left] = await db.all<{ n: number }>("SELECT count(*) AS n FROM fetch_job WHERE url LIKE 'https://www.nseindia.com/%' AND (status='todo' OR (status='failed' AND attempts < 4))");
  return { seeded, discovered, done: ok, empty, failed, refusals, left: left?.n ?? 0 };
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
      try {
        detail = (await withLock(env.DB_FILINGS, async () => {
          const b = await runBatch(env);
          // Daily freshness (plan item 2): once per IST slot; NSE API answers Cloudflare.
          const db = d1Sql(env.DB_FILINGS), now = new Date();
          const compressed = await compressStep(db, env.RAW, gzip, gunzip); // D147: older objects → gzip, ~200/min until done
          const full = await seedFullHistory(db, now); // C40: complete history for the 20-row-capped lists, once
          if (full) return { ...b, full_history_queued: full };
          const seeded = await seedStructureHistory(db, now); // D144: once; fetched by the normal runs
          if (seeded) return { ...b, structure_history_queued: seeded, compressed };
          const slot = await dueSlot(db, now);
          if (!slot) return compressed ? { ...b, compressed } : b;
          const ck = await cookies();
          const headers = { "User-Agent": UA, Accept: "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9", Referer: "https://www.nseindia.com/", Cookie: ck };
          const get = async (url: string) => {
            for (let i = 0; i < 3; i++) {
              const r = await fetch(url, { headers });
              const bytes = new Uint8Array(await r.arrayBuffer());
              if (r.status === 200 || i === 2) return { status: r.status, bytes };
              await new Promise((x) => setTimeout(x, 3000 * (i + 1)));
            }
            return { status: 0, bytes: new Uint8Array() };
          };
          return { ...b, daily: await dailyRefresh({ db, market: d1Sql(env.DB_MARKET), raw: env.RAW, get, gzip, now }, slot) };
        })) ?? "locked";
      } catch (e) { detail = { error: String(e instanceof Error ? e.message : e) }; }
      if (detail !== "locked") await env.DB_FILINGS.prepare("INSERT INTO prefetch_log (at, detail) VALUES (?1, ?2)").bind(new Date().toISOString(), JSON.stringify(detail)).run();
    })());
  },
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    // D128 ingest: the GitHub runner uploads archive attachments here (token = Worker secret set by the workflow).
    if (url.pathname === "/ingest" && req.method === "PUT") {
      if (!env.INGEST_TOKEN || req.headers.get("authorization") !== `Bearer ${env.INGEST_TOKEN}`) return new Response("forbidden", { status: 403 });
      const id = Number(url.searchParams.get("job"));
      const status = url.searchParams.get("status") ?? "done";
      const [job] = await d1Sql(env.DB_FILINGS).all<{ r2_key: string; url: string; attempts: number }>("SELECT r2_key, url, attempts FROM fetch_job WHERE job_id=?", [id]);
      if (!job) return new Response("no job", { status: 404 });
      const bytes = new Uint8Array(await req.arrayBuffer());
      // V1 lesson #280: a cut-off XML must not be kept as done; it is retried (attempts < 3).
      if (status === "done" && job.r2_key.endsWith(".xml") && !xmlComplete(bytes)) {
        await env.DB_FILINGS.prepare("UPDATE fetch_job SET status='failed', attempts=attempts+1, http_status=?2, bytes=?3, error='truncated XML', fetched_at=?4 WHERE job_id=?1")
          .bind(id, Number(url.searchParams.get("http") ?? 200), bytes.length, new Date().toISOString()).run();
        return new Response("truncated", { status: 200 });
      }
      if (status === "done") await env.RAW.put(job.r2_key, await gzip(bytes), { customMetadata: { url: job.url, fetched_at: new Date().toISOString(), enc: "gzip" } });
      await env.DB_FILINGS.prepare("UPDATE fetch_job SET status=?2, attempts=attempts+1, http_status=?3, bytes=?4, sha256=?5, fetched_at=?6 WHERE job_id=?1")
        .bind(id, status, Number(url.searchParams.get("http") ?? 200), bytes.length, status === "done" ? await sha256Hex(bytes) : null, new Date().toISOString()).run();
      return new Response("ok");
    }
    if (url.pathname !== "/status") return new Response("not found", { status: 404 });
    const q = async (s: string) => (await env.DB_FILINGS.prepare(s).all()).results;
    return Response.json({
      environment: env.ENVIRONMENT,
      by_status: await q("SELECT status, count(*) AS n, sum(bytes) AS bytes FROM fetch_job GROUP BY status"),
      attachments: await q("SELECT status, count(*) AS n, sum(bytes) AS bytes FROM fetch_job WHERE url LIKE 'https://nsearchives%' GROUP BY status"),
      by_kind: await q("SELECT kind, sum(status='done') AS done, sum(status='empty') AS empty, sum(status='failed') AS failed, sum(status='todo') AS todo FROM fetch_job GROUP BY kind"),
      // Owner #265 download ledger audit: why each failure stopped (final = no more retries) and whether any content
      // was saved twice under different URLs.
      failed_by_reason: await q("SELECT kind, http_status, (attempts >= 3 OR IFNULL(http_status,0) = 404) AS final, count(*) AS n FROM fetch_job WHERE status='failed' GROUP BY 1,2,3 ORDER BY n DESC LIMIT 20"),
      duplicate_content: (await q("SELECT count(*) AS hashes, IFNULL(sum(n),0) AS rows, IFNULL(sum(b),0) AS bytes FROM (SELECT count(*) AS n, sum(bytes) AS b FROM fetch_job WHERE sha256 IS NOT NULL GROUP BY sha256 HAVING count(*) > 1)"))[0],
      duplicate_samples: await q("SELECT sha256, count(*) AS n, group_concat(kind, ' ') AS kinds, min(url) AS url_a, max(url) AS url_b, max(bytes) AS bytes FROM fetch_job WHERE sha256 IN (SELECT sha256 FROM fetch_job WHERE sha256 IS NOT NULL GROUP BY sha256 HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 6) GROUP BY sha256 ORDER BY n DESC"),
      recent_errors: await q("SELECT kind, symbol, http_status, error FROM fetch_job WHERE status='failed' ORDER BY fetched_at DESC LIMIT 5"),
      // Owner #278: what is stored, by kind (raw bytes before gzip) and whether any PDF was downloaded.
      storage_by_kind: await q("SELECT kind, count(*) AS n, sum(bytes) AS bytes FROM fetch_job WHERE status='done' GROUP BY kind ORDER BY 3 DESC"),
      pdf_files: (await q("SELECT count(*) AS n FROM fetch_job WHERE lower(url) LIKE '%.pdf'"))[0],
      // V1 lesson #280 audit: a large answer identical across several URLs is an error page, not data.
      suspect_identical: await q("SELECT sha256, count(*) AS n, max(bytes) AS bytes, min(kind) AS kind FROM fetch_job WHERE status='done' AND sha256 IS NOT NULL AND bytes > 5000 GROUP BY sha256 HAVING count(*) > 2 ORDER BY n DESC LIMIT 5"),
      // daily slots and one-off jobs listed apart ("once" sorts after every date, so one list hid the daily slots)
      daily_refresh: await q("SELECT day, slot, at, detail FROM daily_refresh WHERE day <> 'once' ORDER BY day DESC, slot DESC LIMIT 6"),
      once_jobs: await q("SELECT slot, at, substr(detail, 1, 200) AS detail FROM daily_refresh WHERE day = 'once' ORDER BY at DESC"),
      sweep_misses: (await q("SELECT count(*) AS n FROM fetch_job a JOIN fetch_job p ON p.job_id = a.parent_id WHERE p.r2_key LIKE '%-sweep.json'"))[0],
      last_runs: await q("SELECT at, detail FROM prefetch_log ORDER BY id DESC LIMIT 5"),
    }, { headers: { "cache-control": "no-store" } });
  },
};
