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
    expect(r2.size).toBe(7); expect(calls).toBe(7); // + insider list (C53) + ASM, GSM, FII/DII snapshots (evening)
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
