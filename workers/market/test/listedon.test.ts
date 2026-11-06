// log #402: security.listed_on from NSE's EQUITY_L (stored in R2), changed rows only.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import { EQUITY_L_KEY, fillListedOn, listedOnPass } from "../src/listedon.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations", "market");

function sqlite(): { m: Sql; writes: string[] } {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIG).sort()) db.exec(readFileSync(join(MIG, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  const writes: string[] = [];
  return {
    writes,
    m: {
      async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...norm(params)) as T[]; },
      async run(sql: string, params: unknown[] = []) { writes.push(sql); return { changes: Number(db.prepare(sql).run(...norm(params)).changes) }; },
      async batch(stmts: Stmt[]) {
        db.exec("BEGIN");
        try { let n = 0; for (const s of stmts) { writes.push(s.sql); n += Number(db.prepare(s.sql).run(...norm(s.params)).changes); } db.exec("COMMIT"); return n; }
        catch (e) { db.exec("ROLLBACK"); throw e; }
      },
    },
  };
}

// As NSE ships it (header spaces, CRLF). TATAMOTORS: a listing date with a leading-zero day.
const EQUITY_L = [
  "SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE",
  "INFY,Infosys Limited,EQ,08-FEB-1995,5,1,INE009A01021,5",
  "TATAMOTORS,Tata Motors Limited,EQ,09-JUN-1995,2,1,INE155A01022,2",
  "SBILIFE,SBI Life Insurance Company Limited,EQ,03-OCT-2017,10,1,INE123W01016,10",
  "ICICIGI,ICICI Lombard General Insurance Company Limited,EQ,27-SEP-2017,10,1,INE765G01017,10",
  "NEWSYM,Renamed Company Limited,EQ,15-MAR-2010,10,1,INE999Z01011,10",
  "NOTOURS,Not Stored Limited,EQ,01-JAN-2020,10,1,INE888Y01012,10",
  "",
].join("\r\n");

async function seed(m: Sql) {
  const secs: [number, string, string | null, string | null, string | null][] = [
    // id, name, listed_on, isin, current symbol
    [1, "Infosys", null, "INE009A01021", "INFY"],
    [2, "Tata Motors", "1995-06-09", "INE155A01022", "TATAMOTORS"], // already right: never written
    [3, "SBI Life", "2024-01-01", "INE123W01016", "SBILIFE"],      // wrong (the old floor fallback): corrected
    [4, "ICICI Lombard", null, null, "ICICIGI"],                    // no ISIN stored: matched by symbol
    [5, "Renamed Co", null, "INE999Z01011", "OLDSYM"],             // symbol changed since: matched by ISIN
    [6, "Delisted Co", "2001-05-05", "INE777X01019", "GONE"],      // not in EQUITY_L: left as it is
  ];
  for (const [id, name, on, isin, sym] of secs) {
    await m.run("INSERT INTO security (security_id, name, listed_on) VALUES (?, ?, ?)", [id, name, on]);
    if (isin) await m.run("INSERT INTO security_identifier (security_id, id_type, value, valid_from, source) VALUES (?, 'isin', ?, '2024-01-01', 'test')", [id, isin]);
    if (sym) await m.run("INSERT INTO security_identifier (security_id, id_type, value, valid_from, source) VALUES (?, 'nse_symbol', ?, '2024-01-01', 'test')", [id, sym]);
  }
}
const dates = (m: Sql) => m.all<{ security_id: number; listed_on: string | null }>("SELECT security_id, listed_on FROM security ORDER BY security_id");

describe("fillListedOn", () => {
  it("fills NULL and wrong dates by ISIN, else current symbol; writes only changed rows", async () => {
    const { m, writes } = sqlite();
    await seed(m);
    writes.length = 0;
    const r = await fillListedOn(m, EQUITY_L);
    expect(r).toMatchObject({ rows: 6, dated: 6, matched: 5, by_isin: 4, by_symbol: 1, unmatched: 1, ambiguous: 0, unchanged: 1, changed: 4, filled: 3, corrected: 1, unmatched_sample: ["NOTOURS"], done: true });
    expect(await dates(m)).toEqual([
      { security_id: 1, listed_on: "1995-02-08" },
      { security_id: 2, listed_on: "1995-06-09" },
      { security_id: 3, listed_on: "2017-10-03" },
      { security_id: 4, listed_on: "2017-09-27" },
      { security_id: 5, listed_on: "2010-03-15" },
      { security_id: 6, listed_on: "2001-05-05" },
    ]);
    expect(writes.length).toBe(1); // one batched UPDATE for the 4 changed rows
  });

  it("is idempotent: a re-run writes nothing", async () => {
    const { m, writes } = sqlite();
    await seed(m);
    await fillListedOn(m, EQUITY_L);
    writes.length = 0;
    const r = await fillListedOn(m, EQUITY_L);
    expect(r).toMatchObject({ matched: 5, unchanged: 5, changed: 0 });
    expect(writes).toEqual([]);
  });

  it("the update statement itself is a no-op for a row already holding the date", async () => {
    const { m } = sqlite();
    await seed(m);
    const { SQL_SET_LISTED } = await import("../src/listedon.js");
    expect((await m.run(SQL_SET_LISTED, [JSON.stringify([[2, "1995-06-09"], [1, "1995-02-08"]])])).changes).toBe(1);
  });

  it("leaves a security named by two rows with different dates as it is (never guessed)", async () => {
    const { m } = sqlite();
    await seed(m);
    const twice = EQUITY_L.replace("NOTOURS,Not Stored Limited,EQ,01-JAN-2020,10,1,INE888Y01012", "INFY,Infosys Limited,BE,01-JAN-2020,5,1,INE009A01021");
    const r = await fillListedOn(m, twice);
    expect(r.ambiguous).toBe(1);
    expect((await dates(m))[0]).toEqual({ security_id: 1, listed_on: null });
  });

  it("listedOnPass reads the stored copy from R2, and waits when there is none", async () => {
    const { m } = sqlite();
    await seed(m);
    const bucket = (objs: Record<string, string>) => ({ async get(k: string) { const t = objs[k]; return t === undefined ? null : { customMetadata: {}, text: async () => t }; } }) as unknown as R2Bucket;
    expect(await listedOnPass(m, bucket({}))).toEqual({ file: EQUITY_L_KEY, missing: true, done: false });
    expect(await listedOnPass(m, bucket({ [EQUITY_L_KEY]: EQUITY_L }))).toMatchObject({ changed: 4, done: true });
  });
});
