// D150: sector history from stored announcement lists (real NSE rows, Oct 2026) + the approved map.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import { buildSectors, industryPairs, plan } from "../src/sectors.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations", "market");
const SAMPLE = readFileSync(join(import.meta.dirname, "..", "..", "..", "packages", "core", "test", "fixtures", "nse", "announcements_sample.json"), "utf8");

function sqlite(): Sql {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIG).sort()) db.exec(readFileSync(join(MIG, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return {
    async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...norm(params)) as T[]; },
    async run(sql: string, params: unknown[] = []) { return { changes: Number(db.prepare(sql).run(...norm(params)).changes) }; },
    async batch(stmts: Stmt[]) {
      db.exec("BEGIN");
      try { let n = 0; for (const s of stmts) n += Number(db.prepare(s.sql).run(...norm(s.params)).changes); db.exec("COMMIT"); return n; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
}
function bucket(objs: Record<string, string>) {
  return {
    async list({ prefix }: { prefix: string }) { return { objects: Object.keys(objs).filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
    async get(k: string) { const t = objs[k]; return t === undefined ? null : { customMetadata: {}, text: async () => t }; },
  } as unknown as R2Bucket;
}
async function seed(m: Sql) {
  for (const [id, name, isin] of [[1, "Xchanging Solutions", "INE692G01013"], [2, "Procter & Gamble Hygiene", "INE179A01014"]] as const) {
    await m.run("INSERT INTO security (security_id, name) VALUES (?, ?)", [id, name]);
    await m.run("INSERT INTO security_identifier (security_id, id_type, value, valid_from, source) VALUES (?, 'isin', ?, '2024-01-01', 'test')", [id, isin]);
  }
}
const rows = (m: Sql) => m.all<Record<string, unknown>>("SELECT security_id, as_of, sector, industry_detail, sector_source FROM classification ORDER BY security_id, as_of");

describe("industryPairs", () => {
  it("keeps one pair per ISIN and industry with first/last sighting; skips rows without smIndustry", () => {
    const r = industryPairs(SAMPLE);
    expect(r.rows).toBe(5);
    expect(r.pairs).toEqual([
      { isin: "INE692G01013", ind: "Computers - Software", first: "2026-10-30 12:08:02", last: "2026-10-31 23:41:04", ref: "106836011", symbol: "XCHANGING" },
      { isin: "INE179A01014", ind: "Personal Care", first: "2026-10-07 11:28:56", last: "2026-10-07 11:28:56", ref: "106809385", symbol: "PGHH" },
    ]);
  });
});

describe("buildSectors", () => {
  it("fills companies outside the index from the map, from the first sighting; second run writes nothing", async () => {
    const m = sqlite(); await seed(m);
    const raw = bucket({ "api/announcements/2026-10/2026-11-02.json": SAMPLE });
    const r = await buildSectors({ market: m, raw, today: "2026-11-03" }, 60_000);
    expect(r).toMatchObject({ files: 1, pairs: 2, newValues: [], inserted: 2, classified: true });
    expect(await rows(m)).toEqual([
      { security_id: 1, as_of: "2026-10-30", sector: "Information Technology", industry_detail: "Computers - Software", sector_source: "announcement_map" },
      { security_id: 2, as_of: "2026-10-07", sector: "Fast Moving Consumer Goods", industry_detail: "Personal Care", sector_source: "announcement_map" },
    ]);
    const again = await buildSectors({ market: m, raw, today: "2026-11-04" }, 60_000);
    expect(again).toMatchObject({ files: 0, inserted: 0, classified: true });
    expect((await rows(m)).length).toBe(2);
  });

  it("never guesses a new industry value: Unclassified + raised as unmapped; a later map decision adds a dated row", async () => {
    const m = sqlite(); await seed(m);
    const odd = SAMPLE.replaceAll('"Personal Care"', '"Hygiene Products"');
    const raw = bucket({ "api/bulk/announcements/2026-11-03-evening.json": odd });
    const r = await buildSectors({ market: m, raw, today: "2026-11-03" }, 60_000);
    expect(r.newValues).toEqual(["Hygiene Products"]);
    expect(await m.all("SELECT status, sector FROM sector_map WHERE sm_industry='Hygiene Products'")).toEqual([{ status: "unmapped", sector: null }]);
    expect((await rows(m)).find((x) => x.security_id === 2)).toMatchObject({ sector: null, sector_source: "none", industry_detail: "Hygiene Products" });
    await m.run("UPDATE sector_map SET status='approved', sector='Fast Moving Consumer Goods', map_version='v2' WHERE sm_industry='Hygiene Products'");
    await buildSectors({ market: m, raw, today: "2026-11-05" }, 60_000);
    expect((await rows(m)).filter((x) => x.security_id === 2)).toEqual([
      { security_id: 2, as_of: "2026-10-07", sector: null, industry_detail: "Hygiene Products", sector_source: "none" },
      { security_id: 2, as_of: "2026-11-05", sector: "Fast Moving Consumer Goods", industry_detail: "Hygiene Products", sector_source: "announcement_map" },
    ]);
  });

  it("index CSV stays first for members: only the time before the first index snapshot is filled", async () => {
    const m = sqlite(); await seed(m);
    await m.run("INSERT INTO index_membership (index_name, security_id, valid_from) VALUES ('NIFTY TOTAL MARKET', 1, '2026-10-31')");
    await m.run("INSERT INTO classification VALUES (1, '2026-10-31', 'Information Technology', NULL, 'index_csv', 'ind_niftytotalmarket_list.csv@2026-10-31')");
    await buildSectors({ market: m, raw: bucket({ "api/announcements/2026-10/2026-11-02.json": SAMPLE }), today: "2026-11-03" }, 60_000);
    expect((await rows(m)).filter((x) => x.security_id === 1)).toEqual([
      { security_id: 1, as_of: "2026-10-30", sector: "Information Technology", industry_detail: "Computers - Software", sector_source: "announcement_map" },
      { security_id: 1, as_of: "2026-10-31", sector: "Information Technology", industry_detail: null, sector_source: "index_csv" },
    ]);
  });
});

describe("stale ISIN on announcements (C42)", () => {
  it("falls back to the NSE symbol valid on the last sighting", async () => {
    const m = sqlite(); await seed(m);
    await m.run("INSERT INTO security_identifier (security_id, id_type, value, valid_from, source) VALUES (2, 'nse_symbol', 'PGHH', '2024-01-01', 'test')");
    const stale = SAMPLE.replaceAll('"INE179A01014"', '"INE179A01006"'); // an older ISIN of the same company
    const r = await buildSectors({ market: m, raw: bucket({ "api/announcements/2026-10/2026-11-02.json": stale }), today: "2026-11-03" }, 60_000);
    expect(r.inserted).toBe(2);
    expect((await rows(m)).find((x) => x.security_id === 2)).toMatchObject({ sector: "Fast Moving Consumer Goods", industry_detail: "Personal Care" });
  });
});

describe("plan", () => {
  const map = new Map([["Personal Care", { sector: "Fast Moving Consumer Goods", status: "approved", version: "v1" }]]);
  const pairs = [{ ind: "Personal Care", first: "2024-02-01 10:00:00", last: "2026-10-07 11:28:56", ref: "1" }];
  it("a company that left the index resumes its announcement sector on the day it left", () => {
    const existing = [{ asOf: "2026-11-02", sector: "Fast Moving Consumer Goods", detail: null, source: "index_csv", ref: "csv" }];
    const out = plan({ today: "2026-12-10", pairs, map, existing, member: false, ended: "2026-12-01" });
    expect(out.map((r) => [r.asOf, r.source])).toEqual([["2024-02-01", "announcement_map"], ["2026-12-01", "announcement_map"]]);
  });
  it("no pairs → nothing", () => {
    expect(plan({ today: "2026-11-03", pairs: [], map, existing: [], member: false, ended: null })).toEqual([]);
  });
});

describe("buildSectors from the download ledger (audit P1: no R2 listing, no full sector_file read)", () => {
  it("reads only new announcement lists after its cursor, waits at one still downloading, never lists R2", async () => {
    const m = sqlite(); await seed(m);
    const FMIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations", "filings");
    const fdb = new DatabaseSync(":memory:");
    for (const f of readdirSync(FMIG).sort()) fdb.exec(readFileSync(join(FMIG, f), "utf8"));
    const filings: Sql = { async all<T>(sql: string, p: unknown[] = []) { return fdb.prepare(sql).all(...(p as (string | number | null)[])) as T[]; }, async run() { return { changes: 0 }; }, async batch() { return 0; } };
    fdb.exec(`INSERT INTO fetch_job (job_id,kind,url,r2_key,status) VALUES (5,'announcements','u5','api/announcements/2026-10/2026-11-02.json','done'),
      (6,'announcements_daily','u6','api/bulk/announcements/2026-11-04-evening.json','todo')`);
    const raw = { ...bucket({ "api/announcements/2026-10/2026-11-02.json": SAMPLE }), async list() { throw new Error("R2 list must not be called"); } } as unknown as R2Bucket;
    const r = await buildSectors({ market: m, raw, today: "2026-11-03", filings }, 60_000);
    expect(r).toMatchObject({ files: 1, pairs: 2, inserted: 2 });
    expect(await m.all("SELECT v FROM kv_state WHERE k='sector_cursor'")).toEqual([{ v: "5" }]); // waits before job 6
    expect(await buildSectors({ market: m, raw, today: "2026-11-03", filings }, 60_000)).toMatchObject({ files: 0 });
  });
});
