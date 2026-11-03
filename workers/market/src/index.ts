// disclo-market Worker: nightly market job + backfill, both driven by cron (§6, D10, D124).
import { archiveFetcher, r2FirstFetcher } from "./archive.js";
import { d1Sql, r2Raw } from "./d1.js";
import { acceptance } from "./acceptance.js";
import { jumps } from "./jumps.js";
import { evidence } from "./evidence.js";
import { chargeBudget, gapDates, runPending } from "./runner.js";
import { loadStructure } from "./structure.js";
import { buildSectors } from "./sectors.js";
import { digestDay } from "./digest.js";
import { loadIndexHistory } from "./indexhist.js";
import { runDay } from "./daily.js";
import { istNow } from "./dates.js";

export interface Env {
  DB_MARKET: D1Database;
  DB_APP: D1Database;
  RAW: R2Bucket;
  CACHE_RO?: R2Bucket; // staging only: production's archive cache, read by the re-run test (never written)
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
      let sectors: unknown = null;
      let indexHist: unknown = null;
      const out = await withLock(env.DB_MARKET, 14 * 60_000, async () => {
        const t0 = Date.now();
        const r = await runPending(deps, { maxDates: 40, budgetMs: 8 * 60_000, revisitSessions: 5, from: env.BACKFILL_FROM, monthlyCap: env.MONTHLY_WRITE_CAP ? Number(env.MONTHLY_WRITE_CAP) : undefined });
        // M1 market structure (D144): R2 only, in date order, within what is left of this run.
        structure = await loadStructure({ market: deps.market, raw: env.RAW, now: deps.now }, Math.max(0, 11 * 60_000 - (Date.now() - t0)));
        // D156: 10-year index history from stored daily index files (R2 only). Runs before the sector job (owner #325:
        // it only got leftover seconds after it); once the range is loaded this returns at once.
        indexHist = await loadIndexHistory(deps.market, env.RAW, Math.max(0, 11.5 * 60_000 - (Date.now() - t0)));
        // D150: sector history from the stored announcement lists (R2 only), with what is left.
        sectors = await buildSectors({ market: deps.market, raw: env.RAW, today: istNow(deps.now()).date }, Math.max(0, 12 * 60_000 - (Date.now() - t0)));
        return r;
      });
      // runPending already charged each date's price/factor rows; charge the rest (identity, ledger, reviews, snapshot).
      const charged = (out ?? []).reduce((n, r) => n + (r.written ?? 0), 0);
      if (out && meter.rows > charged) await chargeBudget(d1Sql(env.DB_MARKET), new Date(), meter.rows - charged);
      console.log(JSON.stringify({ env: env.ENVIRONMENT, rows_written: meter.rows, structure, sectors, indexHist, ran: out?.map((r) => ({ d: r.date, s: r.status, c: r.counts, why: r.reasons?.slice(0, 3) })) ?? "locked" }));
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
    // Phase 1 tests 4–5 (§9.2): per-table checksums of one date; staging can re-run a date to prove it changes nothing.
    if (url.pathname === "/gaps") {
      // C49: loaded sessions whose delivery or index-close file is not in the ledger (repair queue, tried weekly).
      const dates = await gapDates(d1Sql(env.DB_MARKET), new Date(), 1000);
      return Response.json({ count: dates.length, first: dates.slice(0, 30) }, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/digest") {
      const date = url.searchParams.get("date") ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "date=YYYY-MM-DD" }, { status: 400 });
      return Response.json(await digestDay(d1Sql(env.DB_MARKET), date), { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/rerun" && req.method === "POST") {
      if (env.ENVIRONMENT !== "staging") return Response.json({ error: "staging only" }, { status: 403 });
      const date = url.searchParams.get("date") ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "date=YYYY-MM-DD" }, { status: 400 });
      const meter = { rows: 0 };
      const deps = { market: d1Sql(env.DB_MARKET, meter), app: d1Sql(env.DB_APP, meter), raw: r2Raw(env.RAW), fetch: r2FirstFetcher(env.CACHE_RO ?? env.RAW, archiveFetcher(), "2026-11-02", env.RAW), now: () => new Date(), cachedFromR2: true };
      const before = await digestDay(d1Sql(env.DB_MARKET), date);
      const out = await withLock(env.DB_MARKET, 10 * 60_000, () => runDay(date, deps));
      if (out === null) return Response.json({ error: "job running, try later" }, { status: 409 });
      const after = await digestDay(d1Sql(env.DB_MARKET), date);
      const changed = Object.keys(after.tables).filter((t) => after.tables[t]!.sha256 !== before.tables[t]!.sha256);
      return Response.json({ date, status: out.status, rows_written: meter.rows, changed_tables: changed, before, after }, { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/acceptance") {
      return Response.json(await acceptance(d1Sql(env.DB_MARKET), d1Sql(env.DB_APP)), { headers: { "cache-control": "no-store" } });
    }
    if (url.pathname === "/sectors") return Response.json(await sectorView(env.DB_MARKET), { headers: { "cache-control": "no-store" } });
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

// D150 view: the map (with company counts), unmapped values, and how often the map agrees with the index CSV sector.
async function sectorView(db: D1Database) {
  const q = async (sql: string) => (await db.prepare(sql).all()).results as Record<string, unknown>[];
  const latest = `SELECT c.* FROM classification c JOIN (SELECT security_id, max(as_of) AS a FROM classification GROUP BY security_id) l ON l.security_id = c.security_id AND l.a = c.as_of`;
  const cur = `SELECT s.isin, s.sm_industry FROM industry_seen s JOIN (SELECT isin, max(last_at) AS l FROM industry_seen GROUP BY isin) x ON x.isin = s.isin AND x.l = s.last_at`;
  const agree = await q(`SELECT m.sm_industry, m.sector AS map_sector, c.sector AS index_sector, count(DISTINCT c.security_id) AS n
    FROM (${latest}) c JOIN security_identifier i ON i.security_id = c.security_id AND i.id_type = 'isin' JOIN (${cur}) s ON s.isin = i.value
    JOIN sector_map m ON m.sm_industry = s.sm_industry WHERE c.sector_source = 'index_csv' AND m.status <> 'unmapped' GROUP BY 1, 2, 3`);
  const same = agree.filter((r) => (r.map_sector ?? null) === (r.index_sector ?? null)).reduce((n, r) => n + Number(r.n), 0);
  const all = agree.reduce((n, r) => n + Number(r.n), 0);
  return {
    files_read: (await q("SELECT count(*) AS n, sum(rows) AS rows, sum(rows < 0) AS unreadable, max(read_at) AS last FROM sector_file"))[0],
    by_source: await q(`SELECT sector_source, count(*) AS companies FROM (${latest}) GROUP BY 1`),
    by_sector: await q(`SELECT coalesce(sector, 'Unclassified') AS sector, count(*) AS companies FROM (${latest}) GROUP BY 1 ORDER BY 2 DESC`),
    unmapped: await q("SELECT sm_industry, first_seen, first_ref FROM sector_map WHERE status = 'unmapped' ORDER BY first_seen"),
    map: await q(`SELECT m.sm_industry, m.sector, m.status, m.map_version, (SELECT count(DISTINCT isin) FROM industry_seen s WHERE s.sm_industry = m.sm_industry) AS isins FROM sector_map m ORDER BY 1`),
    index_agreement: { companies: all, same_sector: same, disagreements: agree.filter((r) => (r.map_sector ?? null) !== (r.index_sector ?? null)).sort((a, b) => Number(b.n) - Number(a.n)) },
    runs: await q("SELECT run_key, finished_at, detail FROM pipeline_run WHERE pipeline = 'market.sectors' ORDER BY run_id DESC LIMIT 5"),
    // ISINs seen on announcements that match no security (coverage gap: SME / non-equity issuers / missing identifiers)
    unmatched_isins: (await q(`SELECT count(DISTINCT isin) AS n, count(DISTINCT CASE WHEN symbol IN (SELECT value FROM security_identifier WHERE id_type = 'nse_symbol') THEN isin END) AS symbol_matched FROM industry_seen WHERE isin NOT IN (SELECT value FROM security_identifier WHERE id_type = 'isin')`))[0],
    unmatched_sample: await q(`SELECT isin, symbol, sm_industry, max(last_at) AS last FROM industry_seen WHERE isin NOT IN (SELECT value FROM security_identifier WHERE id_type = 'isin') AND (symbol IS NULL OR symbol NOT IN (SELECT value FROM security_identifier WHERE id_type = 'nse_symbol')) GROUP BY isin ORDER BY last DESC LIMIT 15`),
  };
}
