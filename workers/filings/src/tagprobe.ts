// Read-only `/tags` (G2 census, log #407): which XBRL tags one company's latest stored results files carry, filtered
// by a name pattern, with the dimension-free value — e.g. do lending NBFCs tag the SEBI Reg 52(4) ratios (GNPA %,
// NNPA %, CRAR) in the NSE results XBRL? Reads ≤ 4 stored files of one symbol (index ix_fetch_symbol_kind).
import { GOV_DENY, type Sql, boardSnapshot, parseXbrl, scrubIds } from "@disclo/core";

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

// Read-only `/gov-probe?jobs=a,b` (G8, log #409): why a stored governance XBRL gives "no period end" or no investor
// complaints. For ≤ 4 job ids (primary key): the contexts' periods and dimension counts, and the date / period /
// complaint tags with their values. HARD RULE (owner): identifier tags (GOV_DENY) are dropped before anything is read
// and every value is scrubbed of PAN / DIN-shaped text; no director name is returned (only how many the reader finds).
export const SQL_GOV_JOBS = `SELECT job_id, kind, symbol, r2_key FROM fetch_job WHERE job_id IN (SELECT value FROM json_each(?1)) AND +status = 'done'`;
const GOV_PROBE_TAGS = /Date|Period|Quarter|Year|Complaint|Grievance/i;

export async function govProbe(db: Sql, getText: (k: string) => Promise<string | null>, jobIds: number[]) {
  const jobs = await db.all<{ job_id: number; kind: string; symbol: string | null; r2_key: string }>(SQL_GOV_JOBS, [JSON.stringify(jobIds.slice(0, 4))]);
  const out = [];
  for (const j of jobs) {
    const xml = await getText(j.r2_key);
    if (!xml) { out.push({ job: j.job_id, kind: j.kind, symbol: j.symbol, error: "missing in R2" }); continue; }
    let inst; try { inst = parseXbrl(xml); } catch { out.push({ job: j.job_id, kind: j.kind, symbol: j.symbol, error: "unreadable" }); continue; }
    const ctxs = [...inst.contexts.values()];
    const periods: Record<string, number> = {};
    for (const c of ctxs) { const k = `${c.start ?? "-"}..${c.end ?? c.instant ?? "-"} dims=${Object.keys(c.dims).length}`; periods[k] = (periods[k] ?? 0) + 1; }
    const tags: Record<string, string | null> = {};
    for (const f of inst.facts) {
      const name = f.tag.replace(/^[^:]*:/, "");
      if (GOV_DENY.test(name) || !GOV_PROBE_TAGS.test(name) || /Director|Appointment|Cessation|Tenure/i.test(name)) continue;
      const ctx = inst.contexts.get(f.contextRef);
      const key = ctx && Object.keys(ctx.dims).length ? `${f.tag} [${f.contextRef}]` : f.tag;
      if (!(key in tags) && Object.keys(tags).length < 60) tags[key] = f.value === null ? null : scrubIds(f.value).slice(0, 80);
    }
    const snap = boardSnapshot(inst);
    out.push({ job: j.job_id, kind: j.kind, symbol: j.symbol, schema: inst.schemaRef, bytes: xml.length, facts: inst.facts.length, contexts: ctxs.length,
      head: scrubIds(xml.slice(0, 300)), periods, tags, reader: { schema: snap.schema, periodEnd: snap.periodEnd, directors: snap.directors.length, complaintsPending: snap.complaintsPending } });
  }
  return { jobs: out };
}
