// Phase 1 tests 4–5 helper: the per-date checksum ignores internal security ids (staging and production assign them
// independently) but sees any change of a stored value.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import { digestDay } from "../src/digest.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations", "market");
function db(sid: number, close: number): Sql {
  const d = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIG).sort()) d.exec(readFileSync(join(MIG, f), "utf8"));
  d.exec(`INSERT INTO security (security_id,name) VALUES (${sid},'Infosys');
    INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (${sid},'nse_symbol','INFY','2024-01-01','t');
    INSERT INTO price_daily (security_id,d,series,open,high,low,close,prev_close,volume,turnover_paise,trades,file_id) VALUES (${sid},20261030,'EQ',1,2,1,${close},1,10,100,1,1)`);
  return { async all<T>(sql: string, p: unknown[] = []) { return d.prepare(sql).all(...(p as (string | number)[])) as T[]; }, async run() { return { changes: 0 }; }, async batch(_s: Stmt[]) { return 0; } };
}
describe("digestDay", () => {
  it("same data under different security ids → same checksum; a changed close → different", async () => {
    const a = await digestDay(db(7, 150000), "2026-10-30"), b = await digestDay(db(4242, 150000), "2026-10-30"), c = await digestDay(db(7, 150100), "2026-10-30");
    expect(a.tables.price_daily).toEqual(b.tables.price_daily);
    expect(a.tables.price_daily!.rows).toBe(1);
    expect(c.tables.price_daily!.sha256).not.toBe(a.tables.price_daily!.sha256);
  });
});
