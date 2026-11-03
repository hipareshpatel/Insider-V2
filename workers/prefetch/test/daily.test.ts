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
};
const key = (url: string) => url.includes("corporateActions") ? "corporatesCorporateActions" : url.includes("share-holdings") ? "corporateShareHoldingsMaster" : "corporateAnnouncements";

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
    expect(out).toMatchObject({ corp_actions: 2, shareholding_attachments: 1, results_refresh: 1 });
    expect(await dueSlot(db, now)).toBeNull();
    expect(await market.all("SELECT symbol, ex_date FROM corp_action_extra WHERE source='nse_bulk' ORDER BY symbol")).toEqual([{ symbol: "INFY", ex_date: "2026-10-28" }, { symbol: "SHRIRAMFIN", ex_date: "2027-01-10" }]);
    const att = await db.all<{ symbol: string; parent_id: number | null }>("SELECT symbol, parent_id FROM fetch_job WHERE kind='xbrl_shareholding'");
    expect(att).toHaveLength(1); expect(att[0]!.symbol).toBe("INFY"); expect(att[0]!.parent_id).not.toBeNull();
    const ref = await db.all<{ url: string; status: string }>("SELECT url, status FROM fetch_job WHERE kind='integrated_financials'");
    expect(ref).toEqual([{ url: expect.stringContaining("symbol=INFY") as unknown as string, status: "todo" }]);
    expect(ref[0]!.url).toContain("from_date=29-10-2026&to_date=03-11-2026");
    expect((await db.all("SELECT 1 FROM fetch_job WHERE kind LIKE 'bulk_%' OR kind='announcements_daily'")).length).toBe(3);
    expect(r2.size).toBe(3); expect(calls).toBe(3);
  });
});
