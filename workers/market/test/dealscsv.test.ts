// Work list 1.8: capped bulk/block days replaced from NSE's uncapped CSV window.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import { dealsCsvKey, refillDealsCsv } from "../src/structure.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations", "market");
function sqlite(): Sql {
  const d = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIG).sort()) d.exec(readFileSync(join(MIG, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return {
    async all<T>(sql: string, p: unknown[] = []) { return d.prepare(sql).all(...norm(p)) as T[]; },
    async run(sql: string, p: unknown[] = []) { return { changes: Number(d.prepare(sql).run(...norm(p)).changes) }; },
    async batch(s: Stmt[]) { let n = 0; for (const x of s) n += Number(d.prepare(x.sql).run(...norm(x.params)).changes); return n; },
  };
}
// header exactly as NSE's csv=true answer (quoted, trailing spaces)
const CSV = ['"Date ","Symbol ","Security Name ","Client Name ","Buy / Sell ","Quantity Traded ","Trade Price / Wght. Avg. Price ","Remarks "',
  ...Array.from({ length: 75 }, (_, i) => `"04-JUN-2024","SYM${i}","Name ${i}","CLIENT ${i}","BUY","${1000 + i}","12.34","-"`),
  '"05-JUN-2024","OTHER","Other","C","SELL","5","1.00","-"'].join("\n");
const bucket = (objs: Record<string, string>) => ({ async get(k: string) { const t = objs[k]; return t === undefined ? null : { customMetadata: {}, text: async () => t }; } }) as unknown as R2Bucket;

describe("bulk/block CSV refill (work list 1.8)", () => {
  it("window keys: 10-day windows from 2024-01-01", () => {
    expect(dealsCsvKey("bulk", "2024-01-01")).toBe("api/market_structure/bulk_deals_csv/2024-01-01.csv");
    expect(dealsCsvKey("bulk", "2024-06-04")).toBe("api/market_structure/bulk_deals_csv/2024-05-30.csv");
    expect(dealsCsvKey("block", "2024-01-11")).toBe("api/market_structure/block_deals_csv/2024-01-11.csv");
  });
  it("a capped day (70 API rows) is replaced by the day's 75 CSV rows; waits while the window is not stored", async () => {
    const m = sqlite();
    await m.run("INSERT INTO ms_day (source, d, rows, note) VALUES ('bulk', 20240604, 70, 'possibly truncated (API cap 70)')");
    for (let i = 0; i < 70; i++) await m.run("INSERT INTO deal (kind, d, symbol, client, side, qty, price_paise) VALUES ('bulk', 20240604, ?, ?, 'B', ?, 1234)", [`SYM${i}`, `CLIENT ${i}`, 1000 + i]);
    const deps = (objs: Record<string, string>) => ({ market: m, raw: bucket(objs), now: () => new Date("2026-11-04T00:00:00Z") });
    expect(await refillDealsCsv(deps({}), 60_000)).toEqual({ refilled: 0, waiting: 1 });
    expect(await refillDealsCsv(deps({ "api/market_structure/bulk_deals_csv/2024-05-30.csv": CSV }), 60_000)).toEqual({ refilled: 1, waiting: 0 });
    expect(await m.all("SELECT count(*) AS n FROM deal WHERE kind='bulk' AND d=20240604")).toEqual([{ n: 75 }]);
    expect(await m.all("SELECT rows, note FROM ms_day WHERE source='bulk' AND d=20240604")).toEqual([{ rows: 75, note: "complete (csv window)" }]);
    expect(await refillDealsCsv(deps({}), 60_000)).toEqual({ refilled: 0, waiting: 0 }); // nothing capped left
  });
});
