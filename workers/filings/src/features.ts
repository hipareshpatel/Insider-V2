// D171 (owner #358): the feature table — computed values (TTM, EBITDA, adjusted figures, growth, ROE/ROCE) stored in
// feature_value, never in fin_value. Built company by company from the filed figures; a rebuild writes only values that
// changed (the upsert's WHERE), so a nightly run over the 250 writes little once the table is filled.
import { batchAll, chooseLayout, companyFeatures, dec, div, insertRows, toText, valuationFeatures, type FiledPeriod, type View } from "@disclo/core";
import type { Deps } from "./load.js";

/** Rows read reach back far enough for a TTM year-on-year of the first stored quarter (2024-03: TTM to 2023-03, whose
 *  quarters start 2022-06); values are stored from the D168 floor on. */
export const FEATURE_READ_FROM = "2022-06-30";
export const FEATURE_STORE_FROM = "2024-01-01";
const BS_LINES = ["x:EquityAttributableToOwnersOfParent", "x:Equity", "x:ShareholdersFunds", "x:ShareCapital", "x:ReservesAndSurplus", "x:ShareApplicationMoneyReceivedPendingAllotmentOfShares", "x:BorrowingsNoncurrent", "x:BorrowingsCurrent", "equity_owners", "total_equity", "capital", "reserves",
  "x:CashAndCashEquivalents", "x:BankBalanceOtherThanCashAndCashEquivalents", "x:NonControllingInterest",
  "x:TradeReceivablesCurrent", "x:Inventories", "x:TradePayablesCurrent", "x:CapitalWorkInProgress", // §7 working capital, CWIP
  "x:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "cfo"]; // §6/§7 capex, free cash flow (statement cf)
export const SQL_FEATURE_ROWS = `SELECT statement, line, period_end, period_kind, basis, value, template FROM fin_value INDEXED BY ix_fin_value_period
   WHERE security_id = ?1 AND period_end >= ?2 AND dims = '' AND (statement = 'pl' OR (statement IN ('bs', 'cf') AND line IN (SELECT value FROM json_each(?3))))
   ORDER BY disclosed_at`;
export const SQL_FEATURE_UPSERT_HEAD = "INSERT INTO feature_value (security_id, basis, field, period_end, value, reason, inputs, computed_at)";
export const SQL_FEATURE_UPSERT_TAIL = `ON CONFLICT (security_id, basis, field, period_end) DO UPDATE SET value = excluded.value, reason = excluded.reason,
   inputs = excluded.inputs, computed_at = excluded.computed_at
   WHERE feature_value.value IS NOT excluded.value OR feature_value.reason IS NOT excluded.reason OR feature_value.inputs IS NOT excluded.inputs`;

export const SQL_FEATURES_OF = "SELECT basis, field, period_end, value, reason, inputs, computed_at FROM feature_value WHERE security_id = ?1 AND (?2 = '' OR field = ?2) ORDER BY basis, field, period_end";

/** One company: read its filed P&L quarters and the balance-sheet lines needed, compute, upsert. Returns rows offered. */
export async function buildCompanyFeatures(deps: Deps, sid: number): Promise<{ rows: number; layouts: string[] }> {
  const rows = await deps.filings.all<{ statement: string; line: string; period_end: string; period_kind: string; basis: string; value: string | null; template: string }>(
    SQL_FEATURE_ROWS, [sid, FEATURE_READ_FROM, JSON.stringify(BS_LINES)]);
  // latest disclosed value per (statement, period, kind, basis, line): rows come oldest first (D48: restated is the default)
  const pl = new Map<string, FiledPeriod>(), bs = new Map<string, Map<string, Record<string, string | null>>>(), cfy = new Map<string, Map<string, Record<string, string | null>>>();
  let template: string | null = null;
  for (const r of rows) {
    if (r.statement === "pl") {
      template ??= r.template;
      const k = `${r.basis}|${r.period_end}|${r.period_kind}`;
      const p = pl.get(k) ?? { periodEnd: r.period_end, periodKind: r.period_kind, basis: r.basis, lines: {} };
      p.lines[r.line] = r.value; pl.set(k, p);
    } else if (r.statement === "cf") {
      if (r.period_kind !== "FY") continue; // cash flow is year to date: full years only
      const c = cfy.get(r.basis) ?? new Map(); const d = c.get(r.period_end) ?? {};
      d[r.line] = r.value; c.set(r.period_end, d); cfy.set(r.basis, c);
    } else {
      const b = bs.get(r.basis) ?? new Map(); const d = b.get(r.period_end) ?? {};
      d[r.line] = r.value; b.set(r.period_end, d); bs.set(r.basis, b);
    }
  }
  const periods = [...pl.values()];
  const out: unknown[][] = [], now = deps.now().toISOString(), layouts: string[] = [];
  for (const basis of ["consolidated", "standalone"]) {
    const mine = periods.filter((p) => p.basis === basis && p.periodKind === "Q");
    if (!mine.length) continue;
    const layout = chooseLayout(template, Object.assign({}, ...mine.map((p) => p.lines))).name;
    layouts.push(`${basis}:${layout}`);
    for (const f of companyFeatures(periods, bs.get(basis) ?? new Map(), basis, layout, cfy.get(basis) ?? new Map()))
      if (f.periodEnd >= FEATURE_STORE_FROM) out.push([sid, f.basis, f.field, f.periodEnd, f.value, f.reason, JSON.stringify(f.inputs), now]);
  }
  if (out.length) await batchAll(deps.filings, insertRows(SQL_FEATURE_UPSERT_HEAD, 8, out, SQL_FEATURE_UPSERT_TAIL));
  return { rows: out.length, layouts };
}

/** /maint/features: the focus companies in security_id order, `limit` per call, cursor saved (daily_refresh). `restart`
 *  starts a new full pass (the nightly run). */
export async function buildFeatures(deps: Deps, limit = 25, restart = false): Promise<{ done: boolean; after: number; companies: number; rows: number }> {
  const [st] = restart ? [] : await deps.filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='features'");
  const cur = st ? JSON.parse(st.detail) as { after: number; companies: number; rows: number; done: boolean } : { after: 0, companies: 0, rows: 0, done: false };
  if (cur.done && !restart) return cur;
  const sids = (await deps.market.all<{ security_id: number }>(
    "SELECT DISTINCT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?)) AND security_id > ? ORDER BY security_id LIMIT ?",
    [JSON.stringify(deps.focus ?? []), cur.after, limit])).map((r) => r.security_id);
  for (const sid of sids) { cur.rows += (await buildCompanyFeatures(deps, sid)).rows; cur.companies++; cur.after = sid; }
  cur.done = sids.length < limit;
  await deps.filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','features',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [deps.now().toISOString(), JSON.stringify(cur)]);
  return cur;
}

/** D171: keep the feature table current. Each cron run rebuilds the focus companies with results filings loaded since
 *  the last run (cursor over filing_id, as the primary-basis step), at most `limit` companies; nothing new = one small
 *  read. A restatement arrives as a new filing, so it is picked up the same way. */
export const SQL_FEATURE_NEW = "SELECT filing_id, security_id FROM filing WHERE filing_id > ? AND +kind IN ('results_quarterly','results_annual','integrated_financials') ORDER BY filing_id LIMIT ?"; // +kind: walk the primary key from the cursor (the kind index would read every results filing each run)
export async function featuresStep(deps: Deps, focusSids: Set<number>, limit = 10): Promise<{ companies: number; after: number }> {
  const [st] = await deps.filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='features_cursor'");
  let after = st ? (JSON.parse(st.detail) as { after: number }).after : null;
  if (after === null) {
    // first run after the full build: start from the newest filing (the build covered everything before it)
    const [m] = await deps.filings.all<{ m: number | null }>("SELECT max(filing_id) AS m FROM filing");
    after = m?.m ?? 0;
  }
  const rows = await deps.filings.all<{ filing_id: number; security_id: number }>(SQL_FEATURE_NEW, [after, 2000]);
  const sids: number[] = [];
  for (const r of rows) {
    if (focusSids.has(r.security_id) && !sids.includes(r.security_id)) {
      if (sids.length >= limit) break; // the cursor stops before the first company not done this run
      sids.push(r.security_id);
    }
    after = r.filing_id;
  }
  for (const sid of sids) await buildCompanyFeatures(deps, sid);
  await deps.filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','features_cursor',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail",
    [deps.now().toISOString(), JSON.stringify({ after })]);
  return { companies: sids.length, after: after! };
}

/** D171: valuation fields on the latest close, refreshed once per trading day for the focus companies (cursor by
 *  security_id within the day; `limit` companies per run). Inputs: NSE's market cap (market DB, D5), the latest
 *  available TTM values of the feature table and the latest filed balance sheet. */
export const SQL_LATEST_SESSION = "SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session = 1";
export const SQL_LATEST_MCAP = "SELECT d, mcap_paise FROM shares_daily WHERE security_id = ?1 ORDER BY d DESC LIMIT 1";
// owner #360 cost trim: everything a valuation needs is in the feature table (was: a scan of the company's stored rows
// for the year, ≈ 3,700 rows per company per day)
export const SQL_LATEST_TTM = `SELECT field, period_end, value, reason, inputs FROM feature_value WHERE security_id = ?1 AND basis = ?2
   AND field IN ('pat_owners_ttm','revenue_ttm','ebitda_ttm','equity_owners','net_debt','nci','layout') ORDER BY field, period_end`;

export async function companyValuations(deps: Deps, sid: number): Promise<number> {
  const [m] = await deps.market.all<{ d: number; mcap_paise: number | null }>(SQL_LATEST_MCAP, [sid]);
  if (!m || m.mcap_paise == null) return 0;
  const mcapRs = toText(div(dec(String(m.mcap_paise)), dec("100"), 2));
  const mcapDate = `${String(m.d).slice(0, 4)}-${String(m.d).slice(4, 6)}-${String(m.d).slice(6, 8)}`;
  const out: unknown[][] = [], now = deps.now().toISOString();
  for (const basis of ["consolidated", "standalone"]) {
    const t = (await deps.filings.all<{ field: string; period_end: string; value: string | null; reason: string | null; inputs: string }>(SQL_LATEST_TTM, [sid, basis]))
      .filter((r) => r.field === "layout" || r.period_end !== "latest");
    if (!t.length) continue;
    // latest period with a value; if the latest has none, its reason is kept (a missing quarter is said, not skipped)
    const latest = (f: string): View => {
      const rs = t.filter((r) => r.field === f && r.period_end <= mcapDate);
      const withValue = rs.filter((r) => r.value !== null).pop();
      const last = rs[rs.length - 1];
      if (!last) return { value: null, reason: `no ${f}` };
      if (last.value === null && (!withValue || withValue.period_end < last.period_end)) return { value: null, reason: `${f} to ${last.period_end}: ${last.reason}` };
      return { value: withValue!.value!, from: JSON.parse(withValue!.inputs) as string[] };
    };
    const layout = t.find((r) => r.field === "layout")?.value ?? "industrial";
    for (const f of valuationFeatures(basis, { mcapRs, mcapDate, layout, patOwnersTtm: latest("pat_owners_ttm"), revenueTtm: latest("revenue_ttm"), ebitdaTtm: latest("ebitda_ttm"),
      equityOwners: latest("equity_owners"), netDebt: latest("net_debt"), nci: latest("nci") }))
      out.push([sid, f.basis, f.field, f.periodEnd, f.value, f.reason, JSON.stringify(f.inputs), now]);
  }
  if (out.length) await batchAll(deps.filings, insertRows(SQL_FEATURE_UPSERT_HEAD, 8, out, SQL_FEATURE_UPSERT_TAIL));
  return out.length;
}

export async function valuationsStep(deps: Deps, focusSids: Set<number>, limit = 50): Promise<{ day: string | null; companies: number; done: boolean }> {
  const [s] = await deps.market.all<{ d: string | null }>(SQL_LATEST_SESSION);
  const day = s?.d ?? null;
  if (!day) return { day, companies: 0, done: true };
  const [st] = await deps.filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='valuations'");
  const cur = st ? JSON.parse(st.detail) as { day: string; after: number; done: boolean } : null;
  if (cur?.day === day && cur.done) return { day, companies: 0, done: true };
  const after = cur?.day === day ? cur.after : 0;
  const sids = [...focusSids].filter((x) => x > after).sort((a, b) => a - b).slice(0, limit);
  for (const sid of sids) await companyValuations(deps, sid);
  const done = sids.length < limit;
  await deps.filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','valuations',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail",
    [deps.now().toISOString(), JSON.stringify({ day, after: sids.length ? sids[sids.length - 1] : after, done })]);
  return { day, companies: sids.length, done };
}
