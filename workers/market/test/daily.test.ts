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
    const [p13] = await market.all<{ close: string }>("SELECT close FROM price_daily WHERE security_id=? AND trade_date='2025-06-13' AND series='EQ'", [sec!.security_id]);
    expect(adjustPrice(p13!.close, "2025-06-13", factors.map((f) => ({ exDate: f.ex_date, factor: f.factor })))).toBe("933.1");
    const [m] = await market.all<{ mcap_rs: string; mcap_source: string }>("SELECT mcap_rs, mcap_source FROM shares_daily WHERE security_id=? AND trade_date='2025-06-16'", [sec!.security_id]);
    expect(m).toEqual({ mcap_rs: "5814461755760.00", mcap_source: "nse" });
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

describe("universe filter (D4)", () => {
  it("drops fund units (INF ISINs) and keeps companies", async () => {
    const { market, deps } = setup();
    // add an ETF row to the 2025-06-13 bhavcopy sample
    const { readFileSync: rf } = await import("node:fs");
    const csv = rf(join(FX, "udiff_20250613.csv"), "utf8").trimEnd() + "\r\n2025-06-13,2025-06-13,CM,NSE,STK,999,INF204KB14I2,NIFTYBEES,EQ,,,,,NIP IND ETF NIFTY BEES,280.00,281.00,279.00,280.50,280.50,279.90,,280.50,,,1000,280500.00,10,F1,1,,,,,\r\n";
    const { zipSync } = await import("./zip.js");
    const r = await runDay("2025-06-13", { ...deps, fetch: fakeFetch({ "BhavCopy_NSE_CM_0_0_0_20250613_F_0000.csv.zip": zipSync("BhavCopy_NSE_CM_0_0_0_20250613_F_0000.csv", csv) }) });
    expect(r.status).toBe("loaded");
    expect(await market.all("SELECT 1 FROM security_identifier WHERE value='NIFTYBEES'")).toEqual([]);
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
