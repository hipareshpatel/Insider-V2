// M2 results loader: canonical results from XBRL kept in R2 (D132) -> filings.filing + fin_value.
// FMEA: B5 basis in every key; B6 period from the filing's own dates; B7 scale guard vs own history;
// B8 version 'original' (never overwritten); B9 unknown layout / failed checks -> review, nothing loaded.
import { type CanonicalResult, type Sql, type XbrlInstance, balanceAndCash, batchAll, canonicalResult, dec, div, insertRows, parseShareholding, parseXbrl, toText } from "@disclo/core";

export interface Deps {
  filings: Sql;
  market: Sql;
  getText(key: string): Promise<string | null>; // R2 read, gzip-aware
  bscf?: boolean; // M2 balance sheet + cash flow loading (off until the census confirms pass rates, D134)
  now: () => Date;
}

export const RESULT_KINDS = ["xbrl_results_quarterly", "xbrl_results_annual", "xbrl_integrated_financials"];
export const SHP_KINDS = ["xbrl_shareholding"];
const MON: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

/** "23-Oct-2026 20:19:37" (IST) -> UTC ISO. */
export function nseIstToUtc(s: string | undefined | null): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s ?? "").trim());
  if (!m) return null;
  const mon = MON[m[2]!.toUpperCase()];
  if (!mon) return null;
  const t = Date.parse(`${m[3]}-${mon}-${m[1]!.padStart(2, "0")}T${m[4] ?? "00"}:${m[5] ?? "00"}:${m[6] ?? "00"}Z`) - 330 * 60_000;
  return new Date(t).toISOString();
}

/** When the market learned it (D32): the list row that links this file, its broadcast time. */
export function broadcastFor(listJson: string, url: string): string | null {
  let rows: Record<string, unknown>[] = [];
  try { const d = JSON.parse(listJson); rows = Array.isArray(d) ? d : (d.data ?? []); } catch { return null; }
  const row = rows.find((r) => JSON.stringify(r).includes(url));
  if (!row) return null;
  // broadcast time first; revisions in Integrated Filing lists have none, but carry creation_Date (when NSE received it)
  for (const k of ["broadcast_Date", "broadCastDate", "broadcastDate", "exchdisstime", "creation_Date", "revised_Date", "filingDate", "submissionDate"]) {
    const t = nseIstToUtc(row[k] as string);
    if (t) return t;
  }
  return null;
}

const TEMPLATE: Record<CanonicalResult["template"], string> = { industrial: "industrial", bank: "bank", life_insurance: "insurance", general_insurance: "insurance" }; // life and general share the stored value; their line names differ
const CORE: Record<CanonicalResult["template"], string[]> = { industrial: ["revenue", "pat"], bank: ["interest_earned", "pat"], life_insurance: ["gross_premium", "pat"], general_insurance: ["gross_premium", "pat"] };

export interface LoadOutcome { jobId: number; status: "loaded" | "review" | "skipped" | "failed" | "excluded"; detail: string; rows?: number }

/** Shareholding pattern (FMEA B3, B4, C1–C3): loaded only when the top-level categories sum exactly to total shares. */
export async function loadShp(job: { job_id: number; kind: string; symbol: string | null; url: string; r2_key: string; parent_key: string | null }, deps: Deps, listCache: Map<string, string | null>): Promise<LoadOutcome> {
  const xml = await deps.getText(job.r2_key);
  if (!xml) return { jobId: job.job_id, status: "failed", detail: "file not in R2" };
  if (!/<\/(?:[\w-]+:)?xbrl>\s*$/.test(xml.trim())) return { jobId: job.job_id, status: "failed", detail: "truncated XML (root not closed)" };
  let r: ReturnType<typeof parseShareholding> | null = null;
  const inst = parseXbrl(xml);
  let parseErr: string | null = null;
  try { r = parseShareholding(inst); } catch (e) { parseErr = String(e); }
  if (parseErr && !/total shares not found/.test(parseErr)) return { jobId: job.job_id, status: "review", detail: `not a supported shareholding file: ${parseErr.slice(0, 140)}` };
  const sumCheck = "promoter + public + non-promoter-non-public = total shares";
  const symbol = (r ?? (() => { try { return parseShareholding(inst, { totalOverride: 1 }); } catch { return null; } })())?.symbol ?? job.symbol;
  const [sec] = await deps.market.all<{ security_id: number }>(
    "SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=? ORDER BY valid_to IS NULL DESC, valid_from DESC LIMIT 1", [symbol]);
  if (!sec) return { jobId: job.job_id, status: "skipped", detail: `symbol ${symbol} not in market identity yet` };
  let note: string | null = null;
  if (!r || r.checks.some((c) => c.name === sumCheck && !c.ok)) {
    // BSE Ltd (17 filings): the filed total is missing or inconsistent while the three top categories are right.
    // Accept their sum as the total only when NSE's issued share count on that date confirms it (± 0.5%).
    const probe = parseShareholding(inst, { totalOverride: 1 });
    const sum = probe.categories.filter((c) => ["promoter", "public", "non_promoter_non_public"].includes(c.category)).reduce((a, c) => a + c.shares, 0);
    const asOfD = Number((probe.asOf || "").replace(/-/g, "")) || 0;
    const [iss] = await deps.market.all<{ issue_size: number }>("SELECT issue_size FROM shares_daily WHERE security_id=? AND d<=? ORDER BY d DESC LIMIT 1", [sec.security_id, asOfD]);
    if (sum > 0 && iss && Math.abs(sum - iss.issue_size) / iss.issue_size <= 0.005) {
      r = parseShareholding(inst, { totalOverride: sum });
      note = `total from categories ${sum} (filed total ${parseErr ? "missing" : "inconsistent"}; NSE issue size ${iss.issue_size})`;
    } else if (!r) return { jobId: job.job_id, status: "review", detail: `not a supported shareholding file: ${parseErr!.slice(0, 140)}` };
  }
  const failed = r.checks.filter((c) => !c.ok);
  if (failed.length) return { jobId: job.job_id, status: "review", detail: `checks failed: ${failed.map((c) => `${c.name} (${c.detail})`).join("; ").slice(0, 300)}` };
  if (job.parent_key && !listCache.has(job.parent_key)) listCache.set(job.parent_key, await deps.getText(job.parent_key));
  const disclosedAt = (job.parent_key && broadcastFor(listCache.get(job.parent_key) ?? "", job.url)) ?? null;
  if (!disclosedAt) return { jobId: job.job_id, status: "review", detail: "broadcast time not found in its list (D32 needs disclosed_at)" };
  await deps.filings.run(
    `INSERT INTO filing (security_id, kind, period_end, period_kind, basis, disclosed_at, source_url, status) VALUES (?,?,?,'event','na',?,?,'loaded')
     ON CONFLICT (kind, source_url) DO NOTHING`, [sec.security_id, "shareholding", r.asOf, disclosedAt, job.url]);
  const [f] = await deps.filings.all<{ filing_id: number }>("SELECT filing_id FROM filing WHERE kind='shareholding' AND source_url=?", [job.url]);
  const fid = f!.filing_id;
  const rows: unknown[][] = [[fid, sec.security_id, r.asOf, "total", "", r.totalShares, "1", null, "1"]];
  for (const c of r.categories) rows.push([fid, sec.security_id, r.asOf, c.category, "", c.shares, c.filedPct, c.category === "promoter" ? r.promoterEncumbrance.pledged : null, c.pct]);
  const seen = new Set<string>();
  for (const h of r.namedHolders) {
    const k = `${h.group}|${h.name}`;
    if (seen.has(k)) continue; seen.add(k);
    rows.push([fid, sec.security_id, r.asOf, `holder:${h.group}`, h.name, h.shares, h.filedPct, null, h.pct]);
  }
  await batchAll(deps.filings, [
    ...insertRows("INSERT INTO shareholding (filing_id,security_id,as_of,category,holder_name,shares,pct,pledged_shares,pct_all_shares)", 9, rows, "ON CONFLICT DO NOTHING"),
    { sql: `INSERT INTO promoter_encumbrance (filing_id,security_id,as_of,encumbered,pledged,non_disposal,other,pct_of_promoter_holding) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
      params: [fid, sec.security_id, r.asOf, r.promoterEncumbrance.encumbered, r.promoterEncumbrance.pledged, r.promoterEncumbrance.nonDisposal, r.promoterEncumbrance.other, r.promoterEncumbrance.pctOfPromoterHolding] },
  ]);
  return { jobId: job.job_id, status: "loaded", detail: `shareholding ${r.asOf}${note ? `; ${note}` : ""}`, rows: rows.length + 1 };
}

export async function loadOne(job: { job_id: number; kind: string; symbol: string | null; url: string; r2_key: string; parent_key: string | null }, deps: Deps, listCache: Map<string, string | null>): Promise<LoadOutcome> {
  const xml = await deps.getText(job.r2_key);
  if (!xml) return { jobId: job.job_id, status: "failed", detail: "file not in R2" };
  if (!/<\/(?:[\w-]+:)?xbrl>\s*$/.test(xml.trim())) return { jobId: job.job_id, status: "failed", detail: "truncated XML (root not closed)" }; // FMEA B11
  let r: CanonicalResult;
  let inst: XbrlInstance;
  try { inst = parseXbrl(xml); r = canonicalResult(inst); } catch (e) {
    // D145 (owner #278): files with no reporting period in them (old bank format) are excluded, not reviewed.
    if (/reporting period not found/.test(String(e))) return { jobId: job.job_id, status: "excluded", detail: "no reporting period in the file (D145)" };
    return { jobId: job.job_id, status: "review", detail: `not a supported results file: ${String(e).slice(0, 140)}` };
  }
  const missingCore = CORE[r.template].filter((k) => r.lines[k] === undefined);
  if (missingCore.length) return { jobId: job.job_id, status: "review", detail: `${r.template}: core lines missing ${missingCore.join(",")}` };
  const failed = r.checks.filter((c) => !c.ok);
  // FMEA C7: if the only failure is the expense breakdown (the filing leaves an expense line untagged), the totals are
  // still proven by the other checks: load them, and record the breakdown lines as missing with the reason.
  const BREAKDOWN = ["materials", "purchases_stock_in_trade", "inventory_change", "employee_cost", "finance_cost", "depreciation", "other_expenses",
    "fees_commission_expense", "impairment_financial_instruments", "net_loss_fair_value", "net_loss_derecognition"];
  const onlyBreakdown = failed.length === 1 && failed[0]!.name === "expense lines = total expenses" && r.checks.filter((c) => c.ok).length >= 2;
  const nulls: Record<string, string> = {};
  if (onlyBreakdown) for (const k of BREAKDOWN) if (r.lines[k] !== undefined) { delete r.lines[k]; nulls[k] = "breakdown does not add up to total expenses in the filing"; }
  if (failed.length && !onlyBreakdown) return { jobId: job.job_id, status: "review", detail: `checks failed: ${failed.map((c) => `${c.name} (${c.detail})`).join("; ").slice(0, 300)}` };
  if (!r.checks.length) return { jobId: job.job_id, status: "review", detail: "no identity check could run" };

  const symbol = r.symbol ?? job.symbol;
  const [sec] = await deps.market.all<{ security_id: number }>(
    "SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=? ORDER BY valid_to IS NULL DESC, valid_from DESC LIMIT 1", [symbol]);
  if (!sec) return { jobId: job.job_id, status: "skipped", detail: `symbol ${symbol} not in market identity yet` };

  // B7 scale guard: revenue-type core line vs this company's latest earlier value for the same basis and period kind.
  const core = CORE[r.template][0]!;
  // Anchor = median of the 4 nearest periods on either side, loaded or held (V1 hint #276: compare with the company's
  // other quarters). Files load in download order, not period order, so a single earlier value let one odd quarter
  // hold several later ones (×312 vs 264,000); a median resists one outlier and holds the outlier itself instead.
  const near = await deps.filings.all<{ value: string }>(
    `SELECT value FROM (
       SELECT period_end, value FROM fin_value WHERE security_id=?1 AND statement='pl' AND line=?2 AND basis=?3 AND period_kind=?4 AND period_end <> ?5 AND value IS NOT NULL
       UNION ALL
       SELECT period_end, value FROM fin_held WHERE security_id=?1 AND line=?2 AND basis=?3 AND period_kind=?4 AND period_end <> ?5)
     ORDER BY abs(julianday(period_end) - julianday(?5)) LIMIT 4`, [sec.security_id, core, r.basis, r.periodKind, r.periodEnd]);
  const mags = near.map((x) => Math.abs(Number(x.value))).filter((x) => x > 0).sort((a, b) => a - b);
  const prev = mags.length ? { value: String(mags.length % 2 ? mags[(mags.length - 1) / 2] : (mags[mags.length / 2 - 1]! + mags[mags.length / 2]!) / 2) } : undefined;
  if (prev && dec(prev.value).units !== 0n && dec(r.lines[core]!).units !== 0n) {
    const ratio = Math.abs(Number(toText(div(dec(r.lines[core]!), dec(prev.value), 6))));
    if (ratio >= 10 || ratio <= 0.1) {
      await deps.filings.run("INSERT OR REPLACE INTO fin_held (security_id,line,basis,period_kind,period_end,value,job_id) VALUES (?,?,?,?,?,?,?)",
        [sec.security_id, core, r.basis, r.periodKind, r.periodEnd, r.lines[core]!, job.job_id]);
      return { jobId: job.job_id, status: "review", detail: `scale guard: ${core} ${r.lines[core]} vs median of ${mags.length} nearest periods ${prev.value} (×${ratio.toFixed(2)})` };
    }
  }
  // passed: drop an earlier hold of this period so the anchor does not count it twice (C45)
  await deps.filings.run("DELETE FROM fin_held WHERE security_id=? AND line=? AND basis=? AND period_kind=? AND period_end=?", [sec.security_id, core, r.basis, r.periodKind, r.periodEnd]);

  if (job.parent_key && !listCache.has(job.parent_key)) listCache.set(job.parent_key, await deps.getText(job.parent_key));
  const disclosedAt = (job.parent_key && broadcastFor(listCache.get(job.parent_key) ?? "", job.url)) ?? null;
  if (!disclosedAt) return { jobId: job.job_id, status: "review", detail: "broadcast time not found in its list (D32 needs disclosed_at)" };

  await deps.filings.run(
    `INSERT INTO filing (security_id, kind, period_end, period_kind, basis, disclosed_at, source_url, status) VALUES (?,?,?,?,?,?,?,'loaded')
     ON CONFLICT (kind, source_url) DO NOTHING`,
    [sec.security_id, job.kind.replace(/^xbrl_/, ""), r.periodEnd, r.periodKind, r.basis, disclosedAt, job.url]);
  const [f] = await deps.filings.all<{ filing_id: number }>("SELECT filing_id FROM filing WHERE kind=? AND source_url=?", [job.kind.replace(/^xbrl_/, ""), job.url]);
  const rows = [
    ...Object.entries(r.lines).map(([line, value]) => [
      sec.security_id, TEMPLATE[r.template], "pl", line, "", r.periodEnd, r.periodKind, r.basis, "original", value, null, disclosedAt, f!.filing_id, line, "reported", "results-v1"]),
    ...Object.entries(nulls).map(([line, reason]) => [
      sec.security_id, TEMPLATE[r.template], "pl", line, "", r.periodEnd, r.periodKind, r.basis, "original", null, reason, disclosedAt, f!.filing_id, line, "reported", "results-v1"]),
  ];
  await batchAll(deps.filings, insertRows(
    "INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)", 16, rows,
    "ON CONFLICT DO NOTHING"));
  await versionPeriod(deps.filings, sec.security_id, r.periodEnd, r.periodKind, r.basis);
  const extra = deps.bscf ? await loadBsCf(inst!, sec.security_id, TEMPLATE[r.template], r.basis, disclosedAt, f!.filing_id, deps) : { rows: 0, note: "" };
  return { jobId: job.job_id, status: "loaded", detail: `${r.label} ${r.basis} ${r.template}${onlyBreakdown ? " (expense breakdown not in filing)" : ""}${extra.note}`, rows: rows.length + extra.rows };
}

/** D48: for one company, period and basis, the earliest disclosure is 'original' and every later one 'restated'
 *  (labels corrected in both directions, since files load in download order). Core-line differences > 0.5% between
 *  the original and a restatement are recorded in restatement_flag. Uses the PK prefix (no scans). */
export async function versionPeriod(db: Sql, sid: number, periodEnd: string, periodKind: string, basis: string): Promise<number> {
  const at = await db.all<{ disclosed_at: string }>(
    "SELECT DISTINCT disclosed_at FROM fin_value WHERE security_id=? AND statement='pl' AND line IN ('revenue','total_income','pat','interest_earned') AND period_end=? AND period_kind=? AND basis=? ORDER BY disclosed_at", [sid, periodEnd, periodKind, basis]);
  if (at.length < 2) return 0;
  const first = at[0]!.disclosed_at;
  await db.run("UPDATE fin_value SET version='original' WHERE security_id=? AND period_end=? AND period_kind=? AND basis=? AND disclosed_at=? AND version<>'original'", [sid, periodEnd, periodKind, basis, first]);
  await db.run("UPDATE fin_value SET version='restated' WHERE security_id=? AND period_end=? AND period_kind=? AND basis=? AND disclosed_at>? AND version='original'", [sid, periodEnd, periodKind, basis, first]);
  const vals = await db.all<{ line: string; value: string | null; disclosed_at: string }>(
    "SELECT line, value, disclosed_at FROM fin_value WHERE security_id=? AND statement='pl' AND line IN ('revenue','total_income','pat','interest_earned') AND period_end=? AND period_kind=? AND basis=?", [sid, periodEnd, periodKind, basis]);
  const orig = new Map(vals.filter((v) => v.disclosed_at === first).map((v) => [v.line, v.value]));
  const flags: unknown[][] = [];
  for (const v of vals) {
    if (v.disclosed_at === first || v.value === null) continue;
    const o = orig.get(v.line);
    if (o === undefined || o === null || Number(o) === 0) continue;
    const pct = (Number(v.value) - Number(o)) / Math.abs(Number(o));
    if (Math.abs(pct) > 0.005) flags.push([sid, "pl", v.line, periodEnd, periodKind, basis, o, v.value, (pct * 100).toFixed(2), first, v.disclosed_at]);
  }
  if (flags.length) await batchAll(db, insertRows("INSERT OR REPLACE INTO restatement_flag (security_id,statement,line,period_end,period_kind,basis,original_value,restated_value,change_pct,original_at,restated_at)", 11, flags));
  return flags.length;
}

/** One-off (D48): version the periods loaded before this rule — groups with more than one filing, by cursor. */
export async function versionBackfill(db: Sql, limit = 150): Promise<{ done: boolean; groups: number } | null> {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='version_backfill'");
  const cur = st ? JSON.parse(st.detail) as { after: string; done: boolean; groups: number } : { after: "", done: false, groups: 0 };
  if (cur.done) return null;
  const g = await db.all<{ k: string; security_id: number; period_end: string; period_kind: string; basis: string }>(
    `SELECT security_id || '|' || period_end || '|' || period_kind || '|' || basis AS k, security_id, period_end, period_kind, basis FROM filing
     WHERE kind <> 'shareholding' GROUP BY security_id, period_end, period_kind, basis HAVING count(*) > 1 AND k > ? ORDER BY k LIMIT ?`, [cur.after, limit]);
  for (const x of g) await versionPeriod(db, x.security_id, x.period_end, x.period_kind, x.basis);
  const next = { after: g.length ? g[g.length - 1]!.k : cur.after, done: g.length < limit, groups: cur.groups + g.length };
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','version_backfill',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(next)]);
  return next;
}

const months = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1;
const ytdKind = (start: string, end: string) => ({ 3: "Q", 6: "H", 9: "9M", 12: "FY" } as Record<number, string>)[months(start, end)] ?? null;
/** M2: balance sheet + cash flow rows, each statement only when all of its own checks pass (else noted, not loaded). */
export async function loadBsCf(inst: XbrlInstance, sid: number, template: string, basis: string, disclosedAt: string, filingId: number, deps: Deps): Promise<{ rows: number; note: string }> {
  const b = balanceAndCash(inst);
  const rows: unknown[][] = [];
  const notes: string[] = [];
  const kind = b.cf ? ytdKind(b.cf.start, b.cf.end) : null;
  const fyStart = inst.facts.find((x) => /:DateOfStartOfFinancialYear$/.test(x.tag))?.value ?? null;
  const bsKind = kind ?? (b.bs && fyStart ? ytdKind(fyStart, b.bs.date) : null);
  if (b.bs && bsKind) {
    if (b.bs.checks.length >= 2 && b.bs.checks.every((c) => c.ok))
      for (const [line, value] of Object.entries(b.bs.lines)) rows.push([sid, template, "bs", line, "", b.bs.date, bsKind, basis, "original", value, null, disclosedAt, filingId, line, "reported", "bscf-v1"]);
    else notes.push(`balance sheet not loaded: ${b.bs.checks.filter((c) => !c.ok).map((c) => c.name).join(", ") || "too few checks"}`);
  }
  if (b.cf && kind) {
    if (b.cf.checks.length >= 1 && b.cf.checks.every((c) => c.ok))
      for (const [line, value] of Object.entries(b.cf.lines)) rows.push([sid, template, "cf", line, "", b.cf.end, kind, basis, "original", value, null, disclosedAt, filingId, line, "reported", "bscf-v1"]);
    else notes.push(`cash flow not loaded: ${b.cf.checks.filter((c) => !c.ok).map((c) => c.name).join(", ") || "no check"}`);
  }
  if (rows.length) await batchAll(deps.filings, insertRows(
    "INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)", 16, rows, "ON CONFLICT DO NOTHING"));
  return { rows: rows.length, note: notes.length ? `; ${notes.join("; ")}` : "" };
}

/** One-off backfill: balance sheet + cash flow for results files loaded before the BS/CF reader (cursor by job_id). */
export async function backfillBsCf(deps: Deps, limit = 200): Promise<{ after: number; done: boolean; rows: number } | null> {
  const [st] = await deps.filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='bscf_backfill'");
  const cur = st ? JSON.parse(st.detail) as { after: number; done: boolean; rows: number } : { after: 0, done: false, rows: 0 };
  if (cur.done) return null;
  const jobs = await deps.filings.all<{ job_id: number; r2_key: string; url: string; kind: string }>(
    `SELECT j.job_id, j.r2_key, j.url, j.kind FROM fin_load l JOIN fetch_job j ON j.job_id = l.job_id
     WHERE l.status='loaded' AND l.job_id > ? AND j.kind IN (${RESULT_KINDS.map(() => "?").join(",")}) ORDER BY l.job_id LIMIT ?`, [cur.after, ...RESULT_KINDS, limit]);
  for (const j of jobs) {
    const xml = await deps.getText(j.r2_key);
    if (!xml) continue;
    const [f] = await deps.filings.all<{ filing_id: number; security_id: number; basis: string; disclosed_at: string }>("SELECT filing_id, security_id, basis, disclosed_at FROM filing WHERE kind=? AND source_url=?", [j.kind.replace(/^xbrl_/, ""), j.url]);
    if (!f) continue;
    try {
      const inst = parseXbrl(xml);
      const r = canonicalResult(inst);
      cur.rows += (await loadBsCf(inst, f.security_id, TEMPLATE[r.template], f.basis, f.disclosed_at, f.filing_id, deps)).rows;
    } catch { /* unreadable: already counted by the main loader */ }
  }
  const next = { after: jobs.length ? jobs[jobs.length - 1]!.job_id : cur.after, done: jobs.length < limit, rows: cur.rows };
  await deps.filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','bscf_backfill',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(next)]);
  return next;
}

export async function loadBatch(deps: Deps, limit = 150, parallel = 8): Promise<LoadOutcome[]> {
  // C43: a 'skipped' job (symbol not in market identity yet) is retried at most every 6 hours. Retrying it on every
  // run filled the whole batch with the same ~300 skipped jobs, so new files and the BS/CF backfill stopped.
  // C45: scale-guard holds are re-checked on the same 6-hour cycle. Backlog files load in download order and in
  // parallel, so a hold was judged before its neighbouring periods were on record (ABCAPITAL: 5 post-merger quarters
  // all held against pre-merger values). Re-checked with the full neighbourhood, an isolated outlier (a unit error)
  // stays held; a lasting change loads and is still flagged by the series audit (/audit).
  const retryBefore = new Date(deps.now().getTime() - 6 * 3600_000).toISOString();
  const kinds = [...RESULT_KINDS, ...SHP_KINDS];
  const marks = kinds.map(() => "?").join(",");
  const jobs = await deps.filings.all<{ job_id: number; kind: string; symbol: string | null; url: string; r2_key: string; parent_key: string | null }>(
    `SELECT j.job_id, j.kind, j.symbol, j.url, j.r2_key, p.r2_key AS parent_key FROM fetch_job j LEFT JOIN fetch_job p ON p.job_id = j.parent_id
     WHERE j.status='done' AND j.kind IN (${marks}) AND NOT EXISTS (SELECT 1 FROM fin_load l WHERE l.job_id = j.job_id AND ((l.status <> 'skipped' AND NOT (l.status = 'review' AND substr(l.detail, 1, 12) = 'scale guard:')) OR l.at > ?))
     ORDER BY j.job_id LIMIT ?`, [...kinds, retryBefore, limit]);
  const cache = new Map<string, string | null>();
  const out: LoadOutcome[] = [];
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const j = jobs[i++]!;
      let o: LoadOutcome;
      try { o = SHP_KINDS.includes(j.kind) ? await loadShp(j, deps, cache) : await loadOne(j, deps, cache); } catch (e) { o = { jobId: j.job_id, status: "failed", detail: String(e).slice(0, 200) }; }
      out.push(o);
      await deps.filings.run("INSERT INTO fin_load (job_id, status, detail, at) VALUES (?,?,?,?) ON CONFLICT (job_id) DO UPDATE SET status=excluded.status, detail=excluded.detail, at=excluded.at",
        [o.jobId, o.status, o.detail, deps.now().toISOString()]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, jobs.length || 1) }, worker)); // jobs are independent files
  return out;
}
