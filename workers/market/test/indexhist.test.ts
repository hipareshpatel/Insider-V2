// D156: 10-year index history from stored NSE daily index files (real 4 Jan 2016 file).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import { WEEKEND_MARKER, loadIndexHistory, loadIndexWeekends } from "../src/indexhist.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations", "market");
const FILE = readFileSync(join(import.meta.dirname, "..", "..", "..", "packages", "core", "test", "fixtures", "nse", "ind_close_all_04012016.csv"), "utf8");
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
const bucket = (objs: Record<string, string>) => ({
  async get(k: string) { const t = objs[k]; return t === undefined ? null : { customMetadata: {}, text: async () => t }; },
  async head(k: string) { return objs[k] === undefined ? null : {}; },
}) as unknown as R2Bucket;

describe("index history (D156)", () => {
  it("waits while the prefetch hasn't finished; loads the 4 Jan 2016 file (57 indices with P/E, P/B, yield)", async () => {
    const m = sqlite();
    const r1 = await loadIndexHistory(m, bucket({}), 60_000);
    expect(r1).toEqual({ days: 0, rows: 0 }); // 1 Jan 2016 has no file and the prefetch isn't done → wait
    const r2 = await loadIndexHistory(m, bucket({ "cache/content/indices/ind_close_all_04012016.csv": FILE }), 60_000);
    expect(r2.rows).toBe(0); // still waiting at 1 Jan (no file, last file of the range absent)
    const done = { "cache/content/indices/ind_close_all_04012016.csv": FILE, "cache/content/indices/ind_close_all_29122023.csv": "x" };
    const r3 = await loadIndexHistory(m, bucket(done), 2_000);
    expect(r3.rows).toBe(57); // 1 Jan recorded as no file (holiday), 4 Jan loaded, later days recorded as missing
    expect(await m.all("SELECT close, pe, pb, div_yield FROM index_daily WHERE index_name='Nifty 50' AND d=20160104")).toEqual([{ close: "7791.3", pe: "21.07", pb: "3.13", div_yield: "1.48" }]);
    expect(await m.all("SELECT rows, note FROM ms_day WHERE source='index_hist' AND d=20160101")).toEqual([{ rows: -1, note: "no file (holiday?)" }]);
    const bad = await m.all<{ rows: number; note: string }>("SELECT rows, note FROM ms_day WHERE source='index_hist' AND d=20231229");
    if (bad.length) expect(bad[0]).toMatchObject({ rows: -2, note: expect.stringContaining("unreadable") }); // a broken file is recorded, never blocks
  });
  it("loads many days per batch, in order, and stops at the first day still waiting for the prefetch (owner #325)", async () => {
    const m = sqlite();
    const day = (dd: string) => FILE.replaceAll("04-01-2016", `${dd}-01-2016`);
    const objs: Record<string, string> = {};
    for (const dd of ["04", "05", "06", "08"]) objs[`cache/content/indices/ind_close_all_${dd}012016.csv`] = day(dd); // 7 Jan not yet stored
    const r = await loadIndexHistory(m, bucket(objs), 60_000);
    expect(r).toEqual({ days: 0, rows: 0 }); // 1 Jan missing, prefetch not done → nothing recorded out of order
    objs["cache/content/indices/ind_close_all_01012016.csv"] = day("01");
    const r2 = await loadIndexHistory(m, bucket(objs), 60_000);
    expect(r2.days).toBe(4); // 1, 4, 5, 6 Jan; stops before 7 Jan (missing, prefetch not done) even though 8 Jan exists
    expect(await m.all("SELECT d, count(*) AS n FROM index_daily GROUP BY d ORDER BY d")).toEqual([20160101, 20160104, 20160105, 20160106].map((d) => ({ d, n: 57 })));
    objs["cache/content/indices/ind_close_all_29122023.csv"] = "x"; // prefetch finished → later missing weekdays are holidays
    const r3 = await loadIndexHistory(m, bucket(objs), 60_000);
    expect(r3.rows).toBe(57); // 8 Jan
    expect(await m.all("SELECT rows FROM ms_day WHERE source='index_hist' AND d=20160107")).toEqual([{ rows: -1 }]);
    expect((await m.all<{ n: number }>("SELECT count(*) AS n FROM ms_day WHERE source='index_hist'"))[0]?.n).toBe(2086);
    const again = await loadIndexHistory(m, bucket(objs), 60_000);
    expect(again).toEqual({ days: 0, rows: 0 }); // finished: returns at once
  });
  it("weekend special sessions (C52): loaded once the weekend download is complete; empty weekends not recorded", async () => {
    const m = sqlite();
    // Sat 1 Feb 2020 (Budget day) — fixture re-dated
    const objs: Record<string, string> = { "cache/content/indices/ind_close_all_01022020.csv": FILE.replaceAll("04-01-2016", "01-02-2020") };
    expect(await loadIndexWeekends(m, bucket(objs), 60_000)).toBeNull(); // download not complete → wait
    objs[WEEKEND_MARKER] = "{}";
    expect(await loadIndexWeekends(m, bucket(objs), 60_000)).toEqual({ days: 1, rows: 57 });
    expect(await m.all("SELECT d, rows, note FROM ms_day WHERE source='index_hist' ORDER BY d")).toEqual([{ d: 20200201, rows: 57, note: "weekend session" }]);
    expect(await m.all("SELECT count(*) AS n FROM index_daily WHERE d=20200201")).toEqual([{ n: 57 }]);
    expect(await m.all("SELECT rows, note FROM ms_day WHERE source='index_hist_weekends'")).toEqual([{ rows: 1, note: "836 weekend days checked" }]);
    expect(await loadIndexWeekends(m, bucket(objs), 60_000)).toBeNull(); // once
  });
});
