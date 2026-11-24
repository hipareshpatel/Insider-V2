// Work list 2.10 (item 7): credit ratings of the 250 vs NSE's own lists, by month. Read-only. NSE's dated all-company
// feeds are stored as monthly lists (api/credit_rating/all/YYYY-MM.json, the D149 history) plus the daily 3-day lists
// since; each is re-read with the loader's own parser and key, kept for the focus companies from the floor, and every
// distinct rating is looked up in credit_rating by its key (primary key). Stored ratings of the 250 that no list has
// are counted as extra.
import { type FocusIssuers, type RatingVia, type Sql, issuerOf, nameKey, parseCreditRatings, ratingLink, ratingLinkVia } from "@disclo/core";
import { SQL_LINK_OF_SID, SQL_SYMBOLS_OF_SID } from "./eventfeatures.js";

export const SQL_CR_LISTS = `SELECT job_id, r2_key FROM fetch_job WHERE kind = 'credit_rating' AND status = 'done'
  AND (r2_key >= ?1 OR r2_key LIKE 'api/credit_rating/daily/%') ORDER BY job_id`;
export const SQL_CR_KEYS = "SELECT key FROM credit_rating WHERE key IN (SELECT value FROM json_each(?1))";
export const SQL_CR_STORED = "SELECT key, substr(disclosed_at, 1, 7) AS month FROM credit_rating WHERE symbol IN (SELECT value FROM json_each(?1)) AND disclosed_at >= ?2";

export async function ratingCoverage(db: Sql, getText: (k: string) => Promise<string | null>, focus: string[], floor: string, issuers?: FocusIssuers) {
  const lists = await db.all<{ job_id: number; r2_key: string }>(SQL_CR_LISTS, [`api/credit_rating/all/${floor.slice(0, 7)}`]);
  const perList: { list: string; rows: number; focus: number; first: string | null; last: string | null; isin_blank: number; unmatched: unknown[] }[] = [];
  const fs = new Set(focus), want = new Map<string, { month: string; symbol: string; agency: string; rating: string; action: string; disclosedAt: string | null; via: string | null }>();
  const ambiguous = new Map<string, number>(); // G11: a name of more than one focus company links nothing
  let unreadable = 0, notStored = 0, parsedRows = 0, focusRows = 0;
  let sample: unknown = null;
  for (const l of lists) {
    const t = await getText(l.r2_key).catch(() => null);
    if (!t) { notStored++; continue; }
    let rows; try { rows = parseCreditRatings(t).map((c) => { const k = ratingLink(c, issuers); return { ...c, symbol: k.symbol, via: k.via, why: k.reason }; }); } catch { unreadable++; continue; }
    parsedRows += rows.length;
    const ds = rows.map((r) => r.disclosedAt ?? "").filter(Boolean).sort();
    const um = rows.filter((r) => !fs.has(r.symbol));
    perList.push({ list: l.r2_key.replace("api/credit_rating/", ""), rows: rows.length, focus: rows.length - um.length, first: ds[0] ?? null, last: ds[ds.length - 1] ?? null,
      isin_blank: rows.filter((r) => !r.isin).length, unmatched: um.filter((r, i) => i % Math.max(1, Math.floor(um.length / 3)) === 0).slice(0, 3).map((r) => ({ c: r.company.slice(0, 40), i: r.isin, s: r.symbol })) });
    sample ??= rows.find((r) => fs.has(r.symbol)) ?? null;
    for (const r of rows) {
      if (fs.has(r.symbol)) focusRows++;
      const when = r.disclosedAt ?? r.ratedOn;
      if (r.why?.startsWith("ambiguous") && when && when >= floor) ambiguous.set(r.why, (ambiguous.get(r.why) ?? 0) + 1);
      if (!fs.has(r.symbol) || !when || when < floor) continue;
      want.set(r.key, { month: when.slice(0, 7), symbol: r.symbol, agency: r.agency, rating: r.rating, action: r.action, disclosedAt: r.disclosedAt, via: r.via });
    }
  }
  const keys = [...want.keys()], have = new Set<string>();
  for (let i = 0; i < keys.length; i += 400) for (const r of await db.all<{ key: string }>(SQL_CR_KEYS, [JSON.stringify(keys.slice(i, i + 400))])) have.add(r.key);
  const stored = await db.all<{ key: string; month: string }>(SQL_CR_STORED, [JSON.stringify(focus), floor]);
  const months = new Map<string, { listed: number; loaded: number; extra: number }>();
  const m = (k: string) => months.get(k) ?? months.set(k, { listed: 0, loaded: 0, extra: 0 }).get(k)!;
  const missing: { month: string; symbol: string; agency: string; rating: string; action: string; disclosed_at: string | null; linked_by: string | null }[] = [];
  const byVia: Record<string, { listed: number; loaded: number }> = {}; // how each listed rating of the 250 is linked (G11)
  for (const [k, v] of want) {
    const x = m(v.month), b = (byVia[v.via ?? "none"] ??= { listed: 0, loaded: 0 }); x.listed++; b.listed++;
    if (have.has(k)) { x.loaded++; b.loaded++; } else missing.push({ month: v.month, symbol: v.symbol, agency: v.agency, rating: v.rating, action: v.action, disclosed_at: v.disclosedAt, linked_by: v.via });
  }
  for (const s of stored) if (!want.has(s.key)) m(s.month).extra++;
  const byMonth = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));
  const tot = byMonth.reduce((a, x) => ({ listed: a.listed + x.listed, loaded: a.loaded + x.loaded, extra: a.extra + x.extra }), { listed: 0, loaded: 0, extra: 0 });
  const [tbl] = await db.all<{ n: number; focus_rows: number }>("SELECT count(*) AS n, sum(symbol IN (SELECT value FROM json_each(?1))) AS focus_rows FROM credit_rating", [JSON.stringify(focus)]);
  return { focus: focus.length, parsed_rows: parsedRows, focus_rows_any_date: focusRows, sample, table: tbl, lists: lists.length, lists_not_stored: notStored, lists_unreadable: unreadable, totals: tot, linked_by: byVia,
    ambiguous_names: [...ambiguous].map(([reason, ratings]) => ({ reason, ratings })), months: byMonth.filter((x) => x.listed !== x.loaded || x.extra), all_months: byMonth.length, by_month: byMonth.map((x) => `${x.month}:${x.listed}`).join(" "), per_list: perList, missing: missing.slice(0, 40) };
}

// G11 check (read-only): /ratings-coverage?symbols=SBIN,HINDZINC,TVSMOTOR — per named company, the stored ratings linked
// to it, how each was linked (ratingLinkVia against the company's own ISINs and listed name), the latest three, and from
// NSE's stored lists (the ones the totals read) the rows linked to it, those not stored, and the rows whose reduced name
// equals its listed name's but that link elsewhere or nowhere (a name-normalisation or ambiguity miss). Index-backed
// only: symbols → security (ix_sid_lookup), each security's symbols, name and ISINs (ix_sid_security, primary key), its
// stored ratings by symbol (ix_credit_rating_symbol), the list jobs by kind (ix_fetch_kind_job); the lists are in R2.
export const RATING_SYMBOLS_MAX = 20;
export const SQL_SIDS_OF_SYMBOLS = "SELECT DISTINCT security_id, value FROM security_identifier WHERE id_type = 'nse_symbol' AND value IN (SELECT value FROM json_each(?1)) ORDER BY security_id";
export const SQL_CR_OF_SYMBOLS = "SELECT symbol, key, agency, rating, rated_on, isin, company, disclosed_at FROM credit_rating WHERE symbol IN (SELECT value FROM json_each(?1))";

/** "SBIN, hindzinc,TVSMOTOR" → ["SBIN","HINDZINC","TVSMOTOR"]; an error text for none, more than 20 or a malformed one. */
export function parseSymbolsParam(v: string): string[] | string {
  const s = [...new Set(v.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean))];
  if (!s.length) return "symbols: give one or more NSE symbols, comma-separated";
  if (s.length > RATING_SYMBOLS_MAX) return `symbols: at most ${RATING_SYMBOLS_MAX} (got ${s.length})`;
  const bad = s.filter((x) => !/^[A-Z0-9&_-]{1,20}$/.test(x));
  return bad.length ? `symbols: not an NSE symbol: ${bad.slice(0, 5).join(", ")}` : s;
}

const isoD = (d: number | null) => (d ? `${String(d).slice(0, 4)}-${String(d).slice(4, 6)}-${String(d).slice(6, 8)}` : null);
type ListedRow = { key: string; symbol: string; via: RatingVia | null; reason: string | null; company: string; isin: string | null; agency: string; rating: string; when: string | null };

export async function ratingsOfSymbols(filings: Sql, market: Sql, getText: (k: string) => Promise<string | null>, symbols: string[], floor: string, issuers: FocusIssuers, opts: { lists?: boolean } = {}) {
  const sidOf = new Map((await market.all<{ security_id: number; value: string }>(SQL_SIDS_OF_SYMBOLS, [JSON.stringify(symbols)])).map((r) => [r.value, r.security_id]));
  type Co = { sid: number; symbols: string[]; name: string | null; isins: string[]; nk: string };
  const bySid = new Map<number, Co>();
  for (const sid of new Set(sidOf.values())) {
    const syms = (await market.all<{ value: string }>(SQL_SYMBOLS_OF_SID, [sid])).map((r) => r.value);
    const ids = await market.all<{ name: string | null; isin: string | null }>(SQL_LINK_OF_SID, [sid]);
    bySid.set(sid, { sid, symbols: syms, name: ids[0]?.name ?? null, isins: ids.map((r) => r.isin).filter((x): x is string => !!x), nk: nameKey(ids[0]?.name) });
  }
  // NSE's stored lists (unless lists=0): every distinct row, linked by the loader's own rule
  const listed = new Map<string, ListedRow>();
  let listsRead = 0, listsNotStored = 0, listsUnreadable = 0;
  if (opts.lists !== false && bySid.size) {
    for (const l of await filings.all<{ job_id: number; r2_key: string }>(SQL_CR_LISTS, [`api/credit_rating/all/${floor.slice(0, 7)}`])) {
      const t = await getText(l.r2_key).catch(() => null);
      if (!t) { listsNotStored++; continue; }
      let rows; try { rows = parseCreditRatings(t); } catch { listsUnreadable++; continue; }
      listsRead++;
      for (const c of rows) {
        if (listed.has(c.key)) continue;
        const k = ratingLink(c, issuers);
        listed.set(c.key, { key: c.key, symbol: k.symbol, via: k.via, reason: k.reason, company: c.company, isin: c.isin || null, agency: c.agency, rating: c.rating, when: c.disclosedAt ?? c.ratedOn });
      }
    }
  }
  const companies: unknown[] = [];
  for (const sym of symbols) {
    const sid = sidOf.get(sym), co = sid === undefined ? undefined : bySid.get(sid);
    if (!co) { companies.push({ symbol: sym, error: "no security has this NSE symbol" }); continue; }
    const mine = new Set([...co.symbols, sym]);
    const stored = await filings.all<{ symbol: string; key: string; agency: string | null; rating: string | null; rated_on: number | null; isin: string | null; company: string | null; disclosed_at: string | null }>(SQL_CR_OF_SYMBOLS, [JSON.stringify([...mine])]);
    const via = (r: { isin: string | null; company: string | null }) => ratingLinkVia(r, { isins: co.isins, name: co.name });
    const byVia: Record<RatingVia, number> = { isin_issuer: 0, name: 0, nse_symbol: 0 }, bySymbol: Record<string, number> = {};
    for (const r of stored) { byVia[via(r)]++; bySymbol[r.symbol] = (bySymbol[r.symbol] ?? 0) + 1; }
    const latest = [...stored].sort((a, b) => (b.disclosed_at ?? "").localeCompare(a.disclosed_at ?? "") || (b.rated_on ?? 0) - (a.rated_on ?? 0)).slice(0, 3)
      .map((r) => ({ disclosed_at: r.disclosed_at, rated_on: isoD(r.rated_on), agency: r.agency, rating: r.rating, isin: r.isin, company: r.company, via: via(r) }));
    let lists: unknown = null;
    if (listsRead) {
      const storedKeys = new Set(stored.map((r) => r.key)), all = [...listed.values()];
      const linked = all.filter((x) => mine.has(x.symbol)), lv: Record<string, number> = {};
      for (const x of linked) lv[x.via ?? "none"] = (lv[x.via ?? "none"] ?? 0) + 1;
      const notStored = linked.filter((x) => !storedKeys.has(x.key) && x.when && x.when >= floor);
      const sameName = co.nk.length >= 4 ? all.filter((x) => !mine.has(x.symbol) && nameKey(x.company) === co.nk) : [];
      lists = { rows_linked: linked.length, linked_by: lv, not_stored_from_floor: notStored.length,
        not_stored_sample: notStored.slice(0, 3).map((x) => ({ when: x.when, agency: x.agency, rating: x.rating, isin: x.isin, company: x.company })),
        unmatched_same_name: sameName.length, unmatched_sample: sameName.slice(0, 5).map((x) => ({ when: x.when, company: x.company, isin: x.isin, linked_to: x.symbol || null, reason: x.reason })) };
    }
    companies.push({ symbol: sym, security_id: co.sid, symbols: [...mine], focus: issuers.symbols.has(sym), listed_name: co.name, name_key: co.nk, isins: co.isins,
      issuer_codes: [...new Set(co.isins.map(issuerOf).filter(Boolean))], stored: { rows: stored.length, by_symbol: bySymbol, linked_by: byVia, latest }, lists });
  }
  return { floor, lists_read: listsRead, lists_not_stored: listsNotStored, lists_unreadable: listsUnreadable, list_rows: listed.size, companies };
}
