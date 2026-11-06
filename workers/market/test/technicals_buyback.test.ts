// G10: buyback_12m / last_buyback_date from the stored corp_action rows (migrations schema), as the daily ingest writes them.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { type Sql, type Stmt, buybackFeatures } from "@disclo/core";
import { buybackContext } from "../src/technicals.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations", "market");
function sqlite(): Sql {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIG).sort()) db.exec(readFileSync(join(MIG, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return {
    async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...norm(params)) as T[]; },
    async run(sql: string, params: unknown[] = []) { return { changes: Number(db.prepare(sql).run(...norm(params)).changes) }; },
    async batch(stmts: Stmt[]) { let n = 0; for (const s of stmts) n += Number(db.prepare(s.sql).run(...norm(s.params)).changes); return n; },
  };
}

describe("buybackContext (G10)", () => {
  it("one read for the batch: buyback purposes per security, rejected rows and other actions left out", async () => {
    const m = sqlite();
    for (const [id, n] of [[1, "INFY"], [2, "TCS"], [3, "COMBO"], [4, "OUT"]] as const) await m.run("INSERT INTO security (security_id, name) VALUES (?, ?)", [id, n]);
    // as daily.ts stores them: Bc "BUY BACK" -> type other / parsed; "BUY BACK OF SHARES" is unparsed -> review
    const ca = (sid: number, ex: string, type: string, purpose: string, status: string, amount: string | null = null) =>
      m.run("INSERT INTO corp_action (security_id, ex_date, type, raw_purpose, amount, status) VALUES (?, ?, ?, ?, ?, ?)", [sid, ex, type, purpose, amount, status]);
    await ca(1, "2025-11-14", "other", "BUY BACK", "parsed");
    await ca(1, "2026-10-27", "dividend", "INT DIV RS 23 PER SH", "parsed", "23");
    await ca(2, "2024-01-25", "other", "Buyback", "parsed");
    await ca(2, "2026-02-10", "other", "BUY BACK OF SHARES", "review");
    await ca(2, "2026-03-01", "other", "BUYBACK", "rejected");                 // owner rejected: not counted
    await ca(3, "2026-06-01", "dividend", "DIV RS 5/BUY BACK", "parsed", "5"); // combined purpose: type dividend, still a buyback
    await ca(4, "2026-06-01", "other", "BUYBACK", "parsed");                   // not in the batch
    const of = await buybackContext(m, [1, 2, 3]);
    expect(of(1)).toEqual([{ exDate: "2025-11-14", purpose: "BUY BACK" }]);
    expect(of(2).map((x) => x.exDate).sort()).toEqual(["2024-01-25", "2026-02-10"]);
    expect(of(3)).toEqual([{ exDate: "2026-06-01", purpose: "DIV RS 5/BUY BACK" }]);
    expect(of(4)).toEqual([]);
    const v = (sid: number) => Object.fromEntries(buybackFeatures("2026-11-05", of(sid)).map((x) => [x.field, x.value]));
    expect(v(1)).toEqual({ buyback_12m: "1", last_buyback_date: "2025-11-14" });
    expect(v(2)).toEqual({ buyback_12m: "1", last_buyback_date: "2026-02-10" });
    expect(v(5)).toEqual({ buyback_12m: "0", last_buyback_date: null });
    expect((await buybackContext(m, []))(1)).toEqual([]);
  });
});
