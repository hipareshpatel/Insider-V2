// M3 site v0 API (D151) on databases built from the real migrations: noindex everywhere, robots disallow, adjusted
// prices use applied factors only (never proposals), charts start after a series break (D146), original vs restated.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { app, type Env } from "../src/index.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
function d1(domain: string): D1Database & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(MIG, domain)).sort()) db.exec(readFileSync(join(MIG, domain, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return { raw: db, prepare: (sql: string) => ({ bind: (...p: unknown[]) => ({ all: async () => ({ results: db.prepare(sql).all(...norm(p)) }) }) }) } as unknown as D1Database & { raw: DatabaseSync };
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
    INSERT INTO index_daily (index_name,d,close,pe,pb,div_yield) VALUES ('NIFTY 50',20261029,'25000','22','3.5','1.2'),('NIFTY 50',20261030,'25250','21','3.5','1.2');
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
  it("chart starts after a series break (D146)", async () => {
    const r = await (await get("/api/v1/stocks/SPENTEX")).json() as any;
    expect(r.prices.series_breaks).toEqual(["2024-01-12"]);
    expect(r.prices.rows.map((x: any) => x.date)).toEqual(["2026-10-30"]);
  });
  it("dashboard: index change and P/E percentile vs own history; breadth; movers exclude today's ex-date", async () => {
    const r = await (await get("/api/v1/dashboard")).json() as any;
    expect(r.as_of).toBe("2026-10-30");
    expect(r.indices.find((x: any) => x.name === "NIFTY 50")).toMatchObject({ close: 25250, change_pct: 1, pe_percentile: 0 });
    expect(r.breadth).toMatchObject({ advances: 1, declines: 1 });
    expect(r.movers.gainers.map((x: any) => x.symbol)).not.toContain("INFY"); // split ex-date today
  });
  it("unknown stock → 404; bad symbol → 400; unknown API path → 404", async () => {
    expect((await get("/api/v1/stocks/NOPE")).status).toBe(404);
    expect((await get("/api/v1/stocks/%3Cscript%3E")).status).toBe(400);
    expect((await get("/api/v1/nothing")).status).toBe(404);
  });
  it("rate limit answers 429", async () => {
    const e = { ...env(), RATE: { limit: async () => ({ success: false }) } };
    expect((await app.request("/api/v1/health", {}, e, ctx)).status).toBe(429);
  });
});
