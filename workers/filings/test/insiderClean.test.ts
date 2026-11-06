// C53b: the insider-clean read path on the real schema: INFY's 2024 Q1 PIT list (real NSE rows) is loaded by the real loader,
// read back with the endpoint's SQL, and cleaned. The cleaned result is never written back to storage.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import worker, { type Env } from "../src/index.js";
import { SQL_INSIDER_ROWS, cleanStoredInsider, insiderInputOf, loadEvents, type StoredInsiderRow } from "../src/events.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
function sqlite(domain: string): Sql & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(ROOT, "db", "migrations", domain)).sort()) db.exec(readFileSync(join(ROOT, "db", "migrations", domain, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return {
    raw: db,
    async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...norm(params)) as T[]; },
    async run(sql: string, params: unknown[] = []) { return { changes: Number(db.prepare(sql).run(...norm(params)).changes) }; },
    async batch(stmts: Stmt[]) { let n = 0; for (const s of stmts) n += Number(db.prepare(s.sql).run(...norm(s.params)).changes); return n; },
  };
}

describe("/insider-clean read path (C53b)", () => {
  it("loads INFY's real PIT list, reads it back by the endpoint's SQL and labels it; stored dates return as ISO", async () => {
    const filings = sqlite("filings");
    const pit = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/api_pit_INFY_2024Q1.json"), "utf8");
    filings.raw.exec("INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (10,'pit','INFY','p1','k/pit','done')");
    await loadEvents(filings, async (k) => (k === "k/pit" ? pit : null));
    const stored = await filings.all<StoredInsiderRow>(SQL_INSIDER_ROWS, ["INFY", 20240101, 2000]);
    expect(stored).toHaveLength(36);                       // 40 listed, 4 exact duplicates collapsed by the key at load
    const first = insiderInputOf(stored[0]!);
    expect(first.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.appId).toBe(stored[0]!.did);

    const res = cleanStoredInsider(stored, "2026-11-06");
    expect(res.trades).toHaveLength(36);
    expect(res.removed).toEqual([]);                       // nothing left to remove: the table already holds each row once
    expect(res.counts.kinds).toEqual({ esop: 30, off_market: 4, market: 2 });
    expect(res.counts.market_trades).toBe(2);
    expect(res.trades.filter((t) => t.isMarket).map((t) => t.side)).toEqual(["SELL", "SELL"]);
    expect(res.trades.every((t) => t.secType !== "ADR/GDR/FCCB" || t.flags.includes("not_equity_shares"))).toBe(true);
  });
  it("the date filter and the row cap bind", async () => {
    const filings = sqlite("filings");
    filings.raw.exec(`INSERT INTO insider_trade (key,symbol,person,to_d,from_d,disclosed_at) VALUES ('a','X','p',20260105,20260105,'2026-01-06T10:00:00'),('b','X','p',20251230,20251230,'2025-12-31T10:00:00'),('c','Y','p',20260105,20260105,'2026-01-06T10:00:00')`);
    expect((await filings.all(SQL_INSIDER_ROWS, ["X", 20260101, 2000])).map((r) => (r as { key: string }).key)).toEqual(["a"]);
    expect(await filings.all(SQL_INSIDER_ROWS, ["X", 20200101, 1])).toHaveLength(1);
  });
});

describe("GET /insider-clean (route handler, D1 shim over the migrated SQLite)", () => {
  async function env() {
    const filings = sqlite("filings");
    const pit = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/api_pit_INFY_2024Q1.json"), "utf8");
    filings.raw.exec("INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (10,'pit','INFY','p1','k/pit','done')");
    await loadEvents(filings, async (k) => (k === "k/pit" ? pit : null));
    const d1 = { prepare: (sql: string) => ({ bind: (...p: unknown[]) => ({ all: async () => ({ results: filings.raw.prepare(sql).all(...(p as (string | number)[])) }) }) }) };
    return { DB_FILINGS: d1 } as unknown as Env;
  }
  const get = async (q: string) => { const r = await worker.page(new Request(`https://x/insider-clean${q}`), await env()); return { status: r.status, body: await r.json() as Record<string, any> }; };
  it("answers with counts, clean market trades first then held-back rows, and what it did not apply", async () => {
    const { status, body } = await get("?symbol=infy&from=2024-01-01&rows=5");
    expect(status).toBe(200);
    expect(body).toMatchObject({ symbol: "INFY", stored_rows: 36, hit_limit: false });
    expect(body.counts.kinds).toEqual({ esop: 30, off_market: 4, market: 2 });
    expect(body.trades).toHaveLength(5);
    expect(body.trades[0]).toMatchObject({ person: "Infosys Employee Benefits Trust", kind: "market", side: "SELL", secType: "Equity Shares", qty: 6534, holdingCheck: "match", flags: [], needsReview: false });
    expect(body.trades[1]).toMatchObject({ person: "Sunil Senan", kind: "market", side: "SELL", secType: "ADR/GDR/FCCB", flags: ["not_equity_shares"], needsReview: true }); // the other market sale is ADRs: held back
    expect(body.not_applied.join(" ")).toMatch(/revision marker/);
  });
  it("refuses a missing or malformed symbol / date with 400", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("?symbol=INFY&from=yesterday")).status).toBe(400);
    expect((await get("?symbol=IN%20FY")).status).toBe(400);
  });
});
