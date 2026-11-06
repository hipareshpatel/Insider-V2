// Data-readiness map (D123 / D152, work list A4): coverage of each stored data area across the focus companies from
// the D168 floor. Read-only. One indexed probe per company and area (primary-key or index prefix), so a call reads a
// few thousand rows, plus one pass over the feature table.
import type { Sql } from "@disclo/core";
import { COVERAGE_FLOOR } from "./load.js";
import { SQL_SYMBOLS_OF_SID } from "./eventfeatures.js";

export const FIN_PROBES: Record<string, string> = {
  pl: "SELECT 1 AS ok FROM fin_value WHERE security_id = ?1 AND statement = 'pl' AND +period_end >= ?2 LIMIT 1",
  bs: "SELECT 1 AS ok FROM fin_value WHERE security_id = ?1 AND statement = 'bs' AND +period_end >= ?2 LIMIT 1",
  bs_detail: "SELECT 1 AS ok FROM fin_value WHERE security_id = ?1 AND statement = 'bs' AND line >= 'x:' AND line < 'x;' AND +period_end >= ?2 LIMIT 1",
  cf: "SELECT 1 AS ok FROM fin_value WHERE security_id = ?1 AND statement = 'cf' AND +period_end >= ?2 LIMIT 1",
  cf_detail: "SELECT 1 AS ok FROM fin_value WHERE security_id = ?1 AND statement = 'cf' AND line >= 'x:' AND line < 'x;' AND +period_end >= ?2 LIMIT 1",
  pl_fy: "SELECT 1 AS ok FROM fin_value WHERE security_id = ?1 AND statement = 'pl' AND line = 'pat' AND +period_kind = 'FY' AND +period_end >= ?2 LIMIT 1",
  shareholding: "SELECT 1 AS ok FROM shareholding WHERE security_id = ?1 AND as_of >= ?2 LIMIT 1",
  primary_basis: "SELECT 1 AS ok FROM primary_basis WHERE security_id = ?1 LIMIT 1",
};
export const SYM_PROBES: Record<string, string> = {
  insider_trades: "SELECT 1 AS ok FROM insider_trade WHERE symbol = ?1 AND from_d >= ?2 LIMIT 1",
  sast: "SELECT 1 AS ok FROM sast_disclosure WHERE symbol = ?1 AND disclosed_at >= ?3 LIMIT 1",
  board_meetings: "SELECT 1 AS ok FROM board_meeting WHERE symbol = ?1 AND meeting_d >= ?2 LIMIT 1",
  credit_ratings: "SELECT 1 AS ok FROM credit_rating WHERE symbol = ?1 AND disclosed_at >= ?3 LIMIT 1",
};
export const SQL_FEATURE_COVERAGE = `SELECT field, count(DISTINCT security_id) AS companies, count(DISTINCT CASE WHEN value IS NOT NULL THEN security_id END) AS with_value,
  sum(value IS NULL) AS unavailable FROM feature_value WHERE security_id IN (SELECT value FROM json_each(?1)) GROUP BY field ORDER BY field`;

/** D1 wants exactly as many bindings as the query's highest ?N. */
const bind = (q: string, all: unknown[]) => all.slice(0, Math.max(...[...q.matchAll(/\?(\d)/g)].map((m) => Number(m[1]))));
export async function readiness(db: Sql, companies: { sid: number; symbols: string[] }[], floor: string, withFeatures = true) {
  const fin: Record<string, number> = {}, sym: Record<string, number> = {}, missing: Record<string, string[]> = {};
  const day = Number(floor.replace(/-/g, ""));
  for (const c of companies) {
    for (const [k, q] of Object.entries(FIN_PROBES)) {
      const [r] = await db.all<{ ok: number }>(q, bind(q, [c.sid, floor]));
      if (r) fin[k] = (fin[k] ?? 0) + 1; else (missing[k] ??= []).length < 12 && missing[k]!.push(c.symbols[0]!);
    }
    for (const [k, q] of Object.entries(SYM_PROBES)) {
      let hit = false;
      for (const s of c.symbols) if ((await db.all<{ ok: number }>(q, bind(q, [s, day, floor]))).length) { hit = true; break; }
      if (hit) sym[k] = (sym[k] ?? 0) + 1; else (missing[k] ??= []).length < 12 && missing[k]!.push(c.symbols[0]!);
    }
  }
  const features = !withFeatures ? [] : await db.all<{ field: string; companies: number; with_value: number; unavailable: number }>(SQL_FEATURE_COVERAGE, [JSON.stringify(companies.map((c) => c.sid))]);
  return { companies: companies.length, floor, statements_and_filings: { ...fin, ...sym }, missing_sample: missing, features };
}

// Field-level readiness (owner #384): every computed field across the focus companies, from the four tables that hold
// them — feature_value (filings; per period and basis), ownership_feature and event_feature (filings; one current row
// per company), price_feature (market; one current row per company). Read-only, one call (≈ 200 k rows read).
export const SQL_FV_COVERAGE = `SELECT field, count(DISTINCT security_id) AS companies,
  count(DISTINCT CASE WHEN value IS NOT NULL THEN security_id END) AS with_value,
  count(DISTINCT CASE WHEN rn = 1 AND value IS NOT NULL THEN security_id END) AS latest_with_value
  FROM (SELECT security_id, field, value, row_number() OVER (PARTITION BY security_id, basis, field ORDER BY period_end DESC) AS rn
        FROM feature_value WHERE security_id IN (SELECT value FROM json_each(?1)) AND basis IN ('consolidated','standalone'))
  GROUP BY field ORDER BY field`;
export const SQL_FV_REASONS = `SELECT field, substr(reason, 1, 48) AS why, count(DISTINCT security_id) AS companies, substr(group_concat(DISTINCT security_id), 1, 160) AS sids
  FROM (SELECT security_id, field, value, reason, row_number() OVER (PARTITION BY security_id, basis, field ORDER BY period_end DESC) AS rn
        FROM feature_value WHERE security_id IN (SELECT value FROM json_each(?1)) AND basis IN ('consolidated','standalone'))
  WHERE rn = 1 AND value IS NULL GROUP BY field, why ORDER BY field, companies DESC`;
const current = (t: string) => `SELECT field, count(*) AS companies, sum(value IS NOT NULL) AS with_value FROM ${t} WHERE security_id IN (SELECT value FROM json_each(?1)) GROUP BY field ORDER BY field`;
const reasons = (t: string) => `SELECT field, substr(reason, 1, 48) AS why, count(*) AS companies FROM ${t} WHERE security_id IN (SELECT value FROM json_each(?1)) AND value IS NULL GROUP BY field, why ORDER BY field, companies DESC`;
export const SQL_OWN_COVERAGE = current("ownership_feature"), SQL_OWN_REASONS = reasons("ownership_feature");
export const SQL_EVT_COVERAGE = current("event_feature"), SQL_EVT_REASONS = reasons("event_feature");
export const SQL_PRICE_COVERAGE = current("price_feature"), SQL_PRICE_REASONS = reasons("price_feature");

type Cov = { field: string; companies: number; with_value: number; latest_with_value?: number };
type Why = { field: string; why: string | null; companies: number; sids?: string | null; symbols?: string[] };
export const SQL_SYMBOL_OF_SIDS = "SELECT security_id, coalesce(min(CASE WHEN valid_to IS NULL THEN value END), min(value)) AS symbol FROM security_identifier WHERE security_id IN (SELECT value FROM json_each(?1)) AND +id_type = 'nse_symbol' GROUP BY security_id";
export async function fieldReadiness(filings: Sql, market: Sql, sids: number[]) {
  const ids = [JSON.stringify(sids)];
  const top = (rows: Why[]) => { const m: Record<string, { why: string | null; companies: number; symbols?: string[] }[]> = {}; for (const r of rows) { const a = (m[r.field] ??= []); if (a.length < 3) a.push({ why: r.why, companies: r.companies, ...(r.symbols ? { symbols: r.symbols } : {}) }); } return m; };
  // owner #388 follow-up: name the companies behind each feature-table reason (first ≈ 20)
  const fvWhy = await filings.all<Why>(SQL_FV_REASONS, ids);
  const sidList = [...new Set(fvWhy.flatMap((r) => (r.sids ?? "").split(",").filter((x) => /^\d+$/.test(x)).map(Number)))];
  const sym = new Map<number, string>();
  for (let i = 0; i < sidList.length; i += 400) for (const r of await market.all<{ security_id: number; symbol: string }>(SQL_SYMBOL_OF_SIDS, [JSON.stringify(sidList.slice(i, i + 400))])) sym.set(r.security_id, r.symbol);
  for (const r of fvWhy) r.symbols = (r.sids ?? "").split(",").filter((x) => /^\d+$/.test(x)).map((x) => sym.get(Number(x)) ?? x);
  const join = (cov: Cov[], why: Why[]) => { const t = top(why); return cov.map((c) => ({ ...c, missing_top: t[c.field] ?? [] })); };
  return {
    focus_companies: sids.length,
    feature_value: join(await filings.all<Cov>(SQL_FV_COVERAGE, ids), fvWhy),
    ownership_feature: join(await filings.all<Cov>(SQL_OWN_COVERAGE, ids), await filings.all<Why>(SQL_OWN_REASONS, ids)),
    event_feature: join(await filings.all<Cov>(SQL_EVT_COVERAGE, ids), await filings.all<Why>(SQL_EVT_REASONS, ids)),
    price_feature: join(await market.all<Cov>(SQL_PRICE_COVERAGE, ids), await market.all<Why>(SQL_PRICE_REASONS, ids)),
  };
}

// Readiness defects 3–4 and the 13 without promoter holding (log #385/#386): read-only census of what is stored for
// the affected companies at one quarter end, to decide each fix from evidence (D134).
export const SQL_GAP_LINES = `SELECT statement, line FROM fin_value INDEXED BY ix_fin_value_period
  WHERE security_id = ?1 AND period_end = ?2 AND +basis = 'consolidated' AND +dims = '' AND +statement IN ('pl','bs') GROUP BY statement, line`;
export const SQL_GAP_SHP = "SELECT f.period_end, s.category FROM filing f JOIN shareholding s ON s.filing_id = f.filing_id AND s.holder_name = '' WHERE f.security_id = ?1 AND f.kind = 'shareholding' AND f.period_end = (SELECT max(period_end) FROM filing WHERE security_id = ?1 AND kind = 'shareholding')";
// G19 (log #399): late starters — a company whose stored quarterly results begin after the first quarter end on/after
// the coverage floor, though it was listed by then. No coverage_gap row names these (the gap pass only sees quarters
// on NSE lists we stored, and the older list was never fetched), so the hole was silent. Per company: one probe at the
// first quarter end (ix_fin_value_period, ≈ 1 row); only when it misses, the earliest stored quarter (same index walked
// from the oldest period end, stops at the first quarterly P&L row) and — for the late ones — the listing date and the
// company's per-company results lists in the ledger.
export const SQL_LATE_Q_AT = "SELECT 1 AS ok FROM fin_value INDEXED BY ix_fin_value_period WHERE security_id = ?1 AND period_end = ?2 AND period_kind = 'Q' AND +statement = 'pl' LIMIT 1";
export const SQL_LATE_FIRST_Q = "SELECT period_end FROM fin_value INDEXED BY ix_fin_value_period WHERE security_id = ?1 AND +period_kind = 'Q' AND +statement = 'pl' ORDER BY period_end LIMIT 1";
// market: security.listed_on (NSE listing date from EQUITY_L, market POST /maint/listed_on), else the earliest stored daily price (history
// starts at the floor, D2), by primary key
export const SQL_LISTED_ON = "SELECT listed_on FROM security WHERE security_id = ?1";
export const SQL_FIRST_PRICE = "SELECT d FROM price_daily WHERE security_id = ?1 ORDER BY d LIMIT 1";
export const LATE_LIST_KINDS = ["results_quarterly", "results_annual", "integrated_financials"] as const;
export const SQL_LATE_LISTS = `SELECT kind, status, url, fetched_at FROM fetch_job WHERE symbol IN (SELECT value FROM json_each(?1)) AND kind IN ('${LATE_LIST_KINDS.join("','")}')`;
/** The first calendar quarter end on or after `floor` (YYYY-MM-DD). */
export function firstQuarterEnd(floor: string): string {
  const y = Number(floor.slice(0, 4));
  for (const md of ["03-31", "06-30", "09-30", "12-31"]) if (`${y}-${md}` >= floor) return `${y}-${md}`;
  return `${y + 1}-03-31`;
}
const ymd = (d: number) => { const s = String(d); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };
export type LateStart = { symbol: string; earliest_quarter: string | null; listed: string | null; listed_source: "listed_on" | "first_price" | null;
  lists: { kind: string; status: string; jobs: number; last_fetched: string | null; earliest_from: string | null }[] };
export async function lateStart(filings: Sql, market: Sql, c: { sid: number; symbol: string }, floor = COVERAGE_FLOOR): Promise<LateStart | { symbol: string; listed: string; excluded: "listed after the first quarter end" } | null> {
  const q0 = firstQuarterEnd(floor);
  if ((await filings.all(SQL_LATE_Q_AT, [c.sid, q0])).length) return null;
  const earliest = (await filings.all<{ period_end: string }>(SQL_LATE_FIRST_Q, [c.sid]))[0]?.period_end ?? null;
  if (earliest !== null && earliest <= q0) return null; // starts on time; a hole at q0 itself is a coverage gap
  const on = (await market.all<{ listed_on: string | null }>(SQL_LISTED_ON, [c.sid]))[0]?.listed_on ?? null;
  const px = on ? null : (await market.all<{ d: number }>(SQL_FIRST_PRICE, [c.sid]))[0]?.d ?? null;
  const listed = on ?? (px ? ymd(px) : null);
  if (listed && listed > q0) return { symbol: c.symbol, listed, excluded: "listed after the first quarter end" };
  const syms = (await market.all<{ value: string }>(SQL_SYMBOLS_OF_SID, [c.sid])).map((r) => r.value);
  const jobs = await filings.all<{ kind: string; status: string; url: string; fetched_at: string | null }>(SQL_LATE_LISTS, [JSON.stringify(syms.length ? syms : [c.symbol])]);
  const g = new Map<string, LateStart["lists"][number]>();
  for (const j of jobs) {
    const k = `${j.kind}|${j.status}`, e = g.get(k) ?? { kind: j.kind, status: j.status, jobs: 0, last_fetched: null, earliest_from: null };
    e.jobs++;
    if (j.fetched_at && (!e.last_fetched || j.fetched_at > e.last_fetched)) e.last_fetched = j.fetched_at;
    // from_date=DD-MM-YYYY on dated list URLs; a URL without one asks for the whole list ("all")
    const m = /from_date=(\d{2})-(\d{2})-(\d{4})/.exec(j.url), from = m ? `${m[3]}-${m[2]}-${m[1]}` : "all";
    if (!e.earliest_from || from === "all" || (e.earliest_from !== "all" && from < e.earliest_from)) e.earliest_from = from;
    g.set(k, e);
  }
  return { symbol: c.symbol, earliest_quarter: earliest, listed, listed_source: on ? "listed_on" : px ? "first_price" : null, lists: [...g.values()].sort((a, b) => `${a.kind}|${a.status}`.localeCompare(`${b.kind}|${b.status}`)) };
}

export async function gapCensus(db: Sql, sids: { sid: number; symbol: string }[], period: string, market: Sql, floor = COVERAGE_FLOOR) {
  const late: LateStart[] = [], recent: { symbol: string; listed: string }[] = [];
  const owners: { symbol: string; lines: string[] }[] = [], nci: { symbol: string; bs_lines: number; minority_interest: boolean; has_owners_equity: boolean }[] = [], promoter: { symbol: string; as_of: string | null; categories: string[] }[] = [];
  for (const c of sids) {
    const rows = await db.all<{ statement: string; line: string }>(SQL_GAP_LINES, [c.sid, period]);
    const pl = rows.filter((r) => r.statement === "pl").map((r) => r.line), bs = rows.filter((r) => r.statement === "bs").map((r) => r.line);
    if (pl.includes("pat") && !pl.includes("pat_owners") && !pl.includes("pat_after_minority")) owners.push({ symbol: c.symbol, lines: pl.filter((l) => !/^(revenue|other_income|total_income|total_expenses|materials|purchases|inventory|employee|finance|depreciation|other_expenses)/.test(l)).slice(0, 30) });
    if (bs.length && !bs.includes("x:NonControllingInterest")) nci.push({ symbol: c.symbol, bs_lines: bs.length, minority_interest: bs.includes("minority_interest"), has_owners_equity: bs.includes("equity_owners") || bs.includes("x:EquityAttributableToOwnersOfParent") });
    const sh = await db.all<{ period_end: string; category: string }>(SQL_GAP_SHP, [c.sid]);
    if (!sh.some((r) => r.category === "promoter")) promoter.push({ symbol: c.symbol, as_of: sh[0]?.period_end ?? null, categories: [...new Set(sh.map((r) => r.category))] });
    const ls = await lateStart(db, market, c, floor);
    if (ls && "excluded" in ls) recent.push({ symbol: ls.symbol, listed: ls.listed }); else if (ls) late.push(ls);
  }
  return { period, companies: sids.length, owners_missing: owners, nci_missing: nci, promoter_missing: promoter,
    late_start: { floor, first_quarter_end: firstQuarterEnd(floor), rule: "earliest stored quarterly P&L (any basis) is after the first quarter end on/after the floor, or none is stored; and listed (security.listed_on, else first stored daily price) on/before that quarter end", companies: late, listed_after: recent } };
}

// Owner #388: is every stored row of company data linked to a company? Tables keyed by NSE symbol (not security_id)
// can hold rows under a symbol no company carries (a rename not recorded, a placeholder, a typo) — those rows never
// reach a company page. Read-only, manual: one grouped pass over each table's symbol index, then one identifier lookup.
export const LINK_TABLES_FILINGS = ["insider_trade", "sast_disclosure", "board_meeting", "credit_rating"] as const;
export const LINK_TABLES_MARKET = ["deal", "surveillance", "price_band", "fo_ban", "corp_action_extra"] as const;
const SQL_SYMBOL_COUNTS = (t: string) => `SELECT symbol, count(*) AS n FROM ${t} GROUP BY symbol`;
export const SQL_KNOWN_SYMBOLS = "SELECT DISTINCT value FROM security_identifier WHERE id_type = 'nse_symbol' AND value IN (SELECT value FROM json_each(?1))";
export async function linkAudit(filings: Sql, market: Sql, focusSymbols: string[]) {
  const focus = new Set(focusSymbols), out: Record<string, unknown> = {};
  for (const [db, tables] of [[filings, LINK_TABLES_FILINGS], [market, LINK_TABLES_MARKET]] as const) {
    for (const t of tables) {
      const counts = await db.all<{ symbol: string | null; n: number }>(SQL_SYMBOL_COUNTS(t));
      const syms = counts.map((c) => c.symbol ?? "").filter(Boolean);
      const known = new Set<string>();
      for (let i = 0; i < syms.length; i += 500) for (const r of await market.all<{ value: string }>(SQL_KNOWN_SYMBOLS, [JSON.stringify(syms.slice(i, i + 500))])) known.add(r.value);
      const orphan = counts.filter((c) => !c.symbol || !known.has(c.symbol)).sort((a, b) => b.n - a.n);
      out[t] = {
        rows: counts.reduce((a, c) => a + c.n, 0), symbols: counts.length,
        focus_symbols_with_rows: counts.filter((c) => c.symbol && focus.has(c.symbol)).length,
        orphan_rows: orphan.reduce((a, c) => a + c.n, 0), orphan_symbols: orphan.length,
        orphan_top: orphan.slice(0, 25).map((c) => ({ symbol: c.symbol, n: c.n })),
      };
    }
  }
  return out;
}

/** Read-only `/lines` (G14): one company's stored figures for named lines from a period end on (all bases, versions). */
export const SQL_LINES_OF = `SELECT period_end, period_kind, basis, version, statement, line, value, null_reason, disclosed_at FROM fin_value INDEXED BY ix_fin_value_period
  WHERE security_id = ?1 AND period_end >= ?2 AND +line IN (SELECT value FROM json_each(?3)) ORDER BY period_end DESC LIMIT 400`;
