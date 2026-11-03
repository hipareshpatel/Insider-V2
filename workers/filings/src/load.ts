// M2 results loader: canonical results from XBRL kept in R2 (D132) -> filings.filing + fin_value.
// FMEA: B5 basis in every key; B6 period from the filing's own dates; B7 scale guard vs own history;
// B8 version 'original' (never overwritten); B9 unknown layout / failed checks -> review, nothing loaded.
import { type CanonicalResult, statementDetail, type Sql, type XbrlInstance, balanceAndCash, batchAll, canonicalResult, dec, div, insertRows, parseShareholding, parseXbrl, toText } from "@disclo/core";

export interface Deps {
  filings: Sql;
  market: Sql;
  getText(key: string): Promise<string | null>; // R2 read, gzip-aware
  bscf?: boolean; // M2 balance sheet + cash flow loading (off until the census confirms pass rates, D134)
  now: () => Date;
  /** D155: load only these NSE symbols' filings (all symbols a focus security has had); undefined = everything. */
  focus?: string[];
}
/** SQL fragment + params restricting fetch_job rows aliased `j` to the focus symbols (one JSON parameter, D1-safe). */
const focusSql = (deps: Deps) => (deps.focus ? { sql: " AND j.symbol IN (SELECT value FROM json_each(?))", params: [JSON.stringify(deps.focus)] } : { sql: "", params: [] as unknown[] });

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
  const fyx = await loadFy(inst!, r, sec.security_id, disclosedAt, f!.filing_id, deps);
  return { jobId: job.job_id, status: "loaded", detail: `${r.label} ${r.basis} ${r.template}${onlyBreakdown ? " (expense breakdown not in filing)" : ""}${extra.note}${fyx.note}`, rows: rows.length + extra.rows + fyx.rows };
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
  // D154: every reported line item, stored as "x:<tag>" next to the named lines, only when the statement's totals pass
  // AND its detail adds up to its own subtotals; otherwise the checked totals load alone and the detail is noted.
  const refs = new Set(inst.facts.map((f) => f.contextRef));
  const det = template === "industrial" ? statementDetail(inst, refs.has("OneI") ? "OneI" : null, refs.has("FourD") ? "FourD" : null) : { bs: null, cf: null };
  const detailRows = (st: "bs" | "cf", d: typeof det.bs, end: string, k: string) => {
    if (!d || !Object.keys(d.lines).length) return;
    const bad = d.checks.filter((c) => !c.ok);
    if (bad.length) { notes.push(`${st} detail not loaded: ${bad.map((c) => c.name).join(", ")}`); return; }
    for (const [tag, value] of Object.entries(d.lines)) rows.push([sid, template, st, `x:${tag}`, "", end, k, basis, "original", value, null, disclosedAt, filingId, tag, "reported", "detail-v1"]);
  };
  if (b.bs && bsKind) {
    if (b.bs.checks.length >= 2 && b.bs.checks.every((c) => c.ok)) {
      for (const [line, value] of Object.entries(b.bs.lines)) rows.push([sid, template, "bs", line, "", b.bs.date, bsKind, basis, "original", value, null, disclosedAt, filingId, line, "reported", "bscf-v1"]);
      detailRows("bs", det.bs, b.bs.date, bsKind);
    } else notes.push(`balance sheet not loaded: ${b.bs.checks.filter((c) => !c.ok).map((c) => c.name).join(", ") || "too few checks"}`);
  }
  if (b.cf && kind) {
    if (b.cf.checks.length >= 1 && b.cf.checks.every((c) => c.ok)) {
      for (const [line, value] of Object.entries(b.cf.lines)) rows.push([sid, template, "cf", line, "", b.cf.end, kind, basis, "original", value, null, disclosedAt, filingId, line, "reported", "bscf-v1"]);
      detailRows("cf", det.cf, b.cf.end, kind);
    } else notes.push(`cash flow not loaded: ${b.cf.checks.filter((c) => !c.ok).map((c) => c.name).join(", ") || "no check"}`);
  }
  if (rows.length) await batchAll(deps.filings, insertRows(
    "INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)", 16, rows, "ON CONFLICT DO NOTHING"));
  return { rows: rows.length, note: notes.length ? `; ${notes.join("; ")}` : "" };
}

/** D90: full-year P&L from a March-quarter (fiscal-year-end) file's year-to-date context, loaded only when its own
 *  identities pass and FY ÷ quarter of the core line is plausible (1–12×). Same filing, disclosed_at and basis. */
export async function loadFy(inst: XbrlInstance, q: CanonicalResult, sid: number, disclosedAt: string, filingId: number, deps: Deps): Promise<{ rows: number; note: string }> {
  if (q.periodKind !== "Q") return { rows: 0, note: "" };
  const fyStart = inst.facts.find((x) => /:DateOfStartOfFinancialYear$/.test(x.tag))?.value ?? null;
  if (!fyStart || months(fyStart, q.periodEnd) !== 12) return { rows: 0, note: "" };
  let fy: CanonicalResult;
  // C4-for-year switch on after its census: 2,829 more FY files, 0 newly failing
  try { fy = canonicalResult(inst, { span: "ytd", undefinedYtd: true }); } catch (e) { return { rows: 0, note: `; FY not loaded: ${String(e).slice(0, 60)}` }; }
  if (fy.periodKind !== "FY" || fy.template !== q.template) return { rows: 0, note: "; FY not loaded: year-to-date context is not a full year" };
  const core = CORE[fy.template];
  if (core.some((k) => fy.lines[k] === undefined)) return { rows: 0, note: `; FY not loaded: missing ${core.filter((k) => fy.lines[k] === undefined).join(",")}` };
  if (fy.checks.length < 2 || fy.checks.some((c) => !c.ok)) return { rows: 0, note: `; FY not loaded: ${fy.checks.filter((c) => !c.ok).map((c) => c.name).join(", ") || "too few checks"}` };
  const qv = Number(q.lines[core[0]!]), fv = Number(fy.lines[core[0]!]);
  if (qv > 0 && fv > 0 && (fv / qv < 1 || fv / qv > 12)) return { rows: 0, note: `; FY not loaded: FY ÷ quarter ${(fv / qv).toFixed(2)}` };
  const rows = Object.entries(fy.lines).map(([line, value]) => [sid, TEMPLATE[fy.template], "pl", line, "", fy.periodEnd, "FY", fy.basis, "original", value, null, disclosedAt, filingId, line, "reported", "results-fy-v1"]);
  await batchAll(deps.filings, insertRows(
    "INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)", 16, rows, "ON CONFLICT DO NOTHING"));
  await versionPeriod(deps.filings, sid, fy.periodEnd, "FY", fy.basis);
  return { rows: rows.length, note: `; ${fy.label} loaded` };
}

/** One-off backfill: balance sheet + cash flow, and full-year figures (D90), for results files loaded before those
 *  readers (cursor by job_id; one read of each file serves both). */
export async function backfillBsCf(deps: Deps, limit = 200, budgetMs = 45_000): Promise<{ after: number; done: boolean; rows: number } | null> {
  const [st] = await deps.filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='bscf_backfill'");
  const cur = st ? JSON.parse(st.detail) as { after: number; done: boolean; rows: number; stuck?: number; tries?: number; skipped?: number[] } : { after: 0, done: false, rows: 0 };
  if (cur.done) return null;
  const t0 = Date.now();
  const save = () => deps.filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','bscf_backfill',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  const jobs = await deps.filings.all<{ job_id: number; r2_key: string; url: string; kind: string }>(
    `SELECT j.job_id, j.r2_key, j.url, j.kind FROM fin_load l JOIN fetch_job j ON j.job_id = l.job_id
     WHERE l.status='loaded' AND l.job_id > ? AND j.kind IN (${RESULT_KINDS.map(() => "?").join(",")})${focusSql(deps).sql} ORDER BY l.job_id LIMIT ?`, [cur.after, ...RESULT_KINDS, ...focusSql(deps).params, limit]);
  let n = 0, complete = true;
  for (const j of jobs) {
    // C48: the position was saved only after the whole batch, so a run cut off by its time limit redid the same files
    // forever. Now: a time budget, the position saved every 10 files, and a storage read error pauses here (retried next
    // run) instead of failing the run; after 3 runs stuck on the same file it is skipped and listed.
    if (Date.now() - t0 > budgetMs) { complete = false; break; }
    let xml: string | null;
    try { xml = await deps.getText(j.r2_key); } catch {
      cur.tries = cur.stuck === j.job_id ? (cur.tries ?? 0) + 1 : 1; cur.stuck = j.job_id;
      if (cur.tries < 3) { complete = false; break; }
      (cur.skipped ??= []).push(j.job_id); xml = null;
    }
    if (xml) {
      const [f] = await deps.filings.all<{ filing_id: number; security_id: number; basis: string; disclosed_at: string }>("SELECT filing_id, security_id, basis, disclosed_at FROM filing WHERE kind=? AND source_url=?", [j.kind.replace(/^xbrl_/, ""), j.url]);
      if (f) {
        try {
          const inst = parseXbrl(xml);
          const r = canonicalResult(inst);
          cur.rows += (await loadBsCf(inst, f.security_id, TEMPLATE[r.template], f.basis, f.disclosed_at, f.filing_id, deps)).rows;
          cur.rows += (await loadFy(inst, r, f.security_id, f.disclosed_at, f.filing_id, deps)).rows;
        } catch { /* unreadable: already counted by the main loader */ }
      }
    }
    cur.after = j.job_id; delete cur.stuck; delete cur.tries;
    if (++n % 10 === 0) await save();
  }
  cur.done = complete && jobs.length < limit;
  await save();
  return { after: cur.after, done: cur.done, rows: cur.rows };
}

export async function loadBatch(deps: Deps, limit = 150, parallel = 8): Promise<LoadOutcome[]> {
  // C43: a 'skipped' job (symbol not in market identity yet) is retried at most every 6 hours. Retrying it on every
  // run filled the whole batch with the same ~300 skipped jobs, so new files and the BS/CF backfill stopped.
  // C45: scale-guard holds are re-checked on the same 6-hour cycle. Backlog files load in download order and in
  // parallel, so a hold was judged before its neighbouring periods were on record (ABCAPITAL: 5 post-merger quarters
  // all held against pre-merger values). Re-checked with the full neighbourhood, an isolated outlier (a unit error)
  // stays held; a lasting change loads and is still flagged by the series audit (/audit).
  // C48: a storage read error ("Error: get: …cloudflarestatus") is temporary: retried on the same cycle.
  const retryBefore = new Date(deps.now().getTime() - 6 * 3600_000).toISOString();
  const kinds = [...RESULT_KINDS, ...SHP_KINDS];
  const marks = kinds.map(() => "?").join(",");
  const jobs = await deps.filings.all<{ job_id: number; kind: string; symbol: string | null; url: string; r2_key: string; parent_key: string | null }>(
    `SELECT j.job_id, j.kind, j.symbol, j.url, j.r2_key, p.r2_key AS parent_key FROM fetch_job j LEFT JOIN fetch_job p ON p.job_id = j.parent_id
     WHERE j.status='done' AND j.kind IN (${marks})${focusSql(deps).sql} AND NOT EXISTS (SELECT 1 FROM fin_load l WHERE l.job_id = j.job_id AND ((l.status <> 'skipped' AND NOT (l.status = 'review' AND substr(l.detail, 1, 12) = 'scale guard:') AND NOT (l.status = 'failed' AND (substr(l.detail, 1, 11) = 'Error: get:' OR substr(l.detail, 1, 29) = 'Error: Network connection lo'))) OR l.at > ?))
     ORDER BY j.job_id LIMIT ?`, [...kinds, ...focusSql(deps).params, retryBefore, limit]);
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
