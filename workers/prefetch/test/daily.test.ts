import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import { dailyRefresh, dueSlot, resultsTriggers, rowAttachments } from "../src/daily.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
function sqlite(domain: string): Sql {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(MIG, domain)).sort()) db.exec(readFileSync(join(MIG, domain, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return {
    async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...norm(params)) as T[]; },
    async run(sql: string, params: unknown[] = []) { return { changes: Number(db.prepare(sql).run(...norm(params)).changes) }; },
    async batch(stmts: Stmt[]) { let n = 0; for (const s of stmts) n += Number(db.prepare(s.sql).run(...norm(s.params)).changes); return n; },
  };
}
const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));
const XBRL = "https://nsearchives.nseindia.com/corporate/xbrl/SHP_123_INFY.xml";
const NSE: Record<string, unknown> = {
  corporatesCorporateActions: [{ symbol: "SHRIRAMFIN", exDate: "10-Jan-2027", subject: "Face Value Split (Sub-Division) - From Rs 2/- Per Share To Re 1/- Per Share", series: "EQ" },
    { symbol: "INFY", exDate: "28-Oct-2026", subject: "Interim Dividend - Rs 23 Per Share", series: "EQ" }],
  corporateShareHoldingsMaster: [{ symbol: "INFY", broadcastDate: "02-Nov-2026 18:00:00", xbrl: XBRL }],
  corporateAnnouncements: [{ symbol: "INFY", desc: "Outcome of Board Meeting" }, { symbol: "TCS", desc: "General Updates" }],
  pitGg: { data: [{ appId: "4155", symbol: "ACEVECTOR", broadcastDateTime: "03-Nov-2026 22:09:12", xmlFileName: "https://nsearchives.nseindia.com/corporate/xbrl/IT_20276_WebXMLFile_20261103_220912677.xml" }] },
};
const key = (url: string) => url.includes("corporates-pit-gg") ? "pitGg" : url.includes("corporateActions") ? "corporatesCorporateActions" : url.includes("share-holdings") ? "corporateShareHoldingsMaster" : "corporateAnnouncements";

describe("daily freshness (plan item 2)", () => {
  it("parses triggers and attachments", () => {
    expect(resultsTriggers(JSON.stringify(NSE.corporateAnnouncements))).toEqual(["INFY"]);
    expect(rowAttachments(JSON.stringify(NSE.corporateShareHoldingsMaster))).toEqual([["INFY", XBRL]]);
  });
  it("runs each slot once; queues actions, shareholding XBRL and dated results refreshes; ledger and R2 kept", async () => {
    const db = sqlite("filings"), market = sqlite("market");
    const r2 = new Map<string, Uint8Array>();
    const raw = { async put(k: string, b: Uint8Array) { r2.set(k, b); }, async get() { return null; } } as unknown as R2Bucket;
    let calls = 0;
    const get = async (url: string) => { calls++; return { status: 200, bytes: enc(NSE[key(url)]) }; };
    const now = new Date("2026-11-03T15:05:00Z"); // 20:35 IST, a Tuesday
    expect(await dueSlot(db, new Date("2026-11-03T13:00:00Z"))).toBe("morning"); // 18:30 IST: morning slot not yet run
    expect(await dueSlot(db, now)).toBe("evening");
    const out = await dailyRefresh({ db, market, raw, get, gzip: async (b) => b, now }, "evening");
    expect(out).toMatchObject({ corp_actions: 2, shareholding_attachments: 1, results_refresh: 1, insider_list: 1 });
    expect(await dueSlot(db, now)).toBeNull();
    expect(await market.all("SELECT symbol, ex_date FROM corp_action_extra WHERE source='nse_bulk' ORDER BY symbol")).toEqual([{ symbol: "INFY", ex_date: "2026-10-28" }, { symbol: "SHRIRAMFIN", ex_date: "2027-01-10" }]);
    const att = await db.all<{ symbol: string; parent_id: number | null }>("SELECT symbol, parent_id FROM fetch_job WHERE kind='xbrl_shareholding'");
    expect(att).toHaveLength(1); expect(att[0]!.symbol).toBe("INFY"); expect(att[0]!.parent_id).not.toBeNull();
    const ref = await db.all<{ url: string; status: string }>("SELECT url, status FROM fetch_job WHERE kind='integrated_financials'");
    expect(ref).toEqual([{ url: expect.stringContaining("symbol=INFY") as unknown as string, status: "todo" }]);
    expect(ref[0]!.url).toContain("from_date=29-10-2026&to_date=03-11-2026");
    expect((await db.all("SELECT 1 FROM fetch_job WHERE kind LIKE 'bulk_%' OR kind='announcements_daily'")).length).toBe(3);
    expect(await db.all("SELECT url FROM fetch_job WHERE kind='pit_gg'")).toEqual([{ url: expect.stringContaining("corporates-pit-gg?index=equities&from_date=31-10-2026&to_date=03-11-2026") as unknown as string }]);
    expect(r2.size).toBe(10); expect(calls).toBe(10); // + insider list (C53) + SAST, board meetings, credit ratings (audit P1) + ASM, GSM, FII/DII snapshots (evening)
    const { seedStructureHistory } = await import("../src/daily.js");
    expect(await seedStructureHistory(db, now)).toBeGreaterThan(2000); // ~700 weekdays × 3
    expect(await seedStructureHistory(db, now)).toBe(0); // once
  });
});

describe("a slot whose NSE fetches fail is retried (3 Nov evening, C51)", () => {
  it("not marked done on failure; retried after 10 minutes, at most SLOT_TRIES times; done once the fetches succeed", async () => {
    const { SLOT_TRIES } = await import("../src/daily.js");
    const db = sqlite("filings"), market = sqlite("market");
    const raw = { async put() {}, async get() { return null; } } as unknown as R2Bucket;
    let up = false;
    const get = async (url: string) => (up || url.includes("report") || url.includes("fiidii") ? { status: 200, bytes: enc(NSE[key(url)] ?? []) } : { status: 403, bytes: new Uint8Array() });
    const t = (min: number) => new Date(Date.parse("2026-11-03T15:00:00Z") + min * 60_000); // 20:30 IST + min
    const out = await dailyRefresh({ db, market, raw, get, gzip: async (b) => b, now: t(0) }, "evening");
    expect(out).toMatchObject({ corp_actions: "fetch failed", shareholding_attachments: "fetch failed", announcements: "fetch failed", tries: 1 });
    expect(await dueSlot(db, t(5))).toBeNull(); // waits 10 minutes
    expect(await dueSlot(db, t(11))).toBe("evening"); // then retried
    for (let i = 2; i <= SLOT_TRIES; i++) await dailyRefresh({ db, market, raw, get, gzip: async (b) => b, now: t(11 * i) }, "evening");
    expect(await dueSlot(db, t(200))).toBeNull(); // gave up after SLOT_TRIES: visible as evening:retry
    expect(await db.all("SELECT slot FROM daily_refresh")).toEqual([{ slot: "evening:retry" }]);
    // a fresh day, NSE answering again: done on the first try
    up = true;
    const next = new Date("2026-11-04T15:05:00Z");
    expect(await dueSlot(db, next)).toBe("evening");
    expect(await dailyRefresh({ db, market, raw, get, gzip: async (b) => b, now: next }, "evening")).toMatchObject({ corp_actions: 2 });
    expect(await dueSlot(db, next)).toBeNull();
  });
});

describe("full history for the 20-row-capped lists (C40)", () => {
  it("queues monthly all-company feeds and one dated PIT/governance/BRSR call per company, once", async () => {
    const db = sqlite("filings");
    await db.run("INSERT INTO fetch_job (kind, symbol, url, r2_key, status) VALUES ('pit','INFY','u1','k1','done'), ('pit','TCS','u2','k2','done')");
    const { seedFullHistory } = await import("../src/daily.js");
    const n = await seedFullHistory(db, new Date("2026-11-03T05:00:00Z"));
    const months = (2026 - 2021) * 12 + 11;
    expect(n).toBe(months * 4 + 2 * 3);
    expect((await db.all("SELECT 1 FROM fetch_job WHERE kind='pit' AND url LIKE '%from_date=01-01-2021%'")).length).toBe(2);
    expect(await seedFullHistory(db, new Date("2026-11-03T05:00:00Z"))).toBe(0);
  });
});

describe("universe lock and insider XBRL (owner 4 Nov; audit P0)", () => {
  it("only focus companies get per-company refreshes and XBRL; files are born discovered=1; the insider list's XBRL is queued", async () => {
    const db = sqlite("filings"), market = sqlite("market");
    const raw = { async put() {}, async get() { return null; } } as unknown as R2Bucket;
    const both: Record<string, unknown> = { ...NSE, corporateAnnouncements: [{ symbol: "INFY", desc: "Outcome of Board Meeting" }, { symbol: "ZZOTHER", desc: "Financial Results" }],
      corporateShareHoldingsMaster: [{ symbol: "INFY", broadcastDate: "02-Nov-2026 18:00:00", xbrl: XBRL }, { symbol: "ZZOTHER", broadcastDate: "02-Nov-2026 18:00:00", xbrl: "https://nsearchives.nseindia.com/corporate/xbrl/SHP_9_ZZ.xml" }],
      pitGg: { data: [{ appId: "1", symbol: "INFY", broadcastDateTime: "03-Nov-2026 22:09:12", xmlFileName: "https://nsearchives.nseindia.com/corporate/xbrl/IT_1.xml" },
        { appId: "2", symbol: "ZZOTHER", broadcastDateTime: "03-Nov-2026 22:10:00", xmlFileName: "https://nsearchives.nseindia.com/corporate/xbrl/IT_2.xml" }] } };
    const get = async (url: string) => ({ status: 200, bytes: enc(both[key(url)]) });
    const now = new Date("2026-11-03T15:05:00Z");
    const out = await dailyRefresh({ db, market, raw, get, gzip: async (b) => b, now, focus: ["INFY", "TCS"] }, "evening");
    expect(out).toMatchObject({ shareholding_attachments: 1, results_refresh: 1, insider_attachments: 1 });
    expect(await db.all("SELECT kind, symbol, discovered FROM fetch_job WHERE kind IN ('xbrl_shareholding','xbrl_pit_gg') ORDER BY kind"))
      .toEqual([{ kind: "xbrl_pit_gg", symbol: "INFY", discovered: 1 }, { kind: "xbrl_shareholding", symbol: "INFY", discovered: 1 }]);
    expect((await db.all<{ symbol: string }>("SELECT symbol FROM fetch_job WHERE kind='integrated_financials'")).map((r) => r.symbol)).toEqual(["INFY"]);
    // Sunday sweep: the focus companies only
    const sun = new Date("2026-11-08T15:05:00Z");
    await dailyRefresh({ db, market, raw, get, gzip: async (b) => b, now: sun, focus: ["INFY", "TCS"] }, "evening");
    expect((await db.all<{ symbol: string }>("SELECT symbol FROM fetch_job WHERE kind='integrated_financials' AND r2_key LIKE '%-sweep.json' ORDER BY symbol")).map((r) => r.symbol)).toEqual(["INFY", "TCS"]);
  });
});

describe("insider gap: all-company PIT list by month, 1 Apr 2025 -> 2 May 2026", async () => {
  const { pitMonths, seedPitAllMonths } = await import("../src/daily.js");
  it("14 months, the last cut at 2 May 2026; no symbol; queued once", async () => {
    const m = pitMonths();
    expect(m[0]).toEqual(["2025-04-01", "2025-04-30"]);
    expect(m[10]).toEqual(["2026-02-01", "2026-02-28"]);
    expect(m[m.length - 1]).toEqual(["2026-05-01", "2026-05-02"]);
    expect(m).toHaveLength(14);
    const db = sqlite("filings");
    expect(await seedPitAllMonths(db, new Date("2026-11-06T02:00:00Z"))).toBe(14);
    expect(await seedPitAllMonths(db, new Date("2026-11-06T02:00:00Z"))).toBe(0);
    const [j] = await db.all<{ url: string; kind: string; symbol: string | null }>("SELECT url, kind, symbol FROM fetch_job WHERE r2_key = 'api/pit/all/2025-04-01_2025-04-30.json'");
    expect(j).toMatchObject({ kind: "pit", symbol: null });
    expect(j!.url).toMatch(/corporates-pit\?index=equities&from_date=01-04-2025&to_date=30-04-2025$/);
  });
});

describe("item 7: insider-trade lists by calendar quarter (NSE's dated PIT list answers about a year)", async () => {
  const { pitWindows, seedPitWindows } = await import("../src/daily.js");
  it("quarters from 2022-Q1 to 2 May 2026; one call per focus company per quarter, queued once", async () => {
    const w = pitWindows();
    expect(w[0]).toEqual(["2022-01-01", "2022-03-31"]);
    expect(w[1]).toEqual(["2022-04-01", "2022-06-30"]);
    expect(w[w.length - 1]).toEqual(["2026-04-01", "2026-05-02"]);
    expect(w).toHaveLength(18);
    const db = sqlite("filings");
    expect(await seedPitWindows(db, new Date("2026-11-05T10:00:00Z"), ["TCS", "M&M"])).toBe(36);
    expect(await seedPitWindows(db, new Date("2026-11-05T10:00:00Z"), ["TCS"])).toBe(0);
    const urls = (await db.all<{ url: string; kind: string }>("SELECT url, kind FROM fetch_job WHERE symbol = 'M&M' ORDER BY url LIMIT 1"));
    expect(urls[0]).toMatchObject({ kind: "pit" });
    expect(urls[0]!.url).toContain("symbol=M%26M&from_date=01-01-2022&to_date=31-03-2022");
  });
});

describe("MCX / ABBOTINDIA: re-queue a focus company's per-company lists (lost at the one-time seed)", async () => {
  const { requeueCompanyLists } = await import("../src/daily.js");
  const { companyJobs, PER_COMPANY } = await import("../src/jobs.js");
  it("queues lists never seeded, puts empty / failed ones back, leaves fetched lists and other companies alone", async () => {
    const db = sqlite("filings");
    const [res, shp, ifin] = ["results_quarterly", "shareholding", "integrated_financials"].map((k) => companyJobs(["MCX"], "2026-10-30").find((j) => j.kind === k)!);
    await db.run("INSERT INTO fetch_job (kind, symbol, url, r2_key, status, attempts, bytes) VALUES (?,?,?,?, 'empty', 1, 2)", [res!.kind, "MCX", res!.url, res!.key]);
    await db.run("INSERT INTO fetch_job (kind, symbol, url, r2_key, status, attempts, http_status, error) VALUES (?,?,?,?, 'failed', 4, 403, 'refused 403')", [shp!.kind, "MCX", shp!.url, shp!.key]);
    await db.run("INSERT INTO fetch_job (kind, symbol, url, r2_key, status, attempts, discovered) VALUES (?,?,?,?, 'done', 1, 1)", [ifin!.kind, "MCX", ifin!.url, ifin!.key]);
    const r = await requeueCompanyLists(db, new Date("2026-11-06T10:00:00Z"), ["MCX", " ", "INFY", "MCX"], ["MCX", "ABBOTINDIA"]);
    expect(r).toMatchObject({ symbols: ["MCX"], skipped: ["INFY"], requeued: 2 });
    expect(r.queued).toBe(Object.keys(PER_COMPANY).length - 3);
    const rows = await db.all<{ kind: string; status: string; attempts: number; discovered: number; r2_key: string }>("SELECT kind, status, attempts, discovered, r2_key FROM fetch_job WHERE symbol='MCX' ORDER BY job_id");
    expect(rows.find((x) => x.kind === "results_quarterly")).toMatchObject({ status: "todo", attempts: 0, discovered: 0, r2_key: res!.key });
    expect(rows.find((x) => x.kind === "shareholding")).toMatchObject({ status: "todo", attempts: 0 });
    expect(rows.find((x) => x.kind === "integrated_financials")).toMatchObject({ status: "done", discovered: 1 });
    expect(rows.filter((x) => x.status === "todo")).toHaveLength(rows.length - 1);
    expect((await db.all("SELECT 1 FROM fetch_job WHERE symbol='INFY'")).length).toBe(0);
    // again: nothing new, nothing re-queued (all already waiting)
    expect(await requeueCompanyLists(db, new Date("2026-11-06T11:00:00Z"), ["MCX"], ["MCX"])).toMatchObject({ queued: 0, requeued: 0 });
  });
});

describe("G19: all-company results lists by month (/maint/results_all_months), focus XBRL only", async () => {
  const { resultsAllMonths, seedResultsAllMonths } = await import("../src/daily.js");
  const { discover } = await import("../src/index.js");
  const now = new Date("2026-11-06T12:00:00Z"); // 17:30 IST, 6 Nov 2026
  it("bounds: floor 2024-01, current month at most, 15 months per call; the current month ends today", () => {
    expect(resultsAllMonths("2023-12", "2024-03", now)).toMatch(/2024-01 or later/);
    expect(resultsAllMonths("2026-10", "2026-12", now)).toMatch(/2026-11 or earlier/);
    expect(resultsAllMonths("2025-05", "2025-04", now)).toMatch(/from after to/);
    expect(resultsAllMonths("2024-01", "2025-04", now)).toMatch(/at most 15/);
    expect(resultsAllMonths("2025-2", "2025-04", now)).toMatch(/YYYY-MM/);
    const m = resultsAllMonths("2024-01", "2025-03", now) as [string, string][];
    expect(m).toHaveLength(15);
    expect(m[1]).toEqual(["2024-02-01", "2024-02-29"]);
    expect(resultsAllMonths("2026-10", "2026-11", now)).toEqual([["2026-10-01", "2026-10-31"], ["2026-11-01", "2026-11-06"]]);
  });
  it("queues one all-company list per month (unique URLs, symbol NULL, per-company kinds); a repeat queues nothing", async () => {
    const db = sqlite("filings");
    expect(await seedResultsAllMonths(db, now, "2025-02", "2025-02", "Weekly")).toEqual({ error: "period: Quarterly or Annual" });
    expect(await seedResultsAllMonths(db, now, "2023-01", "2023-02", "Quarterly")).toHaveProperty("error");
    expect(await seedResultsAllMonths(db, now, "2025-02", "2025-02", "Quarterly")).toEqual({ months: 1, queued: 1, held: 0 });
    const [j] = await db.all<{ kind: string; symbol: string | null; url: string; r2_key: string; status: string }>("SELECT kind, symbol, url, r2_key, status FROM fetch_job");
    expect(j).toEqual({ kind: "results_quarterly", symbol: null, status: "todo", r2_key: "api/results_quarterly/all/2025-02-01_2025-02-28.json",
      url: "https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly&from_date=01-02-2025&to_date=28-02-2025" });
    await db.run("UPDATE fetch_job SET status='done', discovered=1");
    expect(await seedResultsAllMonths(db, now, "2024-12", "2026-02", "Quarterly")).toEqual({ months: 15, queued: 14, held: 1 });
    expect(await seedResultsAllMonths(db, now, "2024-12", "2026-02", "Quarterly")).toEqual({ months: 15, queued: 0, held: 15 });
    expect(await db.all("SELECT status FROM fetch_job WHERE r2_key LIKE '%2025-02-01%'")).toEqual([{ status: "done" }]); // held list untouched
    expect(await seedResultsAllMonths(db, now, "2025-04", "2025-05", "Annual")).toEqual({ months: 2, queued: 2, held: 0 });
    expect((await db.all("SELECT 1 FROM fetch_job WHERE kind='results_annual' AND url LIKE '%period=Annual%' AND r2_key LIKE 'api/results_annual/all/%'")).length).toBe(2);
    expect(await db.all("SELECT slot, detail FROM daily_refresh WHERE day='once' ORDER BY slot")).toEqual([
      { slot: "results_all_months:Annual:2025-04_2025-05", detail: '{"months":2,"queued":2,"held":0}' },
      { slot: "results_all_months:Quarterly:2024-12_2026-02", detail: '{"months":15,"queued":0,"held":15}' },
      { slot: "results_all_months:Quarterly:2025-02_2025-02", detail: '{"months":1,"queued":1,"held":0}' }]);
  });
  it("discover(): an all-company list queues the focus companies' XBRL under their row symbol; others and held files skipped", async () => {
    const db = sqlite("filings");
    const x = (n: string) => `https://nsearchives.nseindia.com/corporate/xbrl/${n}.xml`;
    const listKey = "api/results_quarterly/all/2025-02-01_2025-02-28.json";
    const list = [
      { symbol: "SBILIFE", period: "Quarterly", toDate: "31-Dec-2024", consolidated: "Non-Consolidated", broadCastDate: "24-Jan-2025 16:10:00", xbrl: x("INS_SBILIFE_SA") },
      { symbol: "SBILIFE", period: "Quarterly", toDate: "31-Dec-2024", consolidated: "Consolidated", broadCastDate: "24-Jan-2025 16:12:00", xbrl: x("INS_SBILIFE_CONS") },
      { symbol: "ICICIGI", period: "Quarterly", toDate: "31-Dec-2024", consolidated: "Non-Consolidated", xbrl: x("INS_ICICIGI_SA") },
      { symbol: "ZZSMALL", period: "Quarterly", toDate: "31-Dec-2024", xbrl: x("ZZ_1") },
      { symbol: "HDFCLIFE", period: "Quarterly", toDate: "31-Mar-2019", xbrl: x("OLD") },
    ];
    await db.run("INSERT INTO fetch_job (job_id, kind, symbol, url, r2_key, status) VALUES (1, 'results_quarterly', NULL, 'https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly&from_date=01-02-2025&to_date=28-02-2025', ?, 'done')", [listKey]);
    // ICICIGI's file is already held (e.g. from another list): left as it is
    await db.run("INSERT INTO fetch_job (job_id, kind, symbol, url, r2_key, parent_id, status, discovered) VALUES (9, 'xbrl_integrated_financials', 'ICICIGI', ?, 'att/xbrl/INS_ICICIGI_SA.xml', 7, 'done', 1)", [x("INS_ICICIGI_SA")]);
    const raw = { async get(k: string) { return k === listKey ? { customMetadata: {}, text: async () => JSON.stringify(list) } : null; } } as unknown as R2Bucket;
    // no focus list: the all-company list waits (not discovered, nothing queued)
    expect(await discover({ RAW: raw }, db, async () => undefined)).toBe(0);
    expect(await db.all("SELECT discovered FROM fetch_job WHERE job_id=1")).toEqual([{ discovered: 0 }]);
    let asked = 0;
    const focus = async () => { asked++; return ["SBILIFE", "ICICIGI", "HDFCLIFE"]; };
    await discover({ RAW: raw }, db, focus);
    expect(asked).toBe(1);
    expect(await db.all("SELECT kind, symbol, url, r2_key, parent_id, status, discovered FROM fetch_job WHERE job_id <> 1 ORDER BY url")).toEqual([
      { kind: "xbrl_integrated_financials", symbol: "ICICIGI", url: x("INS_ICICIGI_SA"), r2_key: "att/xbrl/INS_ICICIGI_SA.xml", parent_id: 7, status: "done", discovered: 1 },
      { kind: "xbrl_results_quarterly", symbol: "SBILIFE", url: x("INS_SBILIFE_CONS"), r2_key: "att/xbrl/INS_SBILIFE_CONS.xml", parent_id: 1, status: "todo", discovered: 1 },
      { kind: "xbrl_results_quarterly", symbol: "SBILIFE", url: x("INS_SBILIFE_SA"), r2_key: "att/xbrl/INS_SBILIFE_SA.xml", parent_id: 1, status: "todo", discovered: 1 },
    ]);
    expect(await db.all("SELECT discovered FROM fetch_job WHERE job_id=1")).toEqual([{ discovered: 1 }]);
    // per-company lists are unchanged: every file, under the list's symbol; the focus list is not asked
    await db.run("INSERT INTO fetch_job (job_id, kind, symbol, url, r2_key, status) VALUES (2, 'results_quarterly', 'INFY', 'https://www.nseindia.com/api/x', 'k/infy', 'done')");
    const raw2 = { async get(k: string) { return k === "k/infy" ? { customMetadata: {}, text: async () => JSON.stringify([{ toDate: "31-Dec-2024", xbrl: x("INFY_Q3") }]) } : null; } } as unknown as R2Bucket;
    asked = 0;
    expect(await discover({ RAW: raw2 }, db, focus)).toBe(1);
    expect(asked).toBe(0);
    expect(await db.all("SELECT symbol, parent_id FROM fetch_job WHERE url=?", [x("INFY_Q3")])).toEqual([{ symbol: "INFY", parent_id: 2 }]);
  });
});
