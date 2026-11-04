// M2 results loader: canonical results from XBRL kept in R2 (D132) -> filings.filing + fin_value.
// FMEA: B5 basis in every key; B6 period from the filing's own dates; B7 scale guard vs own history;
// B8 version 'original' (never overwritten); B9 unknown layout / failed checks -> review, nothing loaded.
import { type CanonicalResult, statementDetail, type Sql, type XbrlInstance, balanceAndCash, batchAll, byKindAfter, markFresh, canonicalResult, dec, div, insertRows, parseShareholding, parseXbrl, toText } from "@disclo/core";

export interface Deps {
  filings: Sql;
  market: Sql;
  getText(key: string): Promise<string | null>; // R2 read, gzip-aware
  bscf?: boolean; // M2 balance sheet + cash flow loading (off until the census confirms pass rates, D134)
  now: () => Date;
  /** D155: load only these NSE symbols' filings (all symbols a focus security has had); undefined = everything. */
  focus?: string[];
  /** D168 coverage floor (default COVERAGE_FLOOR); a reader test of old-format files sets an earlier one. */
  floor?: string;
  /** P1: wall-clock deadline (ms since epoch) for this run; no new file is started after it. */
  deadline?: number;
}
/** SQL fragment + params restricting fetch_job rows aliased `j` to the focus symbols (one JSON parameter, D1-safe). */
const focusSql = (deps: Deps) => (deps.focus ? { sql: " AND j.symbol IN (SELECT value FROM json_each(?))", params: [JSON.stringify(deps.focus)] } : { sql: "", params: [] as unknown[] });

/** D168 (owner #344): missing financial statements are chased only from this date (periods ending on/after it). */
export const COVERAGE_FLOOR = "2024-01-01";
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

/** Owner #334: NSE's submission type ("Original" / "Revision") and revision remark for the list row linking this file. */
export function submissionFor(listJson: string, url: string): { submission: string | null; remark: string | null } {
  let rows: Record<string, unknown>[] = [];
  try { const d = JSON.parse(listJson); rows = Array.isArray(d) ? d : (d.data ?? []); } catch { return { submission: null, remark: null }; }
  const row = rows.find((r) => JSON.stringify(r).includes(url));
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null);
  return { submission: str(row?.type_Sub ?? row?.typeOfSubmission), remark: str(row?.revision_Remark ?? row?.revisionRemark) };
}

/** One-off (owner #334): fill submission type and revision remark of already-loaded filings from their stored lists. */
/** P1: started explicitly (POST /maint/remark_backfill), one bounded batch per call, focus companies only (D161), lists by
 *  (kind, job_id) ranges; each UPDATE is one ix_filing_source_url lookup (it scanned every filing before index 0034). */
export const SQL_REMARK_LISTS = "SELECT job_id, symbol, r2_key FROM fetch_job WHERE kind = ? AND job_id > ? ORDER BY job_id LIMIT ?";
export async function remarkBackfill(db: Sql, getText: (k: string) => Promise<string | null>, limit = 10, focus?: string[]): Promise<{ after: number; done: boolean; updated: number } | null> {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='remark_backfill'");
  const cur = st ? JSON.parse(st.detail) as { after: number; done: boolean; updated: number } : { after: 0, done: false, updated: 0 };
  if (cur.done) return null;
  const lists = await byKindAfter<{ job_id: number; symbol: string | null; r2_key: string }>(db, SQL_REMARK_LISTS, ["integrated_financials", "results_quarterly", "results_annual"], cur.after, limit);
  const f = focus ? new Set(focus) : null;
  const stmts: { sql: string; params: unknown[] }[] = [];
  for (const l of lists) {
    if (f && !(l.symbol && f.has(l.symbol))) continue;
    const text = await getText(l.r2_key).catch(() => null);
    if (!text) continue;
    let rows: Record<string, unknown>[] = [];
    try { const d = JSON.parse(text); rows = Array.isArray(d) ? d : (d.data ?? []); } catch { continue; }
    for (const r of rows) {
      const sub = typeof (r.type_Sub ?? r.typeOfSubmission) === "string" ? String(r.type_Sub ?? r.typeOfSubmission).trim() : "";
      const rem = typeof (r.revision_Remark ?? r.revisionRemark) === "string" ? String(r.revision_Remark ?? r.revisionRemark).trim().slice(0, 500) : "";
      if (!sub && !rem) continue;
      for (const u of JSON.stringify(r).match(/https:\/\/nsearchives\.nseindia\.com\/corporate\/[^"\s\\]+?\.xml/gi) ?? [])
        stmts.push({ sql: "UPDATE filing SET submission=coalesce(submission, ?), revision_remark=coalesce(revision_remark, ?) WHERE source_url=?", params: [sub || null, rem || null, u] });
    }
  }
  if (stmts.length) await batchAll(db, stmts, 200);
  const next = { after: lists.length ? lists[lists.length - 1]!.job_id : cur.after, done: lists.length < limit, updated: cur.updated + stmts.length };
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','remark_backfill',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(next)]);
  return next;
}

const TEMPLATE: Record<CanonicalResult["template"], string> = { industrial: "industrial", bank: "bank", life_insurance: "insurance", general_insurance: "insurance" }; // life and general share the stored value; their line names differ
const CORE: Record<CanonicalResult["template"], string[]> = { industrial: ["revenue", "pat"], bank: ["interest_earned", "pat"], life_insurance: ["gross_premium", "pat"], general_insurance: ["gross_premium", "pat"] };

export interface LoadOutcome { jobId: number; status: "loaded" | "review" | "skipped" | "failed" | "excluded"; detail: string; rows?: number;
  /** Rows offered to the tables (per statement / 'shareholding') and whether the filing row was new — for the cached
   *  /status counters (audit P1; approximate only when a file is re-read). */
  counts?: Record<string, number>;
  /** Disclosure time of a loaded file (feed freshness watermark, work list item 1). */
  newest?: string }

/** Shareholding pattern (FMEA B3, B4, C1–C3): loaded only when the top-level categories sum exactly to total shares. */
/** Security of a file. Order (C61, work list item 2): (1) the ISIN written in the file, when the market identity knows it;
 *  (2) the company whose NSE list linked the file — lists are per company, so the linking company is the filer;
 *  (3) the symbol written in the file. The file's symbol is the least reliable: files filed before a rename carry the
 *  old symbol (ADANITRANS, LTI, SRTRANSFIN, MOTHERSUMI …; 79 gaps in 9 companies, owner #343), and a filer can type
 *  another company's symbol (COFORGE Q3 FY26 filed with Symbol NUCLEUS, its own ISIN and BSE code — stored under
 *  Nucleus Software until this fix). */
const SQL_SEC_BY = (idType: "nse_symbol" | "isin") => `SELECT security_id FROM security_identifier WHERE id_type='${idType}' AND value=? ORDER BY valid_to IS NULL DESC, valid_from DESC LIMIT 1`;
async function securityFor(deps: Deps, fileSymbol: string | null | undefined, listSymbol: string | null, isin?: string | null): Promise<{ security_id: number } | undefined> {
  const tries: ["nse_symbol" | "isin", string | null | undefined][] = [["isin", isin], ["nse_symbol", listSymbol], ["nse_symbol", fileSymbol]];
  for (const [t, v] of tries) {
    if (!v) continue;
    const [sec] = await deps.market.all<{ security_id: number }>(SQL_SEC_BY(t), [v]);
    if (sec) return sec;
  }
  return undefined;
}
const fileIsin = (inst: XbrlInstance) => inst.facts.find((f) => /:ISIN$/.test(f.tag) && /^IN[A-Z0-9]{10}$/.test(f.value ?? ""))?.value ?? null;

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
  const head = r ?? (() => { try { return parseShareholding(inst, { totalOverride: 1 }); } catch { return null; } })();
  const floor = deps.floor ?? COVERAGE_FLOOR;
  if (head?.asOf && head.asOf < floor) return { jobId: job.job_id, status: "excluded", detail: `as of ${head.asOf}, before the ${floor} coverage floor (D168)` };
  const symbol = head?.symbol ?? job.symbol;
  const sec = await securityFor(deps, symbol, job.symbol, fileIsin(inst));
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
  const ins = await deps.filings.run(
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
  return { jobId: job.job_id, status: "loaded", detail: `shareholding ${r.asOf}${note ? `; ${note}` : ""}`, rows: rows.length + 1, counts: { "filing:shareholding": ins.changes ? 1 : 0, shareholding: rows.length }, newest: disclosedAt };
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
  // D168 (owner #344): statements before 2024-01-01 are not chased — a file for an earlier period that is not loaded yet
  // (new, or retried after a skip, hold or error) is excluded for good; files already loaded stay as they are
  const floor = deps.floor ?? COVERAGE_FLOOR;
  if (r.periodEnd < floor) return { jobId: job.job_id, status: "excluded", detail: `period ${r.periodEnd} before the ${floor} coverage floor (D168)` };
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
  const sec = await securityFor(deps, symbol, job.symbol, fileIsin(inst));
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

  const sub = submissionFor(listCache.get(job.parent_key!) ?? "", job.url);
  const ins = await deps.filings.run(
    `INSERT INTO filing (security_id, kind, period_end, period_kind, basis, disclosed_at, source_url, status, submission, revision_remark) VALUES (?,?,?,?,?,?,?,'loaded',?,?)
     ON CONFLICT (kind, source_url) DO NOTHING`,
    [sec.security_id, job.kind.replace(/^xbrl_/, ""), r.periodEnd, r.periodKind, r.basis, disclosedAt, job.url, sub.submission, sub.remark]);
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
  const qh = await loadQuarterOfHalf(inst!, r, sec.security_id, disclosedAt, f!.filing_id, deps);
  return { jobId: job.job_id, status: "loaded", detail: `${r.label} ${r.basis} ${r.template}${onlyBreakdown ? " (expense breakdown not in filing)" : ""}${extra.note}${fyx.note}${qh.note}`, rows: rows.length + extra.rows + fyx.rows + qh.rows, counts: { "filing:results": ins.changes ? 1 : 0, pl: rows.length + fyx.rows + qh.rows, bs: extra.by?.bs ?? 0, cf: extra.by?.cf ?? 0 }, newest: disclosedAt };
}

/** D48: for one company, period and basis, the earliest disclosure is 'original' and every later one 'restated'
 *  (labels corrected in both directions, since files load in download order). Differences > 0.5% (and > ₹1 lakh) on
 *  any line between the original and a restatement are recorded in restatement_flag (owner #334: every line).
 *  P0 (audit 4 Nov): ONE read through ix_fin_value_period (the PK serves only security_id here, so each of the six
 *  former statements read the company's whole fin_value); writes only rows whose label or flag actually changes. */
export const SQL_VERSION_ROWS = "SELECT statement, line, dims, version, value, disclosed_at FROM fin_value WHERE security_id=? AND period_end=? AND period_kind=? AND basis=?";
const FIN_PK = "security_id=? AND statement=? AND line=? AND dims=? AND period_end=? AND period_kind=? AND basis=? AND version=? AND disclosed_at=?";
export async function versionPeriod(db: Sql, sid: number, periodEnd: string, periodKind: string, basis: string): Promise<number> {
  const all = await db.all<{ statement: string; line: string; dims: string; version: string; value: string | null; disclosed_at: string }>(SQL_VERSION_ROWS, [sid, periodEnd, periodKind, basis]);
  if (!all.length) return 0;
  let first = all[0]!.disclosed_at;
  for (const r of all) if (r.disclosed_at < first) first = r.disclosed_at;
  if (all.every((r) => r.disclosed_at === first) && all.every((r) => r.version === "original")) return 0; // one filing: nothing to do
  // Version is part of the key: a filing re-written after an earlier pass can hold the same figure under both labels
  // (4 Nov: UNIQUE constraint). Relabel where no twin exists, else drop the mislabelled copy (derived rows only).
  const key = (r: { statement: string; line: string; dims: string; disclosed_at: string }, v: string) => `${r.statement}|${r.line}|${r.dims}|${r.disclosed_at}|${v}`;
  const have = new Set(all.map((r) => key(r, r.version)));
  const stmts: { sql: string; params: unknown[] }[] = [];
  const kept: typeof all = [];
  for (const r of all) {
    const want = r.disclosed_at === first ? (r.version !== "original" ? "original" : null) : (r.version === "original" ? "restated" : null);
    const pk = [sid, r.statement, r.line, r.dims, periodEnd, periodKind, basis, r.version, r.disclosed_at];
    if (!want) { kept.push(r); continue; }
    if (have.has(key(r, want))) { stmts.push({ sql: `DELETE FROM fin_value WHERE ${FIN_PK}`, params: pk }); continue; } // twin with the right label exists
    stmts.push({ sql: `UPDATE fin_value SET version=? WHERE ${FIN_PK}`, params: [want, ...pk] });
    have.add(key(r, want)); kept.push({ ...r, version: want });
  }
  // flags: every line without dimensions, each later disclosure against the first one
  const vals = kept.filter((v) => v.dims === "").sort((x, y) => (x.disclosed_at < y.disclosed_at ? -1 : x.disclosed_at > y.disclosed_at ? 1 : 0));
  const orig = new Map<string, { value: string | null; at: string }>();
  for (const v of vals) { const k = `${v.statement}|${v.line}`; if (!orig.has(k)) orig.set(k, { value: v.value, at: v.disclosed_at }); }
  const flags: unknown[][] = [];
  const seen = new Set<string>();
  for (const v of vals) {
    const o = orig.get(`${v.statement}|${v.line}`)!;
    if (v.disclosed_at === o.at || v.value === null || o.value === null || Number(o.value) === 0) continue;
    const fk = `${v.statement}|${v.line}|${v.disclosed_at}`;
    if (seen.has(fk)) continue; seen.add(fk);
    const diff = Number(v.value) - Number(o.value), pct = diff / Math.abs(Number(o.value));
    if (Math.abs(pct) > 0.005 && Math.abs(diff) > 1e5) flags.push([sid, v.statement, v.line, periodEnd, periodKind, basis, o.value, v.value, (pct * 100).toFixed(2), o.at, v.disclosed_at]);
  }
  // C33: an unchanged flag is not rewritten (was INSERT OR REPLACE: a delete + insert, billed, on every pass)
  stmts.push(...insertRows("INSERT INTO restatement_flag (security_id,statement,line,period_end,period_kind,basis,original_value,restated_value,change_pct,original_at,restated_at)", 11, flags,
    `ON CONFLICT (security_id,statement,line,period_end,period_kind,basis,restated_at) DO UPDATE SET original_value=excluded.original_value, restated_value=excluded.restated_value,
     change_pct=excluded.change_pct, original_at=excluded.original_at
     WHERE restatement_flag.original_value IS NOT excluded.original_value OR restatement_flag.restated_value IS NOT excluded.restated_value
        OR restatement_flag.change_pct IS NOT excluded.change_pct OR restatement_flag.original_at IS NOT excluded.original_at`));
  if (stmts.length) await batchAll(db, stmts);
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
  // every period kind stored at that date (quarter P&L, half-year / nine-month / full-year balance sheet and cash flow)
  // P1: position saved after every group (was: only after the batch, so a failing batch was redone forever)
  const save = (n: { after: string; done: boolean; groups: number }) => db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','version_backfill',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(n)]);
  let done = 0;
  for (const x of g) {
    for (const k of new Set([x.period_kind, "Q", "H", "9M", "FY"])) await versionPeriod(db, x.security_id, x.period_end, k, x.basis);
    done++;
    await save({ after: x.k, done: false, groups: cur.groups + done });
  }
  const next = { after: g.length ? g[g.length - 1]!.k : cur.after, done: g.length < limit, groups: cur.groups + g.length };
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','version_backfill',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(next)]);
  return next;
}

/** Owner #343: the version pass for the focus companies only, one company at a time (its periods filed more than once,
 *  found through ix_filing_sec: a few hundred rows per company), `perCall` companies per call, position saved after
 *  each company ('once','version_backfill_focus'). Replaces the GROUP BY over all of filing on every call. */
export async function versionBackfillFocus(db: Sql, focusSids: number[], perCall = 5): Promise<{ after: number; done: boolean; companies: number; groups: number }> {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='version_backfill_focus'");
  const cur = st ? JSON.parse(st.detail) as { after: number; done: boolean; companies: number; groups: number } : { after: 0, done: false, companies: 0, groups: 0 };
  if (cur.done) return cur;
  const todo = [...new Set(focusSids)].sort((a, b) => a - b).filter((x) => x > cur.after);
  for (const sid of todo.slice(0, perCall)) {
    const g = await db.all<{ period_end: string; period_kind: string; basis: string }>(
      "SELECT period_end, period_kind, basis FROM filing WHERE security_id=? AND kind <> 'shareholding' GROUP BY period_end, period_kind, basis HAVING count(*) > 1", [sid]);
    for (const x of g) for (const k of new Set([x.period_kind, "Q", "H", "9M", "FY"])) await versionPeriod(db, sid, x.period_end, k, x.basis);
    cur.after = sid; cur.companies++; cur.groups += g.length;
    await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','version_backfill_focus',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  }
  cur.done = todo.length <= perCall;
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','version_backfill_focus',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  return cur;
}

const months = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1;
const ytdKind = (start: string, end: string) => ({ 3: "Q", 6: "H", 9: "9M", 12: "FY" } as Record<number, string>)[months(start, end)] ?? null;
/** M2: balance sheet + cash flow rows, each statement only when all of its own checks pass (else noted, not loaded). */
export async function loadBsCf(inst: XbrlInstance, sid: number, template: string, basis: string, disclosedAt: string, filingId: number, deps: Deps): Promise<{ rows: number; note: string; by?: { bs: number; cf: number } }> {
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
  // owner #334: version + flag the balance-sheet / cash-flow periods too, after their rows exist (H and 9M periods
  // were never checked, and Q/FY were checked before these rows were written)
  const periods = new Set(rows.map((r) => `${r[5]}|${r[6]}`));
  for (const pk of periods) { const [end, k] = pk.split("|"); await versionPeriod(deps.filings, sid, end!, k!, basis); }
  return { rows: rows.length, note: notes.length ? `; ${notes.join("; ")}` : "", by: { bs: rows.filter((r) => r[2] === "bs").length, cf: rows.filter((r) => r[2] === "cf").length } };
}

/** D90: full-year P&L from a March-quarter (fiscal-year-end) file's year-to-date context, loaded only when its own
 *  identities pass and FY ÷ quarter of the core line is plausible (1–12×). Same filing, disclosed_at and basis. */
export async function loadFy(inst: XbrlInstance, q: CanonicalResult, sid: number, disclosedAt: string, filingId: number, deps: Deps): Promise<{ rows: number; note: string }> {
  // D169: a half-year file ending at the year end (H2, no 3-month column) carries the full year too
  if (q.periodKind !== "Q" && q.periodKind !== "H") return { rows: 0, note: "" };
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
  if (qv > 0 && fv > 0 && (fv / qv < 1 || fv / qv > 12)) return { rows: 0, note: `; FY not loaded: FY ÷ ${q.periodKind === "H" ? "half-year" : "quarter"} ${(fv / qv).toFixed(2)}` };
  const rows = Object.entries(fy.lines).map(([line, value]) => [sid, TEMPLATE[fy.template], "pl", line, "", fy.periodEnd, "FY", fy.basis, "original", value, null, disclosedAt, filingId, line, "reported", "results-fy-v1"]);
  await batchAll(deps.filings, insertRows(
    "INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)", 16, rows, "ON CONFLICT DO NOTHING"));
  await versionPeriod(deps.filings, sid, fy.periodEnd, "FY", fy.basis);
  return { rows: rows.length, note: `; ${fy.label} loaded` };
}

const ymd = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** First day of the quarter ending at `end`, and the end of the quarter before it (period ends are month ends). */
export function quarterBounds(end: string): { start: string; prevEnd: string } {
  const y = Number(end.slice(0, 4)), m = Number(end.slice(5, 7));
  const sm = m - 2, sy = sm < 1 ? y - 1 : y, smm = sm < 1 ? sm + 12 : sm;
  const pm = m - 3, py = pm < 1 ? y - 1 : y, pmm = pm < 1 ? pm + 12 : pm;
  return { start: ymd(sy, smm, 1), prevEnd: ymd(py, pmm, new Date(Date.UTC(py, pmm, 0)).getUTCDate()) };
}
export const SQL_Q_EXISTS = "SELECT 1 AS x FROM fin_value INDEXED BY ix_fin_value_period WHERE security_id=? AND period_end=? AND period_kind='Q' AND basis=? AND statement='pl' LIMIT 1";

/** D169 (work list item 2, owner #345): some filers submit the second or fourth quarter as a half-year file
 *  (reporting period 6 months). The quarter is loaded only when the file itself carries a dimension-free 3-month
 *  column (origin 'reported'). It is NEVER derived from the half-year (half-year minus the previous quarter is not a
 *  filed figure, owner #345): without that column the quarter stays empty. Nothing is written when a quarter for that
 *  period is already stored. */
export async function loadQuarterOfHalf(inst: XbrlInstance, h: CanonicalResult, sid: number, disclosedAt: string, filingId: number, deps: Deps): Promise<{ rows: number; note: string }> {
  if (h.periodKind !== "H") return { rows: 0, note: "" };
  const { start } = quarterBounds(h.periodEnd);
  if ((await deps.filings.all(SQL_Q_EXISTS, [sid, h.periodEnd, h.basis])).length) return { rows: 0, note: "" };
  const insert = (rows: unknown[][]) => batchAll(deps.filings, insertRows(
    "INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)", 16, rows, "ON CONFLICT DO NOTHING"));
  const core = CORE[h.template];
  // (a) the quarter's own column, when the file has one
  let q: CanonicalResult | null = null;
  try { q = canonicalResult(inst, { periodStart: start }); } catch { q = null; }
  if (q && q.periodKind === "Q" && q.template === h.template && core.every((k) => q!.lines[k] !== undefined) && q.checks.length >= 2 && q.checks.every((c) => c.ok)) {
    const rows = Object.entries(q.lines).map(([line, value]) => [sid, TEMPLATE[q!.template], "pl", line, "", q!.periodEnd, "Q", q!.basis, "original", value, null, disclosedAt, filingId, line, "reported", "results-q-in-h-v1"]);
    await insert(rows);
    return { rows: rows.length, note: `; ${q.label} loaded from its own column` };
  }
  return { rows: 0, note: "; no 3-month column in this half-year file: quarter not loaded (never derived, D169)" };
}

/** D169 one-off for the active "loaded, but under another period or basis" gaps (from the D168 floor): re-reads each
 *  gap's half-year file and adds its quarter and (at the year end) its full year. Bounded: coverage_gap is small;
 *  per gap one indexed filing lookup, one fetch_job lookup and one R2 read. */
export async function halfYearGaps(deps: Deps, floor = COVERAGE_FLOOR): Promise<{ gaps: number; files: number; rows: number; sids: number[]; notes: string[] }> {
  const gaps = await deps.filings.all<{ security_id: number; period_end: string; basis: string }>(
    "SELECT security_id, period_end, basis FROM coverage_gap WHERE status = 'loaded, but under another period or basis' AND period_end >= ?", [floor]);
  let files = 0, rows = 0;
  const notes: string[] = [];
  for (const g of gaps) {
    const fs = await deps.filings.all<{ filing_id: number; kind: string; source_url: string; disclosed_at: string }>(
      "SELECT filing_id, kind, source_url, disclosed_at FROM filing WHERE security_id=? AND period_end=? AND period_kind='H' AND basis=?", [g.security_id, g.period_end, g.basis]);
    for (const f of fs) {
      const [j] = await deps.filings.all<{ r2_key: string }>("SELECT r2_key FROM fetch_job WHERE url=?", [f.source_url]);
      const xml = j?.r2_key ? await deps.getText(j.r2_key) : null;
      if (!xml) { notes.push(`${g.security_id} ${g.period_end} ${g.basis}: file not stored`); continue; }
      files++;
      try {
        const inst = parseXbrl(xml);
        const h = canonicalResult(inst);
        const a = await loadQuarterOfHalf(inst, h, g.security_id, f.disclosed_at, f.filing_id, deps);
        const b = await loadFy(inst, h, g.security_id, f.disclosed_at, f.filing_id, deps);
        rows += a.rows + b.rows;
        notes.push(`${g.security_id} ${g.period_end} ${g.basis}:${a.note || " quarter already stored"}${b.note}`);
      } catch (e) { notes.push(`${g.security_id} ${g.period_end} ${g.basis}: ${String(e).slice(0, 80)}`); }
    }
    if (!fs.length) notes.push(`${g.security_id} ${g.period_end} ${g.basis}: no half-year filing at this date`);
  }
  return { gaps: gaps.length, files, rows, sids: [...new Set(gaps.map((g) => g.security_id))], notes };
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

/** P0 (audit 4 Nov): file selection no longer reads every 'done' row of fetch_job (~300k per run, 2.6 B a month even
 *  when idle). New files: a job_id cursor per loadable kind over ix_fetch_kind_job ('once','loader_cursor'), which
 *  stops before the first file not downloaded yet, so nothing is passed over. Retries: due rows of fin_load only
 *  (ix_fin_load_retry), with backoff and a cap. */
export const SQL_LOADER_NEW = `SELECT j.job_id, j.kind, j.symbol, j.url, j.r2_key, j.status, j.attempts, j.http_status, p.r2_key AS parent_key,
     (SELECT l.job_id FROM fin_load l WHERE l.job_id = j.job_id) AS seen
   FROM fetch_job j LEFT JOIN fetch_job p ON p.job_id = j.parent_id
   WHERE j.kind = ? AND j.job_id > ? ORDER BY j.job_id LIMIT ?`;
export const SQL_LOADER_RETRY = `SELECT l.job_id, l.tries, l.status AS prior, j.kind, j.symbol, j.url, j.r2_key, p.r2_key AS parent_key
   FROM fin_load l JOIN fetch_job j ON j.job_id = l.job_id LEFT JOIN fetch_job p ON p.job_id = j.parent_id
   WHERE l.retry_after IS NOT NULL AND l.retry_after <= ? ORDER BY l.retry_after LIMIT ?`;
/** C43/C45/C48/C50 retryable outcomes: identity not there yet, a scale-guard hold (re-judged with more neighbours),
 *  an infrastructure error. Retried after 6 h, 12 h, 24 h … (doubling), at most MAX_TRIES outcomes in all (~32 days). */
export const MAX_TRIES = 8;
const retryable = (o: LoadOutcome) => o.status === "skipped" || (o.status === "review" && o.detail.startsWith("scale guard:")) || (o.status === "failed" && o.detail.startsWith("Error: "));
/** A download in a final state: done, empty, or failed with no more GitHub retries (attempts >= 3 or a 404). */
const settled = (j: { status: string; attempts: number; http_status: number | null }) => j.status === "done" || j.status === "empty" || (j.status === "failed" && (j.attempts >= 3 || j.http_status === 404));

/** Short fingerprint of a focus list (order-free): count + FNV-1a of the sorted symbols; "all" when unrestricted. */
export function focusPrint(focus?: string[]): string {
  if (!focus) return "all";
  let h = 0x811c9dc5;
  for (const ch of [...focus].sort().join(",")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${focus.length}:${h.toString(16)}`;
}

export async function loadBatch(deps: Deps, limit = 150, parallel = 8, scan = 2000): Promise<LoadOutcome[]> {
  type Job = { job_id: number; kind: string; symbol: string | null; url: string; r2_key: string; parent_key: string | null; tries: number; prior?: string | null };
  const kinds = [...RESULT_KINDS, ...SHP_KINDS];
  const focus = deps.focus ? new Set(deps.focus) : null;
  const [st] = await deps.filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='loader_cursor'");
  // The cursor belongs to one focus list: when it changes (index rebalance, D155 widening), files passed over as
  // outside the focus must be looked at again, so the walk restarts from the beginning (a few thousand rows a run).
  const fp = focusPrint(deps.focus);
  const saved = st ? JSON.parse(st.detail) as { after: number; focus?: string } : null;
  const cur = saved && saved.focus === fp ? saved : { after: 0, focus: fp };
  // 1. New files (C43: before retries).
  const rows = await byKindAfter<Job & { status: string; attempts: number; http_status: number | null; seen: number | null }>(deps.filings, SQL_LOADER_NEW, kinds, cur.after, scan);
  const jobs: Job[] = [];
  let after = cur.after, blocked = false;
  for (const r of rows) {
    const ours = !focus || (!!r.symbol && focus.has(r.symbol));
    const pending = ours && !settled(r);
    if (ours && r.status === "done" && r.seen === null) {
      if (jobs.length >= limit) break; // the cursor stops before the first file not taken this run
      jobs.push({ ...r, tries: 0, prior: null });
    }
    if (pending) blocked = true; // not downloaded yet: later files may load, the cursor waits here
    if (!blocked) after = r.job_id;
  }
  if (!blocked && rows.length < scan && jobs.length < limit && rows.length) after = rows[rows.length - 1]!.job_id;
  // 2. Retries that are due, with what is left of the batch.
  if (jobs.length < limit) {
    const due = await deps.filings.all<Job>(SQL_LOADER_RETRY, [deps.now().toISOString(), limit - jobs.length]);
    for (const r of due) if (!focus || (!!r.symbol && focus.has(r.symbol))) jobs.push(r);
  }
  const cache = new Map<string, string | null>();
  const out: LoadOutcome[] = [];
  const delta: Record<string, number> = {};
  const fresh: Record<string, { newest: string; rows: number }> = {};
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      if (deps.deadline && Date.now() > deps.deadline) break; // P1 run budget: the rest waits for the next run
      const j = jobs[i++]!;
      let o: LoadOutcome;
      try { o = SHP_KINDS.includes(j.kind) ? await loadShp(j, deps, cache) : await loadOne(j, deps, cache); } catch (e) { o = { jobId: j.job_id, status: "failed", detail: String(e).slice(0, 200) }; }
      out.push(o);
      delta[`fin_load:${o.status}`] = (delta[`fin_load:${o.status}`] ?? 0) + 1;
      if (j.prior) delta[`fin_load:${j.prior}`] = (delta[`fin_load:${j.prior}`] ?? 0) - 1;
      if (o.status === "loaded" && o.newest) { const f = SHP_KINDS.includes(j.kind) ? "shareholding" : "results"; const w = fresh[f] ??= { newest: o.newest, rows: 0 }; w.rows++; if (o.newest > w.newest) w.newest = o.newest; }
      for (const [k, n] of Object.entries(o.counts ?? {})) if (n) { const key = k.includes(":") ? k : `fin_value:${k}`; delta[key] = (delta[key] ?? 0) + n; }
      const tries = j.tries + 1, now = deps.now();
      const retryAt = retryable(o) && tries < MAX_TRIES ? new Date(now.getTime() + 6 * 3600_000 * 2 ** (tries - 1)).toISOString() : null;
      await deps.filings.run("INSERT INTO fin_load (job_id, status, detail, at, tries, retry_after) VALUES (?,?,?,?,?,?) ON CONFLICT (job_id) DO UPDATE SET status=excluded.status, detail=excluded.detail, at=excluded.at, tries=excluded.tries, retry_after=excluded.retry_after",
        [o.jobId, o.status, o.detail, now.toISOString(), tries, retryAt]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, jobs.length || 1) }, worker)); // jobs are independent files
  // stopped by the deadline: the cursor must not pass a new file that was selected but not read
  const firstLeft = jobs.slice(i).find((j) => !j.prior && j.tries === 0);
  if (firstLeft && firstLeft.job_id <= after) after = firstLeft.job_id - 1;
  // cached counters for /status (audit P1: the page never counts fin_value); one batch per run
  const at = deps.now().toISOString();
  const ups = Object.entries(delta).filter(([, n]) => n).map(([k, n]) => ({ sql: "INSERT INTO stat_counter (name, n, at) VALUES (?,?,?) ON CONFLICT (name) DO UPDATE SET n = n + excluded.n, at = excluded.at", params: [k, n, at] }));
  if (ups.length) await deps.filings.batch(ups);
  for (const [feed, w] of Object.entries(fresh)) await markFresh(deps.filings, feed, w.newest, w.rows, deps.now());
  if (after !== saved?.after || fp !== saved?.focus) await deps.filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','loader_cursor',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [deps.now().toISOString(), JSON.stringify({ after, focus: fp })]);
  return out;
}

/** C61 (work list item 2): filings stored under another company than the focus company whose NSE list linked them — the
 *  loader used to trust the symbol written in the file before the linking company (COFORGE Q3 FY26 filed with Symbol
 *  NUCLEUS). Read-only unless fix: then each such filing and its rows move to the linking company, except when that
 *  company already has rows for the same period and basis (reported as a conflict, nothing moved). */
export const SQL_MISATTR = `SELECT j.symbol, f.filing_id, f.security_id, f.kind, f.period_end, f.period_kind, f.basis
  FROM fetch_job j JOIN filing f ON f.source_url = j.url WHERE j.symbol IN (SELECT value FROM json_each(?)) AND j.kind LIKE 'xbrl_%'`;
export const SQL_MOVE_FIN_VALUE = "UPDATE fin_value SET security_id=? WHERE security_id=? AND filing_id=?";
export async function misattributed(deps: Deps, fix: boolean): Promise<{ done: true; found: number; moved: number; conflicts: number; sids: number[]; items: string[] }> {
  const focus = deps.focus ?? [];
  const ids = await deps.market.all<{ security_id: number; value: string }>(
    "SELECT security_id, value FROM security_identifier WHERE id_type='nse_symbol' AND value IN (SELECT value FROM json_each(?))", [JSON.stringify(focus)]);
  const sidOf = new Map(ids.map((r) => [r.value, r.security_id]));
  const rows = await deps.filings.all<{ symbol: string; filing_id: number; security_id: number; kind: string; period_end: string | null; period_kind: string | null; basis: string | null }>(SQL_MISATTR, [JSON.stringify(focus)]);
  const wrong = rows.filter((r) => sidOf.has(r.symbol) && sidOf.get(r.symbol) !== r.security_id);
  let moved = 0, conflicts = 0;
  const items: string[] = [], sids = new Set<number>();
  for (const w of wrong) {
    const to = sidOf.get(w.symbol)!;
    let tag = "found";
    if (fix) {
      const [clash] = w.period_end ? await deps.filings.all<{ x: number }>(
        "SELECT 1 AS x FROM fin_value WHERE security_id=? AND period_end=? AND period_kind=? AND basis=? AND filing_id<>? LIMIT 1", [to, w.period_end, w.period_kind, w.basis, w.filing_id]) : [];
      if (clash) { conflicts++; tag = "conflict: the company already has this period"; }
      else {
        // fin_value has no filing_id index: bound by the old company (primary-key prefix), else every move reads the
        // whole table (the first COFORGE run read 4.0M rows for 2 filings)
        await batchAll(deps.filings, [
          { sql: SQL_MOVE_FIN_VALUE, params: [to, w.security_id, w.filing_id] },
          ...["filing", "shareholding", "promoter_encumbrance"].map((t) => ({ sql: `UPDATE ${t} SET security_id=? WHERE filing_id=?`, params: [to, w.filing_id] })),
        ]);
        moved++; sids.add(to); tag = "moved";
      }
    }
    items.push(`${w.symbol}: filing ${w.filing_id} ${w.kind} ${w.period_end ?? ""} ${w.period_kind ?? ""} ${w.basis ?? ""} stored under ${w.security_id}, list company ${to} — ${tag}`);
  }
  return { done: true, found: wrong.length, moved, conflicts, sids: [...sids], items: items.slice(0, 60) };
}
