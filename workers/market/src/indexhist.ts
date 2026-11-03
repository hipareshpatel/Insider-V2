// D156: 10-year index history (2016 → 2023; 2024 onward comes with the daily market job). Reads NSE's daily index file
// already stored in R2 by the GitHub prefetch (set "indices"), never NSE. One row per index per day: OHLC, P/E, P/B,
// dividend yield as published. Progress per date in ms_day (source 'index_hist'); a weekday with no file is recorded
// (rows = -1, usually an exchange holiday) and not retried.
import { type Sql, batchAll, dnum, insertRows, parseIndexClose } from "@disclo/core";
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

export async function loadIndexHistory(m: Sql, raw: R2Bucket, budgetMs: number): Promise<{ days: number; rows: number }> {
  const t0 = Date.now();
  const [last] = await m.all<{ d: number | null }>("SELECT max(d) AS d FROM ms_day WHERE source='index_hist'");
  const after = last?.d ? `${String(last.d).slice(0, 4)}-${String(last.d).slice(4, 6)}-${String(last.d).slice(6, 8)}` : "";
  let days = 0, rows = 0;
  for (const iso of weekdays(INDEX_HISTORY_FROM, INDEX_HISTORY_TO)) {
    if (iso <= after) continue;
    if (Date.now() - t0 > budgetMs) break;
    const key = `cache/content/indices/ind_close_all_${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}.csv`;
    const text = await r2Text(raw, key);
    if (text === null) {
      // Not downloaded yet → wait (the prefetch runs ahead). Once the prefetch has finished (its last trading day,
      // 29 Dec 2023, is stored), a weekday without a file is an exchange holiday: recorded once, never retried.
      if (!(await raw.head(LAST_FILE).catch(() => null))) break;
      await m.run("INSERT OR REPLACE INTO ms_day (source, d, rows, note) VALUES ('index_hist', ?, -1, 'no file (holiday?)')", [dnum(iso)]);
      days++; continue;
    }
    let rs: ReturnType<typeof parseIndexClose>;
    try { rs = parseIndexClose(text).filter((r) => r.tradeDate === iso); } catch (e) {
      // unreadable file: recorded (visible on /status market_structure) instead of stopping every later day
      await m.run("INSERT OR REPLACE INTO ms_day (source, d, rows, note) VALUES ('index_hist', ?, -2, ?)", [dnum(iso), `unreadable: ${String(e).slice(0, 80)}`]);
      days++; continue;
    }
    await batchAll(m, insertRows("INSERT OR IGNORE INTO index_daily (index_name,d,open,high,low,close,pe,pb,div_yield)", 9,
      rs.map((r) => [r.indexName, dnum(iso), r.open, r.high, r.low, r.close, r.pe, r.pb, r.divYield])));
    await m.run("INSERT OR REPLACE INTO ms_day (source, d, rows, note) VALUES ('index_hist', ?, ?, NULL)", [dnum(iso), rs.length]);
    days++; rows += rs.length;
  }
  return { days, rows };
}
