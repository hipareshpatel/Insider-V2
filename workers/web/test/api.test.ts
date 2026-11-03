// M3 site v0 API (D151) on databases built from the real migrations: noindex everywhere, robots disallow, adjusted
// prices use applied factors only (never proposals), charts start after a series break (D146), original vs restated.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { app, precompute, type Env } from "../src/index.js";
import { resetSymbolCache } from "../src/data.js";

beforeEach(() => resetSymbolCache());

const batches: number[] = [];
const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
function d1(domain: string): D1Database & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(MIG, domain)).sort()) db.exec(readFileSync(join(MIG, domain, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return { raw: db, prepare: (sql: string) => {
      const bound = (...p: unknown[]) => ({ all: async () => ({ results: db.prepare(sql).all(...norm(p)) }), first: async () => db.prepare(sql).get(...norm(p)) ?? null, run: async () => db.prepare(sql).run(...norm(p)) });
      return { bind: bound, ...bound() };
    },
    batch: async (list: { all(): Promise<unknown> }[]) => { batches.push(list.length); return Promise.all(list.map((x) => x.all())); } } as unknown as D1Database & { raw: DatabaseSync };
}

function env(): Env & { m: DatabaseSync; f: DatabaseSync; a: DatabaseSync } {
  const market = d1("market"), filings = d1("filings"), appDb = d1("app");
  market.raw.exec(`
    INSERT INTO trading_calendar (trade_date, is_session, universe_rows) VALUES ('2026-10-29',1,2000),('2026-10-30',1,2000);
    INSERT INTO security (security_id,name,kind) VALUES (7,'Infosys Limited','equity'),(8,'Spentex Industries','equity');
    INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (7,'nse_symbol','INFY','2024-01-01','t'),(7,'isin','INE009A01021','2024-01-01','t'),(8,'nse_symbol','SPENTEX','2024-01-01','t');
    INSERT INTO price_daily (security_id,d,series,open,high,low,close,prev_close,volume,turnover_paise,trades,file_id) VALUES
      (7,20261029,'EQ',300000,302000,298000,300000,299000,100,30000000000,10,1),
      (7,20261030,'EQ',150000,152000,149000,151000,300000,100,30000000000,10,1),
      (8,20240110,'EQ',1000,1000,1000,1000,1000,10,1,1,1),(8,20261030,'EQ',5000,5000,5000,5000,4900,10,1,1,1);
    INSERT INTO adj_factor (security_id,ex_date,factor,method,status) VALUES (7,'2026-10-30','0.5','share_ratio','auto'),(7,'2026-10-29','0.1','bc_ratio','review');
    INSERT INTO index_daily (index_name,d,close,pe,pb,div_yield) VALUES ('Nifty 50',20261029,'25000','22','3.5','1.2'),('Nifty 50',20261030,'25250','21','3.5','1.2');
    INSERT INTO classification VALUES (7,'2026-10-31','Information Technology',NULL,'index_csv','ind_niftytotalmarket_list.csv@2026-10-31');`);
  filings.raw.exec(`
    INSERT INTO filing (filing_id,security_id,kind,period_end,period_kind,basis,disclosed_at,source_url,status) VALUES (1,7,'results_quarterly','2026-09-30','Q','consolidated','2026-10-16T12:00:00Z','https://nsearchives.nseindia.com/x.xml','loaded'),
      (2,7,'results_quarterly','2026-09-30','Q','consolidated','2026-11-01T12:00:00Z','https://nsearchives.nseindia.com/y.xml','loaded');
    INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version) VALUES
      (7,'industrial','pl','revenue','','2026-09-30','Q','consolidated','original','400000000000','2026-10-16T12:00:00Z',1,'reported','t'),
      (7,'industrial','pl','revenue','','2026-09-30','Q','consolidated','restated','404000000000','2026-11-01T12:00:00Z',2,'reported','t');`);
  appDb.raw.exec(`INSERT INTO review_item (kind,subject_db,subject_ref,summary,status,decision,created_at) VALUES ('corp_action','market','8|2024-01-12','x','rejected','{"reason": "Series break, no factor (D146)"}','2026-11-03T00:00:00Z')`);
  return { DB_MARKET: market, DB_FILINGS: filings, DB_APP: appDb, ASSETS: { fetch: async () => new Response("<!doctype html><title>Disclo</title>", { headers: { "content-type": "text/html" } }) } as unknown as Fetcher, ENVIRONMENT: "test", m: market.raw, f: filings.raw, a: appDb.raw };
}
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const get = (path: string, e = env()) => app.request(path, {}, e, ctx);

describe("site v0 API", () => {
  it("noindex on every response; robots.txt disallows everything; pages fall through to the site", async () => {
    for (const p of ["/", "/s/INFY", "/api/v1/health", "/robots.txt"]) expect((await get(p)).headers.get("x-robots-tag")).toContain("noindex");
    expect(await (await get("/robots.txt")).text()).toBe("User-agent: *\nDisallow: /\n");
    expect(await (await get("/s/INFY")).text()).toContain("<title>Disclo</title>");
  });
  it("stock: prices adjusted by applied factors only (the review proposal is ignored); original and restated kept apart", async () => {
    const r = await (await get("/api/v1/stocks/infy")).json() as any;
    expect(r.name).toBe("Infosys Limited");
    expect(r.prices.rows.map((x: any) => [x.date, x.close])).toEqual([["2026-10-29", 1500], ["2026-10-30", 1510]]); // ×0.5 split, not ×0.1
    expect(r.prices.pending_review).toBe(1);
    expect(r.quote).toMatchObject({ date: "2026-10-30", close: 1510, source: "NSE bhavcopy" });
    expect(r.classification).toMatchObject({ sector: "Information Technology", label: "NSE index list" });
    expect(r.financials.pl[0]).toMatchObject({ period_end: "2026-09-30", basis: "consolidated", lines: { revenue: "400000000000" }, restated: { revenue: "404000000000" }, source: "https://nsearchives.nseindia.com/x.xml" });
  });
  it("EPS is adjusted only for splits/bonuses after its filing date", async () => {
    const e = env();
    e.f.exec(`INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version) VALUES
      (7,'industrial','pl','eps_basic','','2026-09-30','Q','consolidated','original','20.00','2026-10-16T12:00:00Z',1,'reported','t'),
      (7,'industrial','pl','eps_basic','','2026-12-31','Q','consolidated','original','11.00','2027-01-16T12:00:00Z',1,'reported','t')`);
    const r = await (await app.request("/api/v1/stocks/INFY", {}, e, ctx)).json() as any;
    const eps = (pe: string) => r.financials.pl.find((p: any) => p.period_end === pe).lines.eps_basic;
    expect(eps("2026-09-30")).toBe("10"); // filed before the 2026-10-30 split (×0.5)
    expect(eps("2026-12-31")).toBe("11.00"); // filed after it: already on the new share count
  });
  it("chart starts after a series break (D146)", async () => {
    const r = await (await get("/api/v1/stocks/SPENTEX")).json() as any;
    expect(r.prices.series_breaks).toEqual(["2024-01-12"]);
    expect(r.prices.rows.map((x: any) => x.date)).toEqual(["2026-10-30"]);
  });
  it("dashboard: index change and P/E percentile vs own history; breadth; movers exclude today's ex-date", async () => {
    const r = await (await get("/api/v1/dashboard")).json() as any;
    expect(r.as_of).toBe("2026-10-30");
    expect(r.indices.find((x: any) => x.name === "Nifty 50")).toMatchObject({ key: true, close: 25250, change_pct: 1, pe_percentile: 0 }); // real NSE spelling
    expect(r.breadth).toMatchObject({ advances: 1, declines: 1 });
    expect(r.movers.gainers.map((x: any) => x.symbol)).not.toContain("INFY"); // split ex-date today
  });
  it("unknown stock → 404; bad symbol → 400; unknown API path → 404", async () => {
    expect((await get("/api/v1/stocks/NOPE")).status).toBe(404);
    expect((await get("/api/v1/stocks/%3Cscript%3E")).status).toBe(400);
    expect((await get("/api/v1/nothing")).status).toBe(404);
  });
  it("a page's parallel reads go to each database as one batch (one round trip per database)", async () => {
    batches.length = 0;
    await get("/api/v1/stocks/INFY");
    expect(batches.length).toBeLessThanOrEqual(4); // market, filings, app (+ the symbol map on a cold isolate)
    expect(Math.max(...batches)).toBeGreaterThanOrEqual(8);
  });
  it("dashboard is served from the precomputed copy when fresh; identical recompute does not rewrite it", async () => {
    const e = env();
    await precompute(e, new Date());
    const [row] = e.a.prepare("SELECT at, length(body) AS n FROM site_cache WHERE key='dashboard'").all() as { at: string; n: number }[];
    expect(row!.n).toBeGreaterThan(100);
    const r = await app.request("/api/v1/dashboard", {}, e, ctx);
    expect(r.headers.get("server-timing")).toContain("precomputed");
    expect(((await r.json()) as { as_of: string }).as_of).toBe("2026-10-30");
    await precompute(e, new Date(Date.parse(row!.at) + 60_000)); // same body, 1 minute later: no write
    expect((e.a.prepare("SELECT at FROM site_cache").get() as { at: string }).at).toBe(row!.at);
  });
  it("offline switch (D152): every path answers 503, still noindex", async () => {
    const e = { ...env(), SITE_OFFLINE: "1" };
    for (const p of ["/", "/s/INFY", "/api/v1/dashboard"]) {
      const r = await app.request(p, {}, e, ctx);
      expect(r.status).toBe(503);
      expect(r.headers.get("x-robots-tag")).toContain("noindex");
    }
  });
  it("rate limit answers 429", async () => {
    const e = { ...env(), RATE: { limit: async () => ({ success: false }) } };
    expect((await app.request("/api/v1/health", {}, e, ctx)).status).toBe(429);
  });
});
