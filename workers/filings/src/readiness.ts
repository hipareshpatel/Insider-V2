// Data-readiness map (D123 / D152, work list A4): coverage of each stored data area across the focus companies from
// the D168 floor. Read-only. One indexed probe per company and area (primary-key or index prefix), so a call reads a
// few thousand rows, plus one pass over the feature table.
import type { Sql } from "@disclo/core";

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
export const SQL_FV_REASONS = `SELECT field, substr(reason, 1, 48) AS why, count(DISTINCT security_id) AS companies
  FROM (SELECT security_id, field, value, reason, row_number() OVER (PARTITION BY security_id, basis, field ORDER BY period_end DESC) AS rn
        FROM feature_value WHERE security_id IN (SELECT value FROM json_each(?1)) AND basis IN ('consolidated','standalone'))
  WHERE rn = 1 AND value IS NULL GROUP BY field, why ORDER BY field, companies DESC`;
const current = (t: string) => `SELECT field, count(*) AS companies, sum(value IS NOT NULL) AS with_value FROM ${t} WHERE security_id IN (SELECT value FROM json_each(?1)) GROUP BY field ORDER BY field`;
const reasons = (t: string) => `SELECT field, substr(reason, 1, 48) AS why, count(*) AS companies FROM ${t} WHERE security_id IN (SELECT value FROM json_each(?1)) AND value IS NULL GROUP BY field, why ORDER BY field, companies DESC`;
export const SQL_OWN_COVERAGE = current("ownership_feature"), SQL_OWN_REASONS = reasons("ownership_feature");
export const SQL_EVT_COVERAGE = current("event_feature"), SQL_EVT_REASONS = reasons("event_feature");
export const SQL_PRICE_COVERAGE = current("price_feature"), SQL_PRICE_REASONS = reasons("price_feature");

type Cov = { field: string; companies: number; with_value: number; latest_with_value?: number };
type Why = { field: string; why: string | null; companies: number };
export async function fieldReadiness(filings: Sql, market: Sql, sids: number[]) {
  const ids = [JSON.stringify(sids)];
  const top = (rows: Why[]) => { const m: Record<string, { why: string | null; companies: number }[]> = {}; for (const r of rows) { const a = (m[r.field] ??= []); if (a.length < 3) a.push({ why: r.why, companies: r.companies }); } return m; };
  const join = (cov: Cov[], why: Why[]) => { const t = top(why); return cov.map((c) => ({ ...c, missing_top: t[c.field] ?? [] })); };
  return {
    focus_companies: sids.length,
    feature_value: join(await filings.all<Cov>(SQL_FV_COVERAGE, ids), await filings.all<Why>(SQL_FV_REASONS, ids)),
    ownership_feature: join(await filings.all<Cov>(SQL_OWN_COVERAGE, ids), await filings.all<Why>(SQL_OWN_REASONS, ids)),
    event_feature: join(await filings.all<Cov>(SQL_EVT_COVERAGE, ids), await filings.all<Why>(SQL_EVT_REASONS, ids)),
    price_feature: join(await market.all<Cov>(SQL_PRICE_COVERAGE, ids), await market.all<Why>(SQL_PRICE_REASONS, ids)),
  };
}
