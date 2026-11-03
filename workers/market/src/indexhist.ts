// D156: 10-year index history (2016 → 2023; 2024 onward comes with the daily market job). Reads NSE's daily index file
// already stored in R2 by the GitHub prefetch (set "indices"), never NSE. One row per index per day: OHLC, P/E, P/B,
// dividend yield as published. Progress per date in ms_day (source 'index_hist'); a weekday with no file is recorded
// (rows = -1, usually an exchange holiday) and not retried.
import { type Sql, type Stmt, batchAll, dnum, insertRows, parseIndexClose } from "@disclo/core";
import { r2Text } from "./structure.js";

export const INDEX_HISTORY_FROM = "2016-01-01", INDEX_HISTORY_TO = "2023-12-31";
const LAST_FILE = "cache/content/indices/ind_close_all_29122023.csv"; // last trading day of the range

function weekdays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86400_000) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// Speed (owner #325): files are read CHUNK at a time in parallel and each chunk is written in one D1 batch (rows first,
// progress rows last, so a cut-off batch is simply redone: INSERT OR IGNORE). One day per step with three round trips
// each was ~1 day/second at best and only got the time left over at the end of the market run.
const CHUNK = 25;
const DAY_SQL = "INSERT OR IGNORE INTO index_daily (index_name,d,open,high,low,close,pe,pb,div_yield) SELECT json_extract(value,'$[0]'), ?, json_extract(value,'$[1]'), json_extract(value,'$[2]'), json_extract(value,'$[3]'), json_extract(value,'$[4]'), json_extract(value,'$[5]'), json_extract(value,'$[6]'), json_extract(value,'$[7]') FROM json_each(?)";
type Day = { iso: string; text: string | null };

export async function loadIndexHistory(m: Sql, raw: R2Bucket, budgetMs: number): Promise<{ days: number; rows: number }> {
  const t0 = Date.now();
  const [last] = await m.all<{ d: number | null }>("SELECT max(d) AS d FROM ms_day WHERE source='index_hist'");
  const after = last?.d ? `${String(last.d).slice(0, 4)}-${String(last.d).slice(4, 6)}-${String(last.d).slice(6, 8)}` : "";
  const todo = weekdays(INDEX_HISTORY_FROM, INDEX_HISTORY_TO).filter((iso) => iso > after);
  if (!todo.length) return { days: 0, rows: 0 };
  // Not downloaded yet → wait (the prefetch runs ahead). Once the prefetch has finished (its last trading day,
  // 29 Dec 2023, is stored), a weekday without a file is an exchange holiday: recorded once, never retried.
  const prefetchDone = !!(await raw.head(LAST_FILE).catch(() => null));
  let days = 0, rows = 0;
  for (let i = 0; i < todo.length; i += CHUNK) {
    if (Date.now() - t0 > budgetMs) break;
    const got: Day[] = await Promise.all(todo.slice(i, i + CHUNK).map(async (iso) => ({
      iso, text: await r2Text(raw, `cache/content/indices/ind_close_all_${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}.csv`),
    })));
    const data: Stmt[] = [], progress: unknown[][] = [];
    let stop = false;
    for (const { iso, text } of got) {
      if (text === null) {
        if (!prefetchDone) { stop = true; break; } // keep order: never record a day after one still waiting
        progress.push([dnum(iso), -1, "no file (holiday?)"]); continue;
      }
      let rs: ReturnType<typeof parseIndexClose>;
      try { rs = parseIndexClose(text).filter((r) => r.tradeDate === iso); } catch (e) {
        // unreadable file: recorded (visible on /status market_structure) instead of stopping every later day
        progress.push([dnum(iso), -2, `unreadable: ${String(e).slice(0, 80)}`]); continue;
      }
      // one statement per day (the day's rows as one JSON value): ~110 rows would be 10 statements, and D1 counts
      // every statement against the per-run query limit
      if (rs.length) data.push({ sql: DAY_SQL, params: [dnum(iso), JSON.stringify(rs.map((r) => [r.indexName, r.open, r.high, r.low, r.close, r.pe, r.pb, r.divYield]))] });
      progress.push([dnum(iso), rs.length, null]);
      rows += rs.length;
    }
    if (progress.length) {
      await batchAll(m, [
        ...data,
        ...insertRows("INSERT OR REPLACE INTO ms_day (source, d, rows, note)", 4, progress.map(([d, n, note]) => ["index_hist", d, n, note])),
      ], 500);
      days += progress.length;
    }
    if (stop) break;
  }
  return { days, rows };
}
