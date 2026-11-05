// C56 guard (audit 4 Nov): D1 bills every row a query reads. The recurring cron queries are EXPLAIN-checked here against
// the schema built from the migrations, without statistics (as D1 runs). `npm run check` fails when one of them would
// read a large table whole: a SCAN, or the status index on fetch_job alone (~300k 'done' rows). Rule: every new query on
// a cron path is exported from its module and listed here. Not caught by EXPLAIN: a primary-key range from a cursor
// that never advances (the former "+kind" cursors read the whole table tail) — those use (kind, job_id) ranges instead.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { SQL_API_RETRY, SQL_API_TODO, SQL_DISCOVER } from "../../workers/prefetch/src/index.js";
import { SQL_LOADER_NEW, SQL_LOADER_RETRY, SQL_MISATTR, SQL_MOVE_FIN_VALUE, SQL_EARLIER_Q, SQL_Q_EXISTS, SQL_RELABEL_Q, SQL_RELOAD, SQL_REQUEUE_404, SQL_RETRY_OFF, SQL_STATEMENT_ROWS, SQL_VERSION_ROWS, SQL_NBFC_SIDS, SQL_NBFC_FILINGS, SQL_SID_TEMPLATE, SQL_FILING_PERIOD_LOADED, SQL_CF_TOTALS_FILINGS, SQL_SEGMENT_ROWS, SQL_SEGMENT_PERIODS, SQL_NEAREST_PAT_EPS, SQL_REVENUE_KINDS, SQL_PERIOD_LOADS, SQL_ORPHAN_RESTATED } from "../../workers/filings/src/load.js";
import { SQL_EVENTS_NEXT, SQL_PITX_NEXT, SQL_INSIDER_SINCE, SQL_INSIDER_UNDATED, SQL_PIT_JOBS, SQL_RATINGS_SINCE, SQL_INSIDER_YEARS, SQL_PITX_SYMBOLS } from "../../workers/filings/src/events.js";
import { SQL_FEATURE_NEW, SQL_FEATURE_ROWS, SQL_FEATURES_OF, SQL_LATEST_TTM } from "../../workers/filings/src/features.js";
import { SQL_BASIS_LISTS, SQL_BASIS_NEW } from "../../workers/filings/src/basis.js";
import { SQL_REMARK_LISTS } from "../../workers/filings/src/load.js";
import { SQL_SHP_FILES, SQL_SHP_LISTS } from "../../workers/filings/src/shpcov.js";
import { SQL_SECTOR_LISTS } from "../../workers/market/src/sectors.js";
import { SQL_FOCUS } from "../../packages/core/src/focus.js";

const root = join(import.meta.dirname, "..", "migrations");
function schema(domain: string): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(root, domain)).filter((n) => n.endsWith(".sql")).sort()) db.exec(readFileSync(join(root, domain, f), "utf8"));
  return db;
}
// Any full SCAN of a stored table (SQLite prints the alias when there is one, so every table counts), and the status
// index of fetch_job used alone. Scans of json_each (bound lists) and of subquery results are fine.
const bad = (line: string) => /^SCAN (?!json_each|\(subquery|CONSTANT ROW)/.test(line) || /USING (COVERING )?INDEX ix_fetch_discover \(status=\?\)$/.test(line);

function plan(db: DatabaseSync, sql: string, params: unknown[]): string[] {
  return db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(params as (string | number | null)[])).map((r) => String((r as { detail: string }).detail));
}

const F = schema("filings");
const cases: [string, string, unknown[], RegExp][] = [
  ["prefetch: API jobs waiting (every minute)", SQL_API_TODO, [640], /ix_fetch_api_pending/],
  ["prefetch: API jobs to retry (every minute)", SQL_API_RETRY, [640], /ix_fetch_api_pending/],
  ["prefetch: lists to discover (every minute)", SQL_DISCOVER, [], /ix_fetch_discover \(status=\? AND discovered=\?\)/],
  ["filings: new files per kind (every 5 min)", SQL_LOADER_NEW, ["xbrl_results_quarterly", 0, 2000], /ix_fetch_kind_job \(kind=\? AND job_id>\?\)/],
  ["filings: retries due (every 5 min)", SQL_LOADER_RETRY, ["2026-11-04T00:00:00.000Z", 10], /ix_fin_load_retry/],
  ["filings: one period's rows (versionPeriod, per loaded file)", SQL_VERSION_ROWS, [1, "2026-09-30", "Q", "consolidated"], /ix_fin_value_period \(security_id=\? AND period_end=\? AND period_kind=\? AND basis=\?\)/],
  ["filings: event lists cursor (every 5 min)", SQL_EVENTS_NEXT, ["pit", 0, 150], /ix_fetch_kind_job \(kind=\? AND job_id>\?\)/],
  ["filings: insider XBRL cursor (every 5 min)", SQL_PITX_NEXT, ["xbrl_pit_gg", 0, 150], /ix_fetch_kind_job \(kind=\? AND job_id>\?\)/],
  ["filings: companies with new filings (primary basis)", SQL_BASIS_NEW, [0, 2000], /INTEGER PRIMARY KEY \(rowid>\?\)/],
  ["filings: one company's results lists (primary basis)", SQL_BASIS_LISTS, ['["INFY"]'], /ix_fetch_symbol_kind/],
  ["market: new announcement lists for the sector job (every 10 min)", SQL_SECTOR_LISTS, ["announcements_daily", 0, 200], /ix_fetch_kind_job \(kind=\? AND job_id>\?\)/],
  ["filings: periods filed more than once, one company (version pass, manual)", "SELECT period_end, period_kind, basis FROM filing WHERE security_id=? AND kind <> 'shareholding' GROUP BY period_end, period_kind, basis HAVING count(*) > 1", [7], /ix_filing_sec \(security_id=\?\)/],
  ["filings: insider count check (/fresh)", "SELECT count(DISTINCT did) AS filings, count(*) AS trades FROM insider_trade WHERE key >= 'pitx:' AND key < 'pitx;'", [], /PRIMARY KEY \(key>\? AND key<\?\)/],
  ["filings: quarter already stored? (D169, per half-year file)", SQL_Q_EXISTS, [1, "2026-09-30", "consolidated"], /ix_fin_value_period \(security_id=\? AND period_end=\? AND period_kind=\? AND basis=\?\)/],
  ["filings: half-year filing of one gap (D169, manual)", "SELECT filing_id, kind, source_url, disclosed_at FROM filing WHERE security_id=? AND period_end=? AND period_kind='H' AND basis=?", [1, "2025-03-31", "consolidated"], /ix_filing_sec/],
  ["filings: filings stored under another company than their list (C61, manual)", SQL_MISATTR, ['["INFY"]'], /ix_filing_source_url \(source_url=\?\)/],
  ["filings: move one filing's rows to the linking company (C61, manual)", SQL_MOVE_FIN_VALUE, [783, 2215, 22294], /SEARCH fin_value USING INDEX \w+ \(security_id=\?\)/],
  ["filings: re-queue named 404 jobs (manual, bounded)", SQL_REQUEUE_404, ["[1,2]", '["INFY"]'], /SEARCH fetch_job USING INTEGER PRIMARY KEY \(rowid=\?\)/],
  ["filings: earlier filed quarters of the year (C62 proof, per half-year file)", SQL_EARLIER_Q, [1, '["2026-06-30"]', "consolidated", '["revenue","pat"]'], /ix_fin_value_period \(security_id=\? AND period_end=\? AND period_kind=\? AND basis=\?\)/],
  ["filings: relabel a proven quarter (C62, per half-year file)", SQL_RELABEL_Q, [1, "2026-09-30", "consolidated", 50], /ix_fin_value_period \(security_id=\? AND period_end=\? AND period_kind=\? AND basis=\?\)/],
  ["filings: out-of-focus due retries leave the queue (C63, every 5 min)", SQL_RETRY_OFF, ["[1,2]"], /SEARCH fin_load USING (INTEGER PRIMARY KEY|INDEX \w+) \(/],
  ["filings: re-read named files after a reader fix (manual, bounded)", SQL_RELOAD, ["2026-11-04T00:00:00Z", "[1,2]", '["INFY"]'], /SEARCH (fin_load|fetch_job|j) USING (INTEGER PRIMARY KEY|INDEX \w+) \(/],
  ["filings: one company's shareholding lists (2.8 coverage, read-only)", SQL_SHP_LISTS, ['["INFY"]'], /ix_fetch_symbol_kind \(symbol=\? AND kind=\?\)/],
  ["filings: listed shareholding files' download, load and filing (2.8 coverage, read-only)", SQL_SHP_FILES, ['["u"]'], /SEARCH j USING INDEX sqlite_autoindex_fetch_job_1 \(url=\?\)/],
  ["filings: one period's statements of one company (D157 view, read-only)", SQL_STATEMENT_ROWS, [1, "2026-09-30", "consolidated", "Q"], /ix_fin_value_period \(security_id=\? AND period_end=\? AND period_kind=\? AND basis=\?\)/],
  // once per pass (the company list is saved with the cursor): integrated filings only, by the (kind, …) key
  ["filings: focus NBFCs for the Division III balance-sheet pass (item 5, once)", SQL_NBFC_SIDS, [], /sqlite_autoindex_filing_1 \(kind=\?\)/],
  ["filings: one NBFC's results filings from 2024 (item 5 pass)", SQL_NBFC_FILINGS, [1, 0, 40], /ix_filing_sec \(security_id=\? AND kind=\? AND period_end>\?\)/],
  ["filings: one company's filed figures for the feature table (D171)", SQL_FEATURE_ROWS, [1, "2022-06-30", '["x:Equity"]'], /ix_fin_value_period \(security_id=\? AND period_end>\?\)/],
  ["filings: results filings since the feature cursor (cron, D171)", SQL_FEATURE_NEW, [0, 2000], /SEARCH filing USING INTEGER PRIMARY KEY \(rowid>\?\)/],
  ["filings: latest TTM values for valuations (D171)", SQL_LATEST_TTM, [1, "consolidated"], /SEARCH feature_value USING PRIMARY KEY \(security_id=\? AND basis=\? AND field=\?\)/],
  ["filings: one company's feature-table values (read-only page)", SQL_FEATURES_OF, [1, ""], /SEARCH feature_value USING PRIMARY KEY \(security_id=\?\)/],
  ["filings: one company's stored P&L template (bank / insurer cash-flow pass, item 5)", SQL_SID_TEMPLATE, [1], /ix_fin_value_period \(security_id=\? AND period_end>\?\)/],
  ["filings: one company's filings with a given cash-flow line (D167 b pass)", SQL_CF_TOTALS_FILINGS, [1, "cfo"], /USING (PRIMARY KEY|INDEX sqlite_autoindex_fin_value_1) \(security_id=\? AND statement=\? AND line=\?\)/],
  ["filings: is this period loaded from this filing (NBFC revenue pass, item 5)", SQL_FILING_PERIOD_LOADED, [1, "2026-09-30", "Q", "consolidated", 9], /ix_fin_value_period \(security_id=\? AND period_end=\? AND period_kind=\? AND basis=\?\)/],
  ["filings: one company's stored segments for one period (D47 live check, read-only)", SQL_SEGMENT_ROWS, [1, "2026-09-30", "consolidated"], /USING (PRIMARY KEY|INDEX sqlite_autoindex_fin_value_1) \(security_id=\? AND statement=\?\)/],
  ["filings: one company's periods with stored segments (D47 live check, read-only)", SQL_SEGMENT_PERIODS, [1], /USING (COVERING )?(PRIMARY KEY|INDEX sqlite_autoindex_fin_value_1) \(security_id=\? AND statement=\? AND line=\?\)/],
  ["filings: nearest periods' profit and EPS (scale-guard release, per held file)", SQL_NEAREST_PAT_EPS, [1, "standalone", "Q", "2026-06-30"], /USING (PRIMARY KEY|INDEX sqlite_autoindex_fin_value_1) \(security_id=\? AND statement=\? AND line=\?\)/],
  ["filings: the 250's revenue rows by kind (2.12 FY gaps, read-only)", SQL_REVENUE_KINDS, ["[1,2]", "2024-01-01"], /USING (COVERING )?(PRIMARY KEY|INDEX sqlite_autoindex_fin_value_1) \(security_id=\? AND statement=\? AND line=\?/],
  ["filings: load outcome of one period's files (2.12 FY gaps, read-only)", SQL_PERIOD_LOADS, [1, "2025-03-31", "consolidated"], /ix_filing_sec \(security_id=\?/],
  ["filings: one company's restated lines without an original (2.12 version fix, one-off)", SQL_ORPHAN_RESTATED, [1, "2024-01-01"], /SEARCH b USING (COVERING )?(PRIMARY KEY|INDEX sqlite_autoindex_fin_value_1) \(security_id=\? AND statement=\? AND line=\? AND dims=\? AND period_end=\? AND period_kind=\? AND basis=\? AND version=\?\)/],
  ["filings: the 250's insider trades from 2026 (owner #365, read-only)", SQL_INSIDER_SINCE, ['["INFY"]', 20260101], /ix_insider_symbol \(symbol=\? AND from_d>\?\)/],
  ["filings: the 250's undated insider trades (owner #365, read-only)", SQL_INSIDER_UNDATED, ['["INFY"]', "2026-01-01"], /ix_insider_symbol \(symbol=\? AND from_d=\?\)/],
  ["filings: per-company PIT list downloads (owner #365, read-only)", SQL_PIT_JOBS, [], /ix_fetch_kind_job \(kind=\? AND job_id>\?\)/],
  ["filings: the 250's credit ratings from 2026 (owner #365, read-only)", SQL_RATINGS_SINCE, ['["INFY"]', 20260101], /ix_credit_rating_symbol \(symbol=\? AND rated_on>\?\)/],
  ["filings: the 250's insider trades per year (owner #365, read-only)", SQL_INSIDER_YEARS, ['["INFY"]'], /ix_insider_symbol \(symbol=\? AND from_d>\?\)/],
  ["filings: new-system insider rows, all companies (owner #365, read-only)", SQL_PITX_SYMBOLS, [], /SEARCH insider_trade USING (COVERING )?(PRIMARY KEY|INDEX sqlite_autoindex_insider_trade_1) \(key>\? AND key<\?\)/],
  ["filings: remark pass lists (manual, bounded)", SQL_REMARK_LISTS, ["integrated_financials", 0, 10], /ix_fetch_kind_job \(kind=\? AND job_id>\?\)/],
];

const M = schema("market");
describe("market: the focus list (every filings run) starts from the index members", () => {
  it("index_membership by index, then identifiers by security (not every identifier)", () => {
    const p = plan(M, SQL_FOCUS, ['["NIFTY 50"]']);
    expect(p.filter(bad), p.join("\n")).toEqual([]);
    expect(p[0], p.join("\n")).toMatch(/SEARCH m USING INDEX sqlite_autoindex_index_membership_1 \(index_name=\?\)/);
    expect(p.some((l) => /ix_sid_security \(security_id=\?\)/.test(l)), p.join("\n")).toBe(true);
  });
});

describe("market: the focus companies' ISINs for the credit-rating issuer match (every filings run, item 7)", () => {
  it("identifiers by symbol (ix_sid_lookup), then that security's ISINs (ix_sid_security)", async () => {
    const { SQL_FOCUS_ISSUERS } = await import("../../workers/filings/src/events.js");
    const p = plan(M, SQL_FOCUS_ISSUERS, ['["INFY"]']);
    expect(p.filter(bad), p.join("\n")).toEqual([]);
    expect(p.some((l) => /ix_sid_lookup \(id_type=\? AND value=\?\)/.test(l)), p.join("\n")).toBe(true);
  });
});

describe("readiness probes (D123 map, read-only page) use an index prefix, never a scan", async () => {
  const { FIN_PROBES, SYM_PROBES } = await import("../../workers/filings/src/readiness.js");
  it.each([...Object.entries(FIN_PROBES), ...Object.entries(SYM_PROBES)])("%s", (_k, sql) => {
    const n = Math.max(...[...sql.matchAll(/\?(\d)/g)].map((m) => Number(m[1])));
    const p = plan(F, sql, [1, 20240101, "2024-01-01"].slice(0, n));
    expect(p.filter(bad), p.join("\n")).toEqual([]);
  });
});

describe("recurring queries read only what they need (C56)", () => {
  it.each(cases)("%s", (_name, sql, params, want) => {
    const p = plan(F, sql, params);
    expect(p.filter(bad), p.join("\n")).toEqual([]);
    expect(p.some((l) => want.test(l)), p.join("\n")).toBe(true);
  });
  it("the guard itself catches the patterns that cost the 25 B (old queries)", () => {
    const old = [
      "SELECT j.job_id FROM fetch_job j WHERE j.url LIKE ?", // aliased table scan
      "SELECT j.job_id FROM fetch_job j WHERE j.status='done' AND j.kind IN ('a','b') ORDER BY j.job_id LIMIT 300", // every 'done' row
      "SELECT count(*) FROM fin_value GROUP BY basis",
    ];
    for (const sql of old) expect(plan(F, sql, Array((sql.match(/\?/g) ?? []).length).fill(null)).some(bad), sql).toBe(true);
  });
});
