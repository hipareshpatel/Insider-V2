// Work list 2.10 (item 7): credit ratings of the 250 vs NSE's own lists, by month. Read-only. NSE's dated all-company
// feeds are stored as monthly lists (api/credit_rating/all/YYYY-MM.json, the D149 history) plus the daily 3-day lists
// since; each is re-read with the loader's own parser and key, kept for the focus companies from the floor, and every
// distinct rating is looked up in credit_rating by its key (primary key). Stored ratings of the 250 that no list has
// are counted as extra.
import { type Sql, parseCreditRatings } from "@disclo/core";

export const SQL_CR_LISTS = `SELECT job_id, r2_key FROM fetch_job WHERE kind = 'credit_rating' AND status = 'done'
  AND (r2_key >= ?1 OR r2_key LIKE 'api/credit_rating/daily/%') ORDER BY job_id`;
export const SQL_CR_KEYS = "SELECT key FROM credit_rating WHERE key IN (SELECT value FROM json_each(?1))";
export const SQL_CR_STORED = "SELECT key, substr(disclosed_at, 1, 7) AS month FROM credit_rating WHERE symbol IN (SELECT value FROM json_each(?1)) AND disclosed_at >= ?2";

export async function ratingCoverage(db: Sql, getText: (k: string) => Promise<string | null>, focus: string[], floor: string) {
  const lists = await db.all<{ job_id: number; r2_key: string }>(SQL_CR_LISTS, [`api/credit_rating/all/${floor.slice(0, 7)}`]);
  const fs = new Set(focus), want = new Map<string, { month: string; symbol: string; agency: string; rating: string; action: string; disclosedAt: string | null }>();
  let unreadable = 0, notStored = 0, parsedRows = 0, focusRows = 0;
  let sample: unknown = null;
  for (const l of lists) {
    const t = await getText(l.r2_key).catch(() => null);
    if (!t) { notStored++; continue; }
    let rows; try { rows = parseCreditRatings(t); } catch { unreadable++; continue; }
    parsedRows += rows.length;
    if (!sample) { try { const d = JSON.parse(t) as unknown; const a = (Array.isArray(d) ? d : ((d as { data?: unknown[] }).data ?? [])) as Record<string, unknown>[];
      sample = { raw_keys: Object.keys(a[0] ?? {}), raw_first: a[0] ?? null, raw_with_symbol: a.filter((x) => Object.values(x).some((v) => fs.has(String(v)))).slice(0, 2) }; } catch { /* counted below */ } }
    for (const r of rows) {
      if (fs.has(r.symbol)) focusRows++;
      const when = r.disclosedAt ?? r.ratedOn;
      if (!fs.has(r.symbol) || !when || when < floor) continue;
      want.set(r.key, { month: when.slice(0, 7), symbol: r.symbol, agency: r.agency, rating: r.rating, action: r.action, disclosedAt: r.disclosedAt });
    }
  }
  const keys = [...want.keys()], have = new Set<string>();
  for (let i = 0; i < keys.length; i += 400) for (const r of await db.all<{ key: string }>(SQL_CR_KEYS, [JSON.stringify(keys.slice(i, i + 400))])) have.add(r.key);
  const stored = await db.all<{ key: string; month: string }>(SQL_CR_STORED, [JSON.stringify(focus), floor]);
  const months = new Map<string, { listed: number; loaded: number; extra: number }>();
  const m = (k: string) => months.get(k) ?? months.set(k, { listed: 0, loaded: 0, extra: 0 }).get(k)!;
  const missing: { month: string; symbol: string; agency: string; rating: string; action: string; disclosed_at: string | null }[] = [];
  for (const [k, v] of want) { const x = m(v.month); x.listed++; if (have.has(k)) x.loaded++; else missing.push({ month: v.month, symbol: v.symbol, agency: v.agency, rating: v.rating, action: v.action, disclosed_at: v.disclosedAt }); }
  for (const s of stored) if (!want.has(s.key)) m(s.month).extra++;
  const byMonth = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
  const tot = byMonth.reduce((a, x) => ({ listed: a.listed + x.listed, loaded: a.loaded + x.loaded, extra: a.extra + x.extra }), { listed: 0, loaded: 0, extra: 0 });
  const [tbl] = await db.all<{ n: number; focus_rows: number }>("SELECT count(*) AS n, sum(symbol IN (SELECT value FROM json_each(?1))) AS focus_rows FROM credit_rating", [JSON.stringify(focus)]);
  return { focus: focus.length, parsed_rows: parsedRows, focus_rows_any_date: focusRows, sample, table: tbl, lists: lists.length, lists_not_stored: notStored, lists_unreadable: unreadable, totals: tot, months: byMonth.filter((x) => x.listed !== x.loaded || x.extra), all_months: byMonth.length, missing: missing.slice(0, 40) };
}
