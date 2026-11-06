// Read-only `/tags` (G2 census, log #407): which XBRL tags one company's latest stored results files carry, filtered
// by a name pattern, with the dimension-free value — e.g. do lending NBFCs tag the SEBI Reg 52(4) ratios (GNPA %,
// NNPA %, CRAR) in the NSE results XBRL? Reads ≤ 4 stored files of one symbol (index ix_fetch_symbol_kind).
import { type Sql, parseXbrl } from "@disclo/core";

export const SQL_TAG_FILES = `SELECT job_id, kind, r2_key FROM fetch_job WHERE symbol = ?1 AND kind IN (SELECT value FROM json_each(?2)) AND +status = 'done'
  ORDER BY job_id DESC LIMIT ?3`;
export const TAG_FILE_MAX = 4;

export async function tagProbe(db: Sql, getText: (k: string) => Promise<string | null>, symbol: string, kinds: string[], pattern: RegExp, files = 2) {
  const jobs = await db.all<{ job_id: number; kind: string; r2_key: string }>(SQL_TAG_FILES, [symbol, JSON.stringify(kinds), Math.min(TAG_FILE_MAX, Math.max(1, files))]);
  const out: { job: number; kind: string; schema: string | null; facts: number; tags: Record<string, string | null> }[] = [];
  for (const j of jobs) {
    const xml = await getText(j.r2_key);
    if (!xml) { out.push({ job: j.job_id, kind: j.kind, schema: null, facts: 0, tags: { error: "missing in R2" } }); continue; }
    let inst; try { inst = parseXbrl(xml); } catch { out.push({ job: j.job_id, kind: j.kind, schema: null, facts: 0, tags: { error: "unreadable" } }); continue; }
    const tags: Record<string, string | null> = {};
    for (const f of inst.facts) {
      const name = f.tag.replace(/^[^:]*:/, "");
      if (!pattern.test(name)) continue;
      const ctx = inst.contexts.get(f.contextRef);
      const plain = !ctx || Object.keys(ctx.dims).length === 0;
      const key = plain ? f.tag : `${f.tag} [${f.contextRef}]`;
      if (!(key in tags)) tags[key] = f.value === null ? null : f.value.slice(0, 120);
    }
    out.push({ job: j.job_id, kind: j.kind, schema: inst.schemaRef, facts: inst.facts.length, tags });
  }
  return { symbol, files: out };
}
