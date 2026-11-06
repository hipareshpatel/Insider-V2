// G5: the step-level sector inputs for ret_vs_sector_3m, read from the stored tables (migrations schema).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { type Sql, type Stmt, priceFeatures } from "@disclo/core";
import { sectorContext } from "../src/technicals.js";

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

describe("sectorContext (G5)", () => {
  it("reads closes once (both spellings, one per day), the latest sector, memberships; the map gives the hand-checked value", async () => {
    const m = sqlite();
    for (const id of [1, 2, 3]) await m.run("INSERT INTO security (security_id, name) VALUES (?, ?)", [id, `S${id}`]);
    const idx = (name: string, d: number, close: string) => m.run("INSERT INTO index_daily (index_name, d, close) VALUES (?, ?, ?)", [name, d, close]);
    await idx("Nifty IT", 20260803, "40000"); await idx("NIFTY IT", 20260803, "40000"); // both spellings on a day: one close
    await idx("Nifty IT", 20261105, "42000");
    await idx("Nifty IT", 20260301, "1");                                              // outside the window: not read
    await idx("Nifty Bank", 20260803, "50000"); await idx("Nifty Bank", 20261105, "47500");
    await idx("Nifty 50", 20261105, "25000");                                          // not a sectoral index
    const cls = (sid: number, asOf: string, sector: string | null) => m.run("INSERT INTO classification (security_id, as_of, sector, sector_source, source_ref) VALUES (?, ?, ?, 'index_csv', 't')", [sid, asOf, sector]);
    await cls(1, "2026-10-01", "Financial Services"); await cls(1, "2026-11-02", "Information Technology"); // latest wins
    await cls(2, "2026-11-02", "Financial Services");
    await m.run("INSERT INTO index_membership (index_name, security_id, valid_from) VALUES ('NIFTY BANK', 2, '2026-11-02')");
    await m.run("INSERT INTO index_membership (index_name, security_id, valid_from, valid_to) VALUES ('NIFTY IT', 2, '2026-01-01', '2026-06-01')"); // ended
    const of = await sectorContext(m, "2026-11-05", [1, 2, 3]);
    const a = of(1), b = of(2), c = of(3);
    expect(a.sector).toBe("Information Technology");
    expect(a.closes.get("NIFTY IT")).toEqual([{ date: "2026-08-03", close: 40000 }, { date: "2026-11-05", close: 42000 }]);
    expect(a.closes.has("NIFTY 50")).toBe(false);
    expect(b.members).toEqual(["NIFTY BANK"]);
    expect(c.sector).toBeUndefined();
    const st = [["2026-08-03", 100], ["2026-11-05", 115]].map(([date, close]) => ({ date: date as string, close: close as number, volume: 1, turnoverRs: 1 }));
    const v = (x: ReturnType<typeof of>) => priceFeatures(st, [], undefined, x).rows.find((f) => f.field === "ret_vs_sector_3m")!;
    expect(v(a).value).toBe("10.00");   // 15 % − Nifty IT 5 %
    expect(v(b).value).toBe("20.00");   // 15 % − Nifty Bank (−5 %), constituent over the Financial Services map
    expect(v(c).reason).toMatch(/^no sector stored/);
  });
});
