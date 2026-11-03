// D134 whole-population check of the results reader, run before changing it: one compact row per downloaded results
// file — schema, taxonomy prefix, template, old-GAAP flag, and which lines change when the old-GAAP aliases are
// switched on for every file. Read-only (R2 + D1 SELECT). Paged by job_id; at most 50 files per call.
import { type Sql, canonicalResult, isOldGaap, parseXbrl } from "@disclo/core";
import { RESULT_KINDS } from "./load.js";

export interface CensusRow { job: number; schema: string; prefix: string; template?: string; oldGaap?: boolean; aliasLines?: string[]; aliasUsedAuto?: string[]; error?: string }

const shortSchema = (ref: string | null) => (ref ?? "").replace(/^.*\//, "").replace(/[_-]?\d{4}-\d{2}-\d{2}/, "").replace(/\.xsd$/, "") || "(none)";

export async function census(db: Sql, getText: (k: string) => Promise<string | null>, after: number, limit: number): Promise<{ rows: CensusRow[]; next: number | null }> {
  const marks = RESULT_KINDS.map(() => "?").join(",");
  const jobs = await db.all<{ job_id: number; r2_key: string }>(
    `SELECT job_id, r2_key FROM fetch_job WHERE status='done' AND kind IN (${marks}) AND job_id > ? ORDER BY job_id LIMIT ?`, [...RESULT_KINDS, after, limit]);
  const rows = await Promise.all(jobs.map(async (j): Promise<CensusRow> => {
    const xml = await getText(j.r2_key);
    if (!xml) return { job: j.job_id, schema: "", prefix: "", error: "missing in R2" };
    let inst;
    try { inst = parseXbrl(xml); } catch (e) { return { job: j.job_id, schema: "", prefix: "", error: "xml: " + String(e).slice(0, 80) }; }
    const pf = inst.facts.find((x) => /:DateOfEndOfReportingPeriod$/.test(x.tag))?.tag.split(":")[0] ?? "(none)";
    const row: CensusRow = { job: j.job_id, schema: shortSchema(inst.schemaRef), prefix: pf, oldGaap: isOldGaap(inst) };
    try {
      const none = canonicalResult(inst, { aliases: "none" }), all = canonicalResult(inst, { aliases: "all" }), auto = canonicalResult(inst);
      row.template = none.template;
      row.aliasLines = Object.keys(all.lines).filter((k) => all.lines[k] !== none.lines[k]);
      row.aliasUsedAuto = Object.keys(auto.lines).filter((k) => auto.lines[k] !== none.lines[k]);
    } catch (e) { row.error = String(e).slice(0, 80); }
    return row;
  }));
  return { rows, next: jobs.length === limit ? jobs[jobs.length - 1]!.job_id : null };
}
