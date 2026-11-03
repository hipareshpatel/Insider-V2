// D134 whole-population check of the results reader, run before changing it: one compact row per downloaded results
// file — schema, taxonomy prefix, template, old-GAAP flag, and which lines change when the old-GAAP aliases are
// switched on for every file. Read-only (R2 + D1 SELECT). Paged by job_id; at most 50 files per call.
import { type Sql, balanceAndCash, canonicalResult, isOldGaap, parseXbrl } from "@disclo/core";
import { RESULT_KINDS } from "./load.js";

export interface CensusRow { job: number; schema: string; prefix: string; template?: string; oldGaap?: boolean; aliasLines?: string[]; aliasUsedAuto?: string[]; error?: string; periodCtxs?: { id: string; revenue: string | null }[]; chosen?: string; ctxSample?: string[]; bs?: { t: string; ok: boolean; fail: string[]; n: number; key?: string } | null; cf?: { ok: boolean; fail: string[]; n: number } | null; fy?: { ok: boolean; n: number; fail: string[]; ratio: number | null; err?: string } | null }

const shortSchema = (ref: string | null) => (ref ?? "").replace(/^.*\//, "").replace(/[_-]?\d{4}-\d{2}-\d{2}/, "").replace(/\.xsd$/, "") || "(none)";

export async function census(db: Sql, getText: (k: string) => Promise<string | null>, after: number, limit: number): Promise<{ rows: CensusRow[]; next: number | null }> {
  const marks = RESULT_KINDS.map(() => "?").join(",");
  // Primary-key range paging (C18: the earlier filter-then-page query read ~213k rows per call).
  const [mx] = await db.all<{ m: number | null }>("SELECT max(job_id) AS m FROM fetch_job");
  const hi = after + limit * 6;
  const jobs = await db.all<{ job_id: number; r2_key: string }>(
    `SELECT job_id, r2_key FROM fetch_job WHERE job_id > ? AND job_id <= ? AND status='done' AND kind IN (${marks}) ORDER BY job_id`, [after, hi, ...RESULT_KINDS]);
  const rows = await Promise.all(jobs.map(async (j): Promise<CensusRow> => {
    const xml = await getText(j.r2_key);
    if (!xml) return { job: j.job_id, schema: "", prefix: "", error: "missing in R2" };
    let inst;
    try { inst = parseXbrl(xml); } catch (e) { return { job: j.job_id, schema: "", prefix: "", error: "xml: " + String(e).slice(0, 80) }; }
    const pf = inst.facts.find((x) => /:DateOfEndOfReportingPeriod$/.test(x.tag))?.tag.split(":")[0] ?? "(none)";
    const row: CensusRow = { job: j.job_id, schema: shortSchema(inst.schemaRef), prefix: pf, oldGaap: isOldGaap(inst) };
    // V1 hint (D142, #276): FourD may carry the quarter's dates → two dimension-free contexts span the period.
    const meta = (t: string) => inst.facts.find((f) => f.tag.endsWith(":" + t))?.value ?? null;
    const st = meta("DateOfStartOfReportingPeriod"), en = meta("DateOfEndOfReportingPeriod");
    const rev = (id: string) => inst.facts.find((f) => /:(RevenueFromOperations|InterestEarned|Income)$/.test(f.tag) && f.contextRef === id)?.value ?? null;
    const span = [...inst.contexts.values()].filter((c) => c.start === st && c.end === en && Object.keys(c.dims).length === 0);
    if (span.length) row.periodCtxs = span.map((c) => ({ id: c.id, revenue: rev(c.id) }));
    if (!st || !en) row.ctxSample = [...inst.contexts.values()].filter((c) => !Object.keys(c.dims).length).slice(0, 6).map((c) => `${c.id}:${c.start ?? ""}..${c.end ?? c.instant ?? ""}`);
    try {
      const b = balanceAndCash(inst);
      row.bs = b.bs ? { t: b.template, ok: b.bs.checks.length > 0 && b.bs.checks.every((c) => c.ok), fail: b.bs.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`), n: b.bs.checks.length, key: b.bs.checks.every((c) => c.ok) ? undefined : j.r2_key } : null;
      row.cf = b.cf ? { ok: b.cf.checks.length > 0 && b.cf.checks.every((c) => c.ok), fail: b.cf.checks.filter((c) => !c.ok).map((c) => c.name), n: b.cf.checks.length } : null;
    } catch (e) { row.bs = null; row.cf = null; }
    // D90: full-year figures from March-quarter (fiscal-year-end) files — readable, identities pass, and FY ÷ quarter revenue.
    try {
      const fyS = meta("DateOfStartOfFinancialYear"), months = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1;
      if (fyS && en && months(st ?? en, en) === 3 && months(fyS, en) === 12) {
        try {
          const q = canonicalResult(inst), fy = canonicalResult(inst, { span: "ytd" });
          const core = (x: typeof q) => x.lines.revenue ?? x.lines.interest_earned ?? x.lines.gross_premium ?? x.lines.total_income;
          const qv = Number(core(q)), fv = Number(core(fy));
          row.fy = { ok: fy.checks.length > 0 && fy.checks.every((c) => c.ok), n: fy.checks.length, fail: fy.checks.filter((c) => !c.ok).map((c) => c.name), ratio: qv > 0 && fv > 0 ? Math.round((fv / qv) * 100) / 100 : null };
        } catch (e) { row.fy = { ok: false, n: 0, fail: [], ratio: null, err: String(e).slice(0, 80) }; }
      }
    } catch { /* not a results file layout */ }
    try {
      const none = canonicalResult(inst, { aliases: "none" }), all = canonicalResult(inst, { aliases: "all" }), auto = canonicalResult(inst);
      row.template = none.template;
      row.aliasLines = Object.keys(all.lines).filter((k) => all.lines[k] !== none.lines[k]);
      row.aliasUsedAuto = Object.keys(auto.lines).filter((k) => auto.lines[k] !== none.lines[k]);
    } catch (e) { row.error = String(e).slice(0, 80); }
    return row;
  }));
  return { rows, next: hi < (mx?.m ?? 0) ? hi : null };
}
