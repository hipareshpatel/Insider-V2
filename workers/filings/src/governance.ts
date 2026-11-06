// G8 phase 1 (read-only): /governance-census — for a page of the focus companies, how many governance files and lists
// are stored (by kind and status), how many results XBRL files name their auditors and parse (auditorSnapshot), the
// auditor-change / modified-opinion events they give, and the shape (row keys or XBRL tags) of one stored file of each
// governance kind, so a reader for them can be written from real files. Nothing is written. Index-backed only: jobs of
// named symbols and kinds by ix_fetch_symbol_kind; files from R2.
import { type Sql, auditorEvents, auditorSnapshot, parseXbrl } from "@disclo/core";

/** Lists (per-company API answers) and the XBRL attachments discover() queues from them. */
export const GOV_LIST_KINDS = ["governance", "integrated_governance"];
export const GOV_FILE_KINDS = ["xbrl_governance", "xbrl_integrated_governance"];
/** Results XBRL carrying in-capmkt:AuditorsFirmName (Integrated Filing – Financials; older results files name none). */
export const AUDITOR_KINDS = ["xbrl_integrated_financials", "xbrl_results_quarterly"];
export const GOV_CENSUS_MAX = 5; // companies per call: ≈ 40 results files each are read from R2

export const SQL_GOV_COUNTS = `SELECT symbol, kind, status, count(*) AS n FROM fetch_job
  WHERE symbol IN (SELECT value FROM json_each(?1)) AND kind IN (SELECT value FROM json_each(?2)) GROUP BY symbol, kind, status`;
export const SQL_GOV_FILES = `SELECT job_id, symbol, kind, r2_key FROM fetch_job
  WHERE symbol IN (SELECT value FROM json_each(?1)) AND kind IN (SELECT value FROM json_each(?2)) AND +status = 'done' ORDER BY job_id`;

type Shape = { kind: string; key: string; error?: string; rows?: number; row_keys?: string[]; first_row?: Record<string, string>; schema?: string | null; facts?: number; tags?: Record<string, number>; axes?: string[] };

/** Field names of one stored list (JSON rows) or XBRL file — what a phase-2 reader would read. */
export function shapeOf(kind: string, key: string, text: string): Shape {
  if (kind.startsWith("xbrl_")) {
    try {
      const inst = parseXbrl(text), tags: Record<string, number> = {}, axes = new Set<string>();
      for (const f of inst.facts) tags[f.tag] = (tags[f.tag] ?? 0) + 1;
      for (const c of inst.contexts.values()) for (const a of Object.keys(c.dims)) axes.add(a);
      const top = Object.fromEntries(Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)).slice(0, 250));
      return { kind, key, schema: inst.schemaRef, facts: inst.facts.length, tags: top, axes: [...axes].sort() };
    } catch (e) { return { kind, key, error: "xml: " + String(e).slice(0, 80) }; }
  }
  let rows: unknown[] = [];
  try { const d = JSON.parse(text); rows = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []; } catch (e) { return { kind, key, error: "json: " + String(e).slice(0, 80) }; }
  const keys = new Set<string>();
  for (const r of rows) if (r && typeof r === "object") for (const k of Object.keys(r)) keys.add(k);
  const first = rows.find((r) => r && typeof r === "object") as Record<string, unknown> | undefined;
  return { kind, key, rows: rows.length, row_keys: [...keys].sort(),
    ...(first ? { first_row: Object.fromEntries(Object.entries(first).map(([k, v]) => [k, (typeof v === "string" ? v : JSON.stringify(v) ?? "").slice(0, 160)])) } : {}) };
}

export async function governanceCensus(db: Sql, getText: (k: string) => Promise<string | null>, symbols: string[], opts: { shapes?: boolean } = {}) {
  const kinds = [...GOV_LIST_KINDS, ...GOV_FILE_KINDS, ...AUDITOR_KINDS];
  const counts = await db.all<{ symbol: string; kind: string; status: string; n: number }>(SQL_GOV_COUNTS, [JSON.stringify(symbols), JSON.stringify(kinds)]);
  const totals: Record<string, Record<string, number>> = {};
  const jobsOf = new Map<string, Record<string, Record<string, number>>>();
  for (const c of counts) {
    (totals[c.kind] ??= {})[c.status] = (totals[c.kind]![c.status] ?? 0) + c.n;
    const m = jobsOf.get(c.symbol) ?? jobsOf.set(c.symbol, {}).get(c.symbol)!;
    (m[c.kind] ??= {})[c.status] = c.n;
  }
  const files = await db.all<{ job_id: number; symbol: string; kind: string; r2_key: string }>(SQL_GOV_FILES, [JSON.stringify(symbols), JSON.stringify(kinds)]);
  const companies: unknown[] = [];
  const tot = { auditor_files: 0, with_auditor: 0, no_auditor_field: 0, unreadable: 0, missing_in_r2: 0, events: 0 };
  for (const sym of symbols) {
    const mine = files.filter((f) => f.symbol === sym && AUDITOR_KINDS.includes(f.kind));
    const c = { auditor_files: mine.length, with_auditor: 0, no_auditor_field: 0, unreadable: 0, missing_in_r2: 0 };
    const snaps: (ReturnType<typeof auditorSnapshot> & { ref: string })[] = [];
    await Promise.all(mine.map(async (f) => {
      const t = await getText(f.r2_key).catch(() => null);
      if (!t) { c.missing_in_r2++; return; }
      try {
        const s = auditorSnapshot(parseXbrl(t));
        if (s.auditors.length) c.with_auditor++; else c.no_auditor_field++;
        snaps.push({ ...s, ref: `job ${f.job_id}` });
      } catch { c.unreadable++; }
    }));
    const events = auditorEvents(snaps);
    const named = snaps.filter((s) => s.auditors.length && s.periodEnd).sort((a, b) => b.periodEnd!.localeCompare(a.periodEnd!));
    const opinions: Record<string, number> = {};
    for (const s of snaps) opinions[s.opinion?.kind ?? "none"] = (opinions[s.opinion?.kind ?? "none"] ?? 0) + 1;
    for (const k of Object.keys(c) as (keyof typeof c)[]) tot[k] += c[k];
    tot.events += events.length;
    companies.push({ symbol: sym, jobs: jobsOf.get(sym) ?? {}, ...c, opinions,
      first_named: named.at(-1)?.periodEnd ?? null, latest: named[0] ? { period_end: named[0].periodEnd, basis: named[0].basis, auditors: named[0].auditors.map((a) => a.firm) } : null, events });
  }
  // one stored file of each governance kind (first by job id), for its field names
  const shapes: Shape[] = [];
  if (opts.shapes !== false) for (const kind of [...GOV_LIST_KINDS, ...GOV_FILE_KINDS]) {
    const f = files.find((x) => x.kind === kind);
    if (!f) continue;
    const t = await getText(f.r2_key).catch(() => null);
    shapes.push(t ? shapeOf(kind, f.r2_key, t) : { kind, key: f.r2_key, error: "missing in R2" });
  }
  return { symbols, totals, ...tot, companies, shapes };
}
