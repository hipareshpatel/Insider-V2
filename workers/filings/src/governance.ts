// G8 phase 1 (read-only): /governance-census — for a page of the focus companies, how many governance files and lists
// are stored (by kind and status), how many results XBRL files name their auditors and parse (auditorSnapshot), the
// auditor-change / modified-opinion events they give, and the shape (row keys or XBRL tags) of one stored file of each
// governance kind, so a reader for them can be written from real files. Nothing is written. Index-backed only: jobs of
// named symbols and kinds by ix_fetch_symbol_kind; files from R2.
//
// G8 phase 2 (owner approval, log #405), end of file: auditor_filing + audit opinion (governance_fact) from the results
// XBRL — on load (loadOne) and by the one-off /maint/auditors_backfill — and board_member + governance_filing from the
// governance XBRL — by /maint/board_backfill, then the cron step on the same cursor once the backfill has caught up.
// HARD RULE (owner): no PAN, DIN or date of birth is read, stored, logged or returned (core boardSnapshot allow-list;
// notes name job ids and counts only, never a director).
import { type AuditorSnapshot, type Sql, auditorEvents, auditorSnapshot, batchAll, boardSnapshot, byKindAfter, insertRows, opinionKind, parseXbrl, scrubIds } from "@disclo/core";
import { COVERAGE_FLOOR, type Deps, focusPrint, rereadPass, settled } from "./load.js";
import { SQL_SIDS_OF_SYMBOLS } from "./ratingcov.js";

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

const PII_KEY = /^(pan|din|dob)|(pan|din)(no|num|number)?$|birth|aadhaar|passport/i;
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
    // HARD RULE (owner, G8 phase 2): a value under a PAN / DIN / birth-date-like key is never returned, and
    // identifier-shaped text is removed from the others
    ...(first ? { first_row: Object.fromEntries(Object.entries(first).map(([k, v]) => [k, PII_KEY.test(k) ? "(withheld)" : scrubIds((typeof v === "string" ? v : JSON.stringify(v) ?? "").slice(0, 160))])) } : {}) };
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

// ── G8 phase 2: auditors per results filing ─────────────────────────────────────────────────────────────────────────
/** Stored opinion: unmodified / modified / not_applicable (opinionKind's "other" is a modified opinion or a statement
 *  on the impact of audit qualifications; a bare "Unmodified opinion" wording counts as unmodified). */
export function storedOpinion(v: string): "unmodified" | "modified" | "not_applicable" {
  const k = opinionKind(v);
  return k === "other" ? (/^\s*unmodified\b/i.test(v) ? "unmodified" : "modified") : k;
}
const AUDITOR_INSERT = "INSERT INTO auditor_filing (filing_id, security_id, basis, period_end, seq, firm, firm_key, peer_review, cert_valid_to)";
const GOV_FACT_INSERT = "INSERT INTO governance_fact (filing_id, security_id, key, value)";
/** One results filing's auditor firm(s) and audit opinion; inserts only (ON CONFLICT DO NOTHING). Rows written. */
export async function storeAuditors(db: Sql, s: AuditorSnapshot, sid: number, f: { filing_id: number; basis: string; period_end: string | null }): Promise<number> {
  const end = f.period_end ?? s.periodEnd, basis = f.basis || s.basis || "na";
  const au = end ? s.auditors.map((a, i) => [f.filing_id, sid, basis, end, i + 1, a.firm.slice(0, 200), a.key, a.peerReview === null ? null : a.peerReview ? 1 : 0, a.certValidTo]) : [];
  const op = s.opinion?.value ? [[f.filing_id, sid, "audit_opinion", storedOpinion(s.opinion.value)], [f.filing_id, sid, "audit_opinion_text", s.opinion.value.slice(0, 500)]] : [];
  if (!au.length && !op.length) return 0;
  return batchAll(db, [...insertRows(AUDITOR_INSERT, 9, au, "ON CONFLICT DO NOTHING"), ...insertRows(GOV_FACT_INSERT, 4, op, "ON CONFLICT DO NOTHING")]);
}

/** One-off /maint/auditors_backfill: the focus companies' stored results files (results_quarterly, results_annual,
 *  integrated_financials) from 2024-01-01, re-read from R2 by rereadPass (cursor by company and filing_id in
 *  ('once','auditors_backfill')); auditor firm(s) and the opinion stored for each, inserts only. Files loaded since this
 *  change store theirs on load (loadOne). */
export async function auditorsBackfill(deps: Deps, limit = 40, budgetMs = 20_000) {
  const stats = { with_auditors: 0, opinion_only: 0, neither: 0 };
  const r = await rereadPass(deps, "auditors_backfill", async (focus) => focus ?? [], limit, budgetMs, async (inst, f, sid) => {
    const s = auditorSnapshot(inst);
    if (s.auditors.length) stats.with_auditors++; else if (s.opinion) stats.opinion_only++; else stats.neither++;
    return { rows: await storeAuditors(deps.filings, s, sid, f), note: "" };
  });
  return { ...r, census: stats };
}

// ── G8 phase 2: board composition per governance file ──────────────────────────────────────────────────────────────
export const SQL_GOV_NEXT = "SELECT job_id, kind, symbol, r2_key, status, attempts, http_status FROM fetch_job WHERE kind = ? AND job_id > ? ORDER BY job_id LIMIT ?";
const BOARD_INSERT = "INSERT INTO board_member (security_id, period_end, name_key, name, category, status, appointed_on, ceased_on, source_kind, filing_or_job_id)";
const GOVFILE_INSERT = "INSERT INTO governance_filing (security_id, period_end, source_kind, job_id, directors, complaints_pending, read_at)";
type GovJob = { job_id: number; kind: string; symbol: string | null; r2_key: string; status: string; attempts: number; http_status: number | null };
type BoardCursor = { after: number; focus: string; caught: boolean; files: number; rows: number; old: number };

/** Board composition from the stored governance XBRL (xbrl_governance, xbrl_integrated_governance) of the focus
 *  companies, periods from 2024-01-01. A job_id cursor per kind over ix_fetch_kind_job ('once','board'), as the results
 *  loader: files of other companies are passed over without an R2 read, and the cursor waits at a focus file not
 *  downloaded yet. /maint/board_backfill walks it (`files` R2 reads per call); once it has caught up, the cron step
 *  (`cron`) takes the newly arriving files on the same cursor. A new focus list restarts the walk (inserts only, so
 *  files read before write nothing again) and stops the cron step until the backfill has caught up again. */
export async function boardPass(deps: Deps, opts: { files?: number; scan?: number; budgetMs?: number; cron?: boolean } = {}) {
  const files = opts.files ?? 30, scan = opts.scan ?? 400, budgetMs = opts.budgetMs ?? 20_000, floor = deps.floor ?? COVERAGE_FLOOR;
  const [st] = await deps.filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='board'");
  const fp = focusPrint(deps.focus);
  const saved = st ? JSON.parse(st.detail) as BoardCursor : null;
  const cur: BoardCursor = saved && saved.focus === fp ? saved : { after: 0, focus: fp, caught: false, files: 0, rows: 0, old: 0 };
  if (opts.cron && !cur.caught) return { skipped: "board backfill has not caught up (POST /maint/board_backfill)" };
  const focus = deps.focus ? new Set(deps.focus) : null;
  const jobs = await byKindAfter<GovJob>(deps.filings, SQL_GOV_NEXT, GOV_FILE_KINDS, cur.after, scan);
  const ours = (j: GovJob) => !focus || (!!j.symbol && focus.has(j.symbol));
  const syms = [...new Set(jobs.filter((j) => ours(j) && j.status === "done" && j.symbol).map((j) => j.symbol!))];
  const sidOf = new Map<string, number>();
  if (syms.length) for (const r of await deps.market.all<{ security_id: number; value: string }>(SQL_SIDS_OF_SYMBOLS, [JSON.stringify(syms)])) if (!sidOf.has(r.value)) sidOf.set(r.value, r.security_id);
  const t0 = Date.now(), notes: string[] = [], at = deps.now().toISOString();
  let n = 0, rows = 0, old = 0, complete = true, blocked = false;
  for (const j of jobs) {
    if (ours(j) && !settled(j)) { blocked = true; complete = false; break; } // not downloaded yet: the cursor waits here
    if (ours(j) && j.status === "done") {
      if (n >= files || Date.now() - t0 > budgetMs) { complete = false; break; }
      n++;
      const sid = j.symbol ? sidOf.get(j.symbol) : undefined;
      if (sid === undefined) { notes.push(`job ${j.job_id}: symbol not in market identity`); cur.after = j.job_id; continue; }
      let xml: string | null = null;
      try { xml = await deps.getText(j.r2_key); } catch { notes.push(`job ${j.job_id}: storage read failed`); complete = false; break; } // retried next call
      if (!xml) { notes.push(`job ${j.job_id}: file not stored`); cur.after = j.job_id; continue; }
      try {
        const b = boardSnapshot(parseXbrl(xml));
        if (!b.periodEnd) notes.push(`job ${j.job_id}: no period end in the file`);
        else if (b.periodEnd < floor) old++;
        else {
          const br = b.directors.map((d) => [sid, b.periodEnd, d.key, d.name.slice(0, 160), d.category?.slice(0, 200) ?? null, d.status?.slice(0, 80) ?? null, d.appointedOn, d.ceasedOn, j.kind, j.job_id]);
          rows += await batchAll(deps.filings, [
            ...insertRows(GOVFILE_INSERT, 7, [[sid, b.periodEnd, j.kind, j.job_id, b.directors.length, b.complaintsPending, at]], "ON CONFLICT DO NOTHING"),
            ...insertRows(BOARD_INSERT, 10, br, "ON CONFLICT DO NOTHING")]);
          if (!b.directors.length) notes.push(`job ${j.job_id}: no director named (${b.schema})`);
        }
      } catch (e) { notes.push(`job ${j.job_id}: unreadable (${String(e).slice(0, 60)})`); }
    }
    cur.after = j.job_id;
  }
  if (complete && !blocked && !jobs.length) cur.caught = true; // nothing left after the cursor
  cur.files += n; cur.rows += rows; cur.old += old;
  await deps.filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','board',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [at, JSON.stringify(cur)]);
  return { done: cur.caught, after: cur.after, blocked, files: n, rows, before_floor: old, total: { files: cur.files, rows: cur.rows, before_floor: cur.old }, notes: notes.slice(0, 30) };
}
