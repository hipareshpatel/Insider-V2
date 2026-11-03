import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { adjustPrice, type Sql, type Stmt } from "@disclo/core";
import { runDay } from "../src/daily.js";
import { pendingDates } from "../src/runner.js";

const FX = join(import.meta.dirname, "..", "..", "..", "packages", "core", "test", "fixtures", "nse");
const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations");

function sqlite(domain: string): Sql & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(MIG, domain)).sort()) db.exec(readFileSync(join(MIG, domain, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return {
    raw: db,
    async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...norm(params)) as T[]; },
    async run(sql: string, params: unknown[] = []) { return { changes: Number(db.prepare(sql).run(...norm(params)).changes) }; },
    async batch(stmts: Stmt[]) {
      db.exec("BEGIN");
      try { let n = 0; for (const s of stmts) n += Number(db.prepare(s.sql).run(...norm(s.params)).changes); db.exec("COMMIT"); return n; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
}

const files: Record<string, string> = {
  "BhavCopy_NSE_CM_0_0_0_20250613_F_0000.csv.zip": "udiff_20250613.csv.zip",
  "BhavCopy_NSE_CM_0_0_0_20250616_F_0000.csv.zip": "udiff_20250616.csv.zip",
  "PR130625.zip": "PR130625.zip",
  "PR160625.zip": "PR160625.zip",
};
function fakeFetch(overrides: Record<string, Uint8Array> = {}) {
  return async (url: string) => {
    const name = url.split("/").pop()!;
    const bytes = overrides[name] ?? (files[name] ? new Uint8Array(readFileSync(join(FX, files[name]!))) : null);
    return bytes ? { status: 200, bytes, contentType: "application/zip" } : { status: 404, bytes: new Uint8Array(), contentType: null };
  };
}

function setup() {
  const market = sqlite("market"), app = sqlite("app");
  market.raw.exec("DELETE FROM job_lock WHERE name='paused'"); // migrations include a maintenance pause
  const stored: string[] = [];
  const deps = { market, app, raw: { put: async (k: string) => { stored.push(k); } }, fetch: fakeFetch(), now: () => new Date("2026-11-03T00:00:00Z"), retryWaits: [0, 0] };
  return { market, app, deps, stored };
}

describe("market daily job on real file samples", () => {
  it("loads BAJFINANCE across the 2025-06-16 split + bonus: ISIN history, factor 0.1 from share counts, adjusted close 933.10", async () => {
    const { market, app, deps, stored } = setup();
    const a = await runDay("2025-06-13", deps);
    expect(a.status).toBe("loaded");
    const b = await runDay("2025-06-16", deps);
    expect(b.status).toBe("loaded");
    expect(stored.length).toBe(4);

    const [sec] = await market.all<{ security_id: number }>("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value='BAJFINANCE'");
    const isins = await market.all<{ value: string; valid_from: string; valid_to: string | null }>(
      "SELECT value, valid_from, valid_to FROM security_identifier WHERE security_id=? AND id_type='isin' ORDER BY valid_from", [sec!.security_id]);
    expect(isins).toEqual([
      { value: "INE296A01024", valid_from: "2025-06-13", valid_to: "2025-06-15" },
      { value: "INE296A01032", valid_from: "2025-06-16", valid_to: null },
    ]);
    const factors = await market.all<{ ex_date: string; factor: string; method: string; status: string }>("SELECT ex_date, factor, method, status FROM adj_factor WHERE security_id=?", [sec!.security_id]);
    expect(factors).toEqual([{ ex_date: "2025-06-16", factor: "0.1", method: "share_ratio", status: "auto" }]);
    const [p13] = await market.all<{ close: number }>("SELECT close FROM price_daily WHERE security_id=? AND d=20250613 AND series='EQ'", [sec!.security_id]);
    expect(p13!.close).toBe(933100); // paise (D130)
    expect(adjustPrice("9331", "2025-06-13", factors.map((f) => ({ exDate: f.ex_date, factor: f.factor })))).toBe("933.1");
    const [m] = await market.all<{ mcap_paise: number; mcap_source: string }>("SELECT mcap_paise, mcap_source FROM shares_daily WHERE security_id=? AND d=20250616", [sec!.security_id]);
    expect(m).toEqual({ mcap_paise: 581446175576000, mcap_source: "nse" }); // ₹5,814,461,755,760.00 exactly
    const ca = await market.all<{ type: string; status: string }>("SELECT type, status FROM corp_action WHERE security_id=? ORDER BY type", [sec!.security_id]);
    expect(ca).toEqual([{ type: "bonus", status: "parsed" }, { type: "split", status: "parsed" }]);
    // no unexplained-move / share-change review for BAJFINANCE (it was explained)
    const reviews = await app.all<{ subject_ref: string }>("SELECT subject_ref FROM review_item");
    expect(reviews.filter((r) => r.subject_ref.includes(`|${sec!.security_id}|`))).toEqual([]);
  });

  it("Phase 1 test 4: re-running a date changes 0 rows", async () => {
    const { market, deps } = setup();
    await runDay("2025-06-13", deps);
    const before = (market.raw.prepare("SELECT total_changes() AS n").get() as { n: number }).n;
    const again = await runDay("2025-06-13", deps);
    expect(again.status).toBe("unchanged");
    const rows = await market.all<{ n: number }>("SELECT count(*) AS n FROM price_daily");
    expect(rows[0]!.n).toBeGreaterThan(0);
    // only the run-log rows change
    const after = (market.raw.prepare("SELECT total_changes() AS n").get() as { n: number }).n;
    expect(after - before).toBe(2);
  });

  it("holiday: both files 404 → pending until 06:00 IST next day, then no session", async () => {
    const { deps } = setup();
    expect((await runDay("2026-11-01", { ...deps, now: () => new Date("2026-11-01T18:00:00Z") })).status).toBe("pending");
    expect((await runDay("2026-11-01", { ...deps, now: () => new Date("2026-11-02T01:00:00Z") })).status).toBe("no_session");
  });

  it("rejects a file whose prices are broken (gate) and writes nothing", async () => {
    const { market, deps } = setup();
    const r = await runDay("2025-06-13", { ...deps, fetch: async (u: string) => (u.includes("BhavCopy") ? { status: 200, bytes: new Uint8Array([1, 2, 3]), contentType: null } : fakeFetch()(u)) });
    expect(r.status).toBe("failed");
    expect((await market.all<{ n: number }>("SELECT count(*) AS n FROM price_daily"))[0]!.n).toBe(0);
  });

  it("schedules dates from 2024-01-01, only after 22:00 IST, skipping done ones", async () => {
    const { market } = setup();
    const at2130 = await pendingDates(market, new Date("2024-01-03T16:00:00Z"), 5);
    expect(at2130).toEqual(["2024-01-01", "2024-01-02"]);
    const at2230 = await pendingDates(market, new Date("2024-01-03T17:00:00Z"), 5);
    expect(at2230).toEqual(["2024-01-01", "2024-01-02", "2024-01-03"]);
  });
});

describe("universe filter (D4) + store everything (D127)", () => {
  it("stores fund units typed 'etf' but keeps them out of the universe counts", async () => {
    const { market, deps } = setup();
    // add an ETF row to the 2025-06-13 bhavcopy sample
    const { readFileSync: rf } = await import("node:fs");
    const csv = rf(join(FX, "udiff_20250613.csv"), "utf8").trimEnd() + "\r\n2025-06-13,2025-06-13,CM,NSE,STK,999,INF204KB14I2,NIFTYBEES,EQ,,,,,NIP IND ETF NIFTY BEES,280.00,281.00,279.00,280.50,280.50,279.90,,280.50,,,1000,280500.00,10,F1,1,,,,,\r\n";
    const { zipSync } = await import("./zip.js");
    const r = await runDay("2025-06-13", { ...deps, fetch: fakeFetch({ "BhavCopy_NSE_CM_0_0_0_20250613_F_0000.csv.zip": zipSync("BhavCopy_NSE_CM_0_0_0_20250613_F_0000.csv", csv) }) });
    expect(r.status).toBe("loaded");
    expect(await market.all("SELECT s.kind FROM security s JOIN security_identifier i ON i.security_id=s.security_id WHERE i.value='NIFTYBEES'")).toEqual([{ kind: "etf" }]);
    expect((await market.all<{ n: number }>("SELECT count(*) AS n FROM price_daily p JOIN security_identifier i ON i.security_id=p.security_id AND i.value='NIFTYBEES'"))[0]!.n).toBe(1);
    // universe count excludes it; the BL-series BAJFINANCE row is stored too; the gold bond (GB) is not (#257)
    expect(r.counts!.stored_all!).toBeGreaterThan(r.counts!.prices!);
    expect((await market.all<{ n: number }>("SELECT count(*) AS n FROM price_daily WHERE series='BL'"))[0]!.n).toBe(1);
    expect((await market.all<{ n: number }>("SELECT count(*) AS n FROM price_daily WHERE series='GB'"))[0]!.n).toBe(0);
    expect((await market.all<{ n: number }>("SELECT count(*) AS n FROM security_identifier WHERE value='INFY'"))[0]!.n).toBe(1);
  });
});

describe("index snapshot + sector (D9, D121)", () => {
  it("records membership and sector from the Total Market list, matched by ISIN", async () => {
    const { market, deps } = setup();
    await runDay("2025-06-16", deps);
    const { snapshotIndices } = await import("../src/snapshot.js");
    const tm = new Uint8Array(readFileSync(join(FX, "ind_niftytotalmarket_list.csv")));
    const f = async (u: string) => (u.endsWith("ind_niftytotalmarket_list.csv") ? { status: 200, bytes: tm, contentType: "text/csv" } : { status: 404, bytes: new Uint8Array(), contentType: null });
    const r = await snapshotIndices("2026-11-03", market, f);
    expect(r.indices["NIFTY TOTAL MARKET"]).toBe(4);
    const rows = await market.all<{ value: string; sector: string }>(
      `SELECT i.value, c.sector FROM classification c JOIN security_identifier i ON i.security_id=c.security_id AND i.id_type='nse_symbol' ORDER BY i.value`);
    expect(rows).toEqual([
      { value: "BAJFINANCE", sector: "Financial Services" }, { value: "HDFCBANK", sector: "Financial Services" },
      { value: "INFY", sector: "Information Technology" }, { value: "ITC", sector: "Fast Moving Consumer Goods" },
    ]);
    // idempotent: same sector again adds no history row
    await snapshotIndices("2026-11-04", market, f);
    expect((await market.all<{ n: number }>("SELECT count(*) AS n FROM classification"))[0]!.n).toBe(4);
    expect((await market.all<{ n: number }>("SELECT count(*) AS n FROM index_membership WHERE index_name='NIFTY TOTAL MARKET' AND valid_to IS NULL"))[0]!.n).toBe(4);
  });
});

describe("runner order", () => {
  it("stops at the first date that didn't load, so later dates never get ahead of it", async () => {
    const { runPending } = await import("../src/runner.js");
    const { deps } = setup();
    const out = await runPending({ ...deps, now: () => new Date("2025-06-17T01:00:00Z") }, { maxDates: 10, budgetMs: 60_000, revisitSessions: 5, from: "2025-06-13" });
    // 13th loads; 14th/15th are weekend 404s -> no session; 16th loads; 17th not eligible yet
    expect(out.map((r) => `${r.date}:${r.status}`)).toEqual(["2025-06-13:loaded", "2025-06-14:no_session", "2025-06-15:no_session", "2025-06-16:loaded"]);
    const refused = await runPending({ ...deps, fetch: async () => ({ status: 403, bytes: new Uint8Array(), contentType: null }), now: () => new Date("2025-06-20T01:00:00Z") }, { maxDates: 10, budgetMs: 60_000, revisitSessions: 0, from: "2025-06-13" });
    expect(refused.map((r) => r.status)).toEqual(["pending"]);
  });
});

describe("out-of-order loading", () => {
  it("loading 2025-06-16 then 2025-06-13 creates no duplicate securities", async () => {
    const { market, deps } = setup();
    await runDay("2025-06-16", deps);
    const before = (await market.all<{ n: number }>("SELECT count(*) AS n FROM security"))[0]!.n;
    const r = await runDay("2025-06-13", deps);
    expect(r.status).toBe("loaded");
    expect((await market.all<{ n: number }>("SELECT count(*) AS n FROM security"))[0]!.n).toBe(before);
    const infy = await market.all<{ valid_from: string }>("SELECT valid_from FROM security_identifier WHERE value='INFY'");
    expect(infy).toEqual([{ valid_from: "2025-06-13" }]);
  });
});

describe("acceptance checks (§9.2)", () => {
  it("test 1 passes on the BAJFINANCE samples", async () => {
    const { acceptance } = await import("../src/acceptance.js");
    const { market, app, deps } = setup();
    await runDay("2025-06-13", deps);
    await runDay("2025-06-16", deps);
    const r = await acceptance(market, app);
    expect(r.find((c) => c.id === "1")).toMatchObject({ pass: true });
    expect(r.find((c) => c.id === "2")?.pass).toBeNull(); // no index snapshot in this test
  });
});

describe("maintenance + missing-file rules", () => {
  it("a settled PR-bundle 404 is no session even if the bhavcopy is refused (403)", async () => {
    const { deps } = setup();
    const f = async (u: string) => ({ status: u.includes("BhavCopy") ? 403 : 404, bytes: new Uint8Array(), contentType: null });
    expect((await runDay("2024-01-27", { ...deps, fetch: f, now: () => new Date("2024-01-29T00:00:00Z") })).status).toBe("no_session");
  });
  it("paused: the runner loads nothing", async () => {
    const { runPending } = await import("../src/runner.js");
    const { market, deps } = setup();
    await market.run("INSERT INTO job_lock (name, holder, expires_at) VALUES ('paused','t','9999')");
    expect(await runPending({ ...deps, now: () => new Date("2025-06-17T01:00:00Z") }, { maxDates: 10, budgetMs: 60_000, revisitSessions: 5, from: "2025-06-13" })).toEqual([]);
  });
});

describe("wrong-date PR bundle (NSE served 04-Jun-2024 files as PR060424.zip)", () => {
  it("is not loaded against the requested date; with no bhavcopy it's no session", async () => {
    const { deps, market } = setup();
    const pr16 = new Uint8Array(readFileSync(join(FX, "PR160625.zip")));
    const f = async (u: string) => (u.endsWith("PR130625.zip") ? { status: 200, bytes: pr16, contentType: null } : { status: 404, bytes: new Uint8Array(), contentType: null });
    const r = await runDay("2025-06-13", { ...deps, fetch: f, now: () => new Date("2025-06-15T00:00:00Z") });
    expect(r.status).toBe("no_session");
    expect((await market.all<{ n: number }>("SELECT count(*) AS n FROM shares_daily"))[0]!.n).toBe(0);
    const withBhav = async (u: string) => (u.endsWith("PR130625.zip") ? { status: 200, bytes: pr16, contentType: null } : fakeFetch()(u));
    expect((await runDay("2025-06-13", { ...deps, fetch: withBhav })).status).toBe("rejected");
  });
});

describe("corporate-action types", () => {
  it("a meeting plus an unknown part is stored as 'other' and reviewed (never breaks the date)", async () => {
    const { parsePurpose } = await import("@disclo/core");
    const p = parsePurpose("AGM/SOMETHING NEW");
    expect(p.components).toEqual([{ type: "meeting" }]);
    expect(p.unparsed).toEqual(["SOMETHING NEW"]);
  });
});

describe("instrument kinds (#257)", () => {
  it("stocks, ETFs, REITs/InvITs kept; debt dropped even with a company INE ISIN", async () => {
    const { kindOf } = await import("../src/daily.js");
    expect(kindOf({ series: "EQ", isin: "INE009A01021" })).toBe("equity");
    expect(kindOf({ series: "SM", isin: "INE0ABC01012" })).toBe("equity");
    expect(kindOf({ series: "E1", isin: "IN9123A01012" })).toBe("equity");
    expect(kindOf({ series: "EQ", isin: "INF204KB14I2" })).toBe("etf");
    expect(kindOf({ series: "RR", isin: "INE0CCU25019" })).toBe("reit");
    expect(kindOf({ series: "IV", isin: "INE0DD123456" })).toBe("invit");
    for (const s of ["N0", "NE", "Y3", "GS", "GB", "TB", "SG", "P1", "ZR"]) expect(kindOf({ series: s, isin: "INE123A07011" })).toBeNull();
  });
});

describe("archive file dates (R2 cache authority, D128)", () => {
  it("reads the trading date from every daily file name", async () => {
    const { archiveFileDate } = await import("../src/archive.js");
    expect(archiveFileDate("https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_20240901_F_0000.csv.zip")).toBe("2024-09-01");
    expect(archiveFileDate("https://nsearchives.nseindia.com/archives/equities/bhavcopy/pr/PR010924.zip")).toBe("2024-09-01");
    expect(archiveFileDate("https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_01092024.csv")).toBe("2024-09-01");
    expect(archiveFileDate("https://nsearchives.nseindia.com/content/indices/ind_close_all_01092024.csv")).toBe("2024-09-01");
    expect(archiveFileDate("https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv")).toBeNull();
  });
});

import { repairFactors } from "../src/repair.js";
describe("factor repair from the per-company lists (SHRIRAMFIN 1:5 split missing from Bc, 2025-01-10)", () => {
  it("decides the split from stored share counts, supersedes the unexplained-change items, runs once", async () => {
    const m = sqlite("market"), a = sqlite("app");
    m.raw.exec(`INSERT INTO security (security_id, name) VALUES (1797, 'Shriram Finance');
      INSERT INTO security_identifier (security_id, id_type, value, valid_from, source) VALUES (1797, 'nse_symbol', 'SHRIRAMFIN', '2024-01-01', 't');
      INSERT INTO trading_calendar (trade_date, is_session, universe_rows) VALUES ('2025-01-09', 1, 2400), ('2025-01-10', 1, 2400);
      INSERT INTO shares_daily VALUES (1797, 20250109, 376058777, NULL, 'nse', 1000), (1797, 20250110, 1880293885, NULL, 'nse', 200);
      INSERT INTO price_daily VALUES (1797, 20250109, 'EQ', 290000, 292000, 288000, 290000, NULL, 1, NULL, NULL, 1),
                                     (1797, 20250110, 'EQ', 58500, 59000, 57000, 58000, NULL, 1, NULL, NULL, 1);`);
    a.raw.exec(`INSERT INTO review_item (kind, subject_db, subject_ref, summary, created_at) VALUES ('corp_action', 'market', 'shares|1797|2025-01-10', 'Share count changed', 'x'), ('corp_action', 'market', 'move|1797|2025-01-10', 'moved -81%', 'x')`);
    const r = await repairFactors(m, a, new Date("2025-01-11T00:00:00Z"));
    expect(r?.decided).toBe(1);
    expect(await m.all("SELECT factor, method, status FROM adj_factor WHERE security_id=1797")).toEqual([{ factor: "0.2", method: "share_ratio", status: "auto" }]);
    expect(await a.all("SELECT status FROM review_item ORDER BY subject_ref")).toEqual([{ status: "superseded" }, { status: "superseded" }]);
    expect(await repairFactors(m, a, new Date("2025-01-11T00:00:00Z"))).toBeNull(); // once per version
  });
});

describe("stale Bc ex-date (FMEA C28, V1 hint #276)", () => {
  it("when the true-date factor is applied automatically, a same-ratio review factor of the previous 15 days is removed and its item closed", async () => {
    const { market, app, deps } = setup();
    await runDay("2025-06-13", deps);
    const [sec] = await market.all<{ security_id: number }>("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value='BAJFINANCE'");
    const sid = sec!.security_id;
    // a stale Bc row days earlier left a review factor with the same ratio, and its review item
    market.raw.exec(`INSERT INTO adj_factor (security_id,ex_date,factor,method,status) VALUES (${sid},'2025-06-06','0.1','bc_ratio','review')`);
    app.raw.exec(`INSERT INTO review_item (kind,subject_db,subject_ref,summary,created_at) VALUES ('corp_action','market','${sid}|2025-06-06','stale','x')`);
    await runDay("2025-06-16", deps);
    expect(await market.all("SELECT ex_date, status FROM adj_factor WHERE security_id=? ORDER BY ex_date", [sid])).toEqual([{ ex_date: "2025-06-16", status: "auto" }]);
    expect(await app.all("SELECT status FROM review_item WHERE subject_ref=?", [`${sid}|2025-06-06`])).toEqual([{ status: "superseded" }]);
  });
});

import { loadStructure } from "../src/structure.js";
describe("market-structure loader (M1, D144)", () => {
  it("loads every source from R2 in date order, flags API-capped days, keeps bands as intervals, records missing files", async () => {
    const { market } = setup();
    market.raw.exec("INSERT INTO trading_calendar (trade_date, is_session, universe_rows) VALUES ('2026-10-29', 1, 2500), ('2026-10-30', 1, 2500)");
    const FXD = join(import.meta.dirname, "..", "..", "..", "packages", "core", "test", "fixtures", "nse");
    const f = (n: string) => readFileSync(join(FXD, n), "utf8");
    const bandsDay1 = f("sec_list_30102026_head.csv");
    const bandsDay2 = bandsDay1.replace("ABAN,BE,ABAN OFFSHORE LIMITED,2,", "ABAN,BE,ABAN OFFSHORE LIMITED,5,");
    const objs: Record<string, string> = {
      "cache/content/nsccl/fao_participant_oi_30102026.csv": f("fao_participant_oi_30102026.csv"),
      "cache/archives/fo/sec_ban/fo_secban_29102026.csv": "Securities in Ban For Trade Date 29-OCT-2026:\n1,SAIL\n",
      "cache/archives/fo/sec_ban/fo_secban_30102026.csv": "Securities in Ban For Trade Date 30-OCT-2026:\n1,KAYNES\n2,SAIL\n",
      "cache/content/equities/sec_list_29102026.csv": bandsDay1,
      "cache/content/equities/sec_list_30102026.csv": bandsDay2,
      "api/market_structure/bulk_deals/2026-10-30.json": f("api_bulk_deals_30102026.json"),
      "api/market_structure/short_selling/2026-10-30.json": f("api_short_selling_30102026.json"),
    };
    const raw = { async get(k: string) { const t = objs[k]; return t === undefined ? null : { customMetadata: {}, text: async () => t }; } } as unknown as R2Bucket;
    const out = await loadStructure({ market, raw, now: () => new Date("2026-11-10T12:00:00Z") }, 60_000);
    expect(out).toMatchObject({ fo_oi: 1, fo_ban: 2, price_band: 2, bulk: 1, short: 1 });
    const days = await market.all<{ source: string; d: number; rows: number; note: string | null }>("SELECT source, d, rows, note FROM ms_day ORDER BY source, d");
    expect(days.find((x) => x.source === "fo_oi" && x.d === 20261029)).toMatchObject({ rows: -1, note: "missing in R2" });
    expect(days.find((x) => x.source === "bulk" && x.d === 20261030)).toMatchObject({ rows: 70, note: "possibly truncated (API cap 70)" });
    expect(await market.all("SELECT band, valid_from, valid_to FROM price_band WHERE symbol='ABAN' ORDER BY valid_from")).toEqual([
      { band: "2", valid_from: 20261029, valid_to: 20261029 }, { band: "5", valid_from: 20261030, valid_to: null }]);
    expect(await market.all("SELECT symbol FROM fo_ban WHERE d=20261030 ORDER BY symbol")).toEqual([{ symbol: "KAYNES" }, { symbol: "SAIL" }]);
    expect((await market.all("SELECT 1 FROM fo_oi_participant WHERE d=20261030")).length).toBe(5);
    // second run: nothing new to load
    expect(await loadStructure({ market, raw, now: () => new Date("2026-11-10T12:00:00Z") }, 60_000)).toEqual({});
  });
});
