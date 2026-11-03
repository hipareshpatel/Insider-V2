// M2 results loader: canonical results from XBRL kept in R2 (D132) -> filings.filing + fin_value.
// FMEA: B5 basis in every key; B6 period from the filing's own dates; B7 scale guard vs own history;
// B8 version 'original' (never overwritten); B9 unknown layout / failed checks -> review, nothing loaded.
import { type CanonicalResult, type Sql, batchAll, canonicalResult, dec, div, insertRows, parseXbrl, toText } from "@disclo/core";

export interface Deps {
  filings: Sql;
  market: Sql;
  getText(key: string): Promise<string | null>; // R2 read, gzip-aware
  now: () => Date;
}

export const RESULT_KINDS = ["xbrl_results_quarterly", "xbrl_results_annual", "xbrl_integrated_financials"];
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
  for (const k of ["broadcast_Date", "broadCastDate", "exchdisstime", "creation_Date", "revised_Date", "filingDate"]) {
    const t = nseIstToUtc(row[k] as string);
    if (t) return t;
  }
  return null;
}

const TEMPLATE: Record<CanonicalResult["template"], string> = { industrial: "industrial", bank: "bank", life_insurance: "insurance" };
const CORE: Record<CanonicalResult["template"], string[]> = { industrial: ["revenue", "pat"], bank: ["interest_earned", "pat"], life_insurance: ["gross_premium", "pat"] };

export interface LoadOutcome { jobId: number; status: "loaded" | "review" | "skipped" | "failed"; detail: string; rows?: number }

export async function loadOne(job: { job_id: number; kind: string; symbol: string | null; url: string; r2_key: string; parent_key: string | null }, deps: Deps, listCache: Map<string, string | null>): Promise<LoadOutcome> {
  const xml = await deps.getText(job.r2_key);
  if (!xml) return { jobId: job.job_id, status: "failed", detail: "file not in R2" };
  if (!/<\/(?:[\w-]+:)?xbrl>\s*$/.test(xml.trim())) return { jobId: job.job_id, status: "failed", detail: "truncated XML (root not closed)" }; // FMEA B11
  let r: CanonicalResult;
  try { r = canonicalResult(parseXbrl(xml)); } catch (e) { return { jobId: job.job_id, status: "review", detail: `not a supported results file: ${String(e).slice(0, 140)}` }; }
  const missingCore = CORE[r.template].filter((k) => r.lines[k] === undefined);
  if (missingCore.length) return { jobId: job.job_id, status: "review", detail: `${r.template}: core lines missing ${missingCore.join(",")}` };
  const failed = r.checks.filter((c) => !c.ok);
  if (failed.length) return { jobId: job.job_id, status: "review", detail: `checks failed: ${failed.map((c) => `${c.name} (${c.detail})`).join("; ").slice(0, 300)}` };
  if (!r.checks.length) return { jobId: job.job_id, status: "review", detail: "no identity check could run" };

  const symbol = r.symbol ?? job.symbol;
  const [sec] = await deps.market.all<{ security_id: number }>(
    "SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=? ORDER BY valid_to IS NULL DESC, valid_from DESC LIMIT 1", [symbol]);
  if (!sec) return { jobId: job.job_id, status: "skipped", detail: `symbol ${symbol} not in market identity yet` };

  // B7 scale guard: revenue-type core line vs this company's latest earlier value for the same basis and period kind.
  const core = CORE[r.template][0]!;
  const [prev] = await deps.filings.all<{ value: string }>(
    `SELECT value FROM fin_value WHERE security_id=? AND statement='pl' AND line=? AND basis=? AND period_kind=? AND period_end < ? AND value IS NOT NULL
     ORDER BY period_end DESC LIMIT 1`, [sec.security_id, core, r.basis, r.periodKind, r.periodEnd]);
  if (prev && dec(prev.value).units !== 0n && dec(r.lines[core]!).units !== 0n) {
    const ratio = Math.abs(Number(toText(div(dec(r.lines[core]!), dec(prev.value), 6))));
    if (ratio >= 10 || ratio <= 0.1) return { jobId: job.job_id, status: "review", detail: `scale guard: ${core} ${r.lines[core]} vs previous ${prev.value} (×${ratio.toFixed(2)})` };
  }

  if (job.parent_key && !listCache.has(job.parent_key)) listCache.set(job.parent_key, await deps.getText(job.parent_key));
  const disclosedAt = (job.parent_key && broadcastFor(listCache.get(job.parent_key) ?? "", job.url)) ?? null;
  if (!disclosedAt) return { jobId: job.job_id, status: "review", detail: "broadcast time not found in its list (D32 needs disclosed_at)" };

  await deps.filings.run(
    `INSERT INTO filing (security_id, kind, period_end, period_kind, basis, disclosed_at, source_url, status) VALUES (?,?,?,?,?,?,?,'loaded')
     ON CONFLICT (kind, source_url) DO NOTHING`,
    [sec.security_id, job.kind.replace(/^xbrl_/, ""), r.periodEnd, r.periodKind, r.basis, disclosedAt, job.url]);
  const [f] = await deps.filings.all<{ filing_id: number }>("SELECT filing_id FROM filing WHERE kind=? AND source_url=?", [job.kind.replace(/^xbrl_/, ""), job.url]);
  const rows = Object.entries(r.lines).map(([line, value]) => [
    sec.security_id, TEMPLATE[r.template], "pl", line, "", r.periodEnd, r.periodKind, r.basis, "original", value, null, disclosedAt, f!.filing_id, line, "reported", "results-v1",
  ]);
  await batchAll(deps.filings, insertRows(
    "INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)", 16, rows,
    "ON CONFLICT DO NOTHING"));
  return { jobId: job.job_id, status: "loaded", detail: `${r.label} ${r.basis} ${r.template}`, rows: rows.length };
}

export async function loadBatch(deps: Deps, limit = 150): Promise<LoadOutcome[]> {
  const marks = RESULT_KINDS.map(() => "?").join(",");
  const jobs = await deps.filings.all<{ job_id: number; kind: string; symbol: string | null; url: string; r2_key: string; parent_key: string | null }>(
    `SELECT j.job_id, j.kind, j.symbol, j.url, j.r2_key, p.r2_key AS parent_key FROM fetch_job j LEFT JOIN fetch_job p ON p.job_id = j.parent_id
     WHERE j.status='done' AND j.kind IN (${marks}) AND NOT EXISTS (SELECT 1 FROM fin_load l WHERE l.job_id = j.job_id AND l.status <> 'skipped')
     ORDER BY j.job_id LIMIT ?`, [...RESULT_KINDS, limit]);
  const cache = new Map<string, string | null>();
  const out: LoadOutcome[] = [];
  for (const j of jobs) {
    let o: LoadOutcome;
    try { o = await loadOne(j, deps, cache); } catch (e) { o = { jobId: j.job_id, status: "failed", detail: String(e).slice(0, 200) }; }
    out.push(o);
    await deps.filings.run("INSERT INTO fin_load (job_id, status, detail, at) VALUES (?,?,?,?) ON CONFLICT (job_id) DO UPDATE SET status=excluded.status, detail=excluded.detail, at=excluded.at",
      [o.jobId, o.status, o.detail, deps.now().toISOString()]);
  }
  return out;
}
