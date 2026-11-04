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
import { SQL_LOADER_NEW, SQL_LOADER_RETRY, SQL_VERSION_ROWS } from "../../workers/filings/src/load.js";
import { SQL_EVENTS_NEXT, SQL_PITX_NEXT } from "../../workers/filings/src/events.js";
import { SQL_BASIS_LISTS, SQL_BASIS_NEW } from "../../workers/filings/src/basis.js";

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
];

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
