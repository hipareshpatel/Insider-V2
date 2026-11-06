// G19 (log #399): /gap-census late_start — companies whose stored quarterly results begin after the coverage floor
// though they were listed by then (the 6 insurers: nothing stored before 2025-03-31, no coverage_gap row, silent) —
// and the /if-list ?since= filter, which kept every row because each row carries its list's fetch date.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import worker, { type Env } from "../src/index.js";
import { ifListKeeps, ifListSince, listRowPeriodEnd } from "../src/basis.js";
import { firstQuarterEnd, gapCensus } from "../src/readiness.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
function schema(domain: string): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(MIG, domain)).sort()) db.exec(readFileSync(join(MIG, domain, f), "utf8"));
  return db;
}
function sqlite(domain: string): Sql & { raw: DatabaseSync } {
  const db = schema(domain);
  return {
    raw: db,
    async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...norm(params)) as T[]; },
    async run(sql: string, params: unknown[] = []) { return { changes: Number(db.prepare(sql).run(...norm(params)).changes) }; },
    async batch(stmts: Stmt[]) { let n = 0; for (const s of stmts) n += Number(db.prepare(s.sql).run(...norm(s.params)).changes); return n; },
  };
}
function d1(domain: string): D1Database & { raw: DatabaseSync } {
  const db = schema(domain);
  return { raw: db, prepare: (sql: string) => {
      const bound = (...p: unknown[]) => ({ all: async () => ({ results: db.prepare(sql).all(...norm(p)), meta: { rows_read: 1 } }), first: async () => db.prepare(sql).get(...norm(p)) ?? null, run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...norm(p)).changes) } }) });
      return { bind: bound, ...bound() };
    } } as unknown as D1Database & { raw: DatabaseSync };
}

/** One P&L (or other) row of company `sid` for a period, with its filing. */
let fid = 0;
function fin(db: DatabaseSync, sid: number, end: string, kind: string, statement = "pl", basis = "consolidated") {
  fid++;
  db.exec(`INSERT INTO filing (filing_id,security_id,kind,period_end,period_kind,basis,disclosed_at,source_url) VALUES (${fid},${sid},'results_xbrl','${end}','${kind}','${basis}','${end}T12:00:00Z','u${fid}');
    INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version)
      VALUES (${sid},'insurance','${statement}','pat','','${end}','${kind}','${basis}','original','1','${end}T12:00:00Z',${fid},'reported','t')`);
}

describe("G19: /gap-census late_start", () => {
  it("first quarter end on or after the floor", () => {
    expect(firstQuarterEnd("2024-01-01")).toBe("2024-03-31");
    expect(firstQuarterEnd("2024-03-31")).toBe("2024-03-31");
    expect(firstQuarterEnd("2024-04-01")).toBe("2024-06-30");
    expect(firstQuarterEnd("2024-12-31")).toBe("2024-12-31");
  });

  it("flags a late starter listed before the floor; not a recent listing, a normal company or a hole at the first quarter", async () => {
    const f = sqlite("filings"), m = sqlite("market");
    m.raw.exec(`INSERT INTO security (security_id,name,listed_on) VALUES (1,'ICICI Lombard',NULL),(2,'New Listing',NULL),(3,'Normal',NULL),(4,'Old With Hole',NULL),(5,'Listed On Stored','2017-09-27');
      INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (1,'nse_symbol','ICICIGI','2024-01-01','t'),(1,'nse_symbol','ICICIGI2','2025-01-01','t'),
        (2,'nse_symbol','NEWCO','2024-09-12','t'),(3,'nse_symbol','NORMAL','2024-01-01','t'),(4,'nse_symbol','HOLE','2024-01-01','t'),(5,'nse_symbol','SBILIFE','2024-01-01','t');
      INSERT INTO price_daily (security_id,d,series,close,volume,file_id) VALUES (1,20240101,'EQ',1,1,1),(1,20250102,'EQ',1,1,1),(2,20240912,'EQ',1,1,1),(3,20240101,'EQ',1,1,1),(4,20240101,'EQ',1,1,1)`);
    // ICICIGI: quarterly results from 2025-03-31 only (a year-end balance sheet at 2024-03-31 does not count)
    fin(f.raw, 1, "2024-03-31", "FY", "bs"); fin(f.raw, 1, "2025-03-31", "FY"); fin(f.raw, 1, "2025-03-31", "Q", "pl", "standalone"); fin(f.raw, 1, "2025-06-30", "Q");
    fin(f.raw, 2, "2024-09-30", "Q"); // listed 2024-09-12: first results after listing
    fin(f.raw, 3, "2024-03-31", "Q", "pl", "standalone"); fin(f.raw, 3, "2024-06-30", "Q");
    fin(f.raw, 4, "2023-12-31", "Q"); fin(f.raw, 4, "2024-06-30", "Q"); // hole at 2024-03-31 is a coverage gap, not a late start
    fin(f.raw, 5, "2024-09-30", "Q"); // stored listing date wins over the price proxy (none stored here)
    f.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,fetched_at) VALUES
      (1,'integrated_financials','ICICIGI','https://www.nseindia.com/api/integrated-filing-results?index=equities&symbol=ICICIGI&from_date=01-04-2025&to_date=30-06-2025','k1','done','2026-11-02T00:00:00Z'),
      (2,'integrated_financials','ICICIGI2','https://www.nseindia.com/api/integrated-filing-results?index=equities&symbol=ICICIGI2&from_date=01-01-2025&to_date=31-03-2025','k2','done','2026-11-01T00:00:00Z'),
      (3,'results_quarterly','ICICIGI','https://www.nseindia.com/api/corporates-financial-results?index=equities&symbol=ICICIGI&period=Quarterly','k3','todo',NULL),
      (4,'shareholding','ICICIGI','s','k4','done','2026-11-02T00:00:00Z')`);
    const sids = [[1, "ICICIGI"], [2, "NEWCO"], [3, "NORMAL"], [4, "HOLE"], [5, "SBILIFE"], [6, "NOTHING"]].map(([sid, symbol]) => ({ sid: sid as number, symbol: symbol as string }));
    const r = await gapCensus(f, sids, "2026-09-30", m);
    expect(r.late_start).toMatchObject({ floor: "2024-01-01", first_quarter_end: "2024-03-31", listed_after: [{ symbol: "NEWCO", listed: "2024-09-12" }] });
    expect(r.late_start.companies).toEqual([
      { symbol: "ICICIGI", earliest_quarter: "2025-03-31", listed: "2024-01-01", listed_source: "first_price", lists: [
        { kind: "integrated_financials", status: "done", jobs: 2, last_fetched: "2026-11-02T00:00:00Z", earliest_from: "2025-01-01" },
        { kind: "results_quarterly", status: "todo", jobs: 1, last_fetched: null, earliest_from: "all" }] },
      { symbol: "SBILIFE", earliest_quarter: "2024-09-30", listed: "2017-09-27", listed_source: "listed_on", lists: [] },
      // nothing stored and no listing date known: still named (the hole is at least as wide)
      { symbol: "NOTHING", earliest_quarter: null, listed: null, listed_source: null, lists: [] },
    ]);
  });
});

describe("G19: /if-list ?since= filters by the row's own period end", () => {
  it("parses a year or a date; refuses anything else", () => {
    expect(ifListSince(null)).toBeNull();
    expect(ifListSince("2026")).toBe("2026-01-01");
    expect(ifListSince("2025-03-31")).toBe("2025-03-31");
    expect(ifListSince("26")).toBe("bad");
  });
  it("Integrated Filing qe_Date and results toDate; a later broadcast or fetch date never counts", () => {
    expect(listRowPeriodEnd({ qe_Date: "31-MAR-2025" })).toBe("2025-03-31");
    expect(listRowPeriodEnd({ toDate: "31-Dec-2024", fromDate: "01-Oct-2024" })).toBe("2024-12-31");
    expect(ifListKeeps({ qe_Date: "31-DEC-2024", broadcast_Date: "14-JAN-2026" }, "2025-01-01")).toBe(false);
    expect(ifListKeeps({ qe_Date: "31-MAR-2025" }, "2025-01-01")).toBe(true);
    expect(ifListKeeps({ remarks: "2026" }, "2025-01-01")).toBe(false);
    expect(ifListKeeps({ remarks: "x" }, null)).toBe(true);
  });
  it("through the worker: rows from older quarters are dropped although the list was fetched in 2026", async () => {
    const market = d1("market"), filings = d1("filings");
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,fetched_at) VALUES (1,'integrated_financials','ICICIGI','l1','k/1','done','2026-11-02T00:00:00Z'),
      (2,'results_quarterly','ICICIGI','l2','k/2','done','2026-11-02T00:00:00Z')`);
    const lists: Record<string, string> = {
      "k/1": JSON.stringify({ data: [{ qe_Date: "31-MAR-2025", consolidated: "Consolidated", broadcast_Date: "15-APR-2025" }, { qe_Date: "30-JUN-2026", consolidated: "Consolidated", broadcast_Date: "14-JUL-2026" }] }),
      "k/2": JSON.stringify([{ toDate: "31-Dec-2024", fromDate: "01-Oct-2024", period: "Quarterly", broadCastDate: "15-Jan-2026 10:00:00" }]),
    };
    const raw = { get: async (k: string) => (lists[k] ? { text: async () => lists[k], customMetadata: {} } : null) } as unknown as R2Bucket;
    const env = { DB_MARKET: market, DB_FILINGS: filings, RAW: raw, ENVIRONMENT: "test", STATUS_TOKEN: "tok", FOCUS_INDICES: "NIFTY 50" } as Env;
    const get = async (q: string) => worker.fetch(new Request(`https://x/if-list?symbol=ICICIGI${q}`, { headers: { authorization: "Bearer tok" } }), env);
    const all = await (await get("")).json() as { rows: Record<string, unknown>[] };
    expect(all.rows).toHaveLength(3);
    const r = await (await get("&since=2026")).json() as { rows: Record<string, unknown>[] };
    expect(r.rows.map((x) => x.qe_Date ?? x.toDate)).toEqual(["30-JUN-2026"]);
    const d = await (await get("&since=2025-01-01")).json() as { rows: Record<string, unknown>[] };
    expect(d.rows.map((x) => x.qe_Date ?? x.toDate)).toEqual(["31-MAR-2025", "30-JUN-2026"]);
    expect((await get("&since=x")).status).toBe(400);
  });
});
