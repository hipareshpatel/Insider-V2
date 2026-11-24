// G8 phase 1: auditor facts from the results XBRL NSE already serves (Integrated Filing – Financials, in-capmkt
// taxonomy 2026), and auditor-change events between a company's consecutive filings. Pure: no storage.
//
// Fields read (all seen in stored real filings, test/fixtures/nse/xbrl_*_IF_*.xml):
//   in-capmkt:AuditorsFirmName                    one per AuditorAxis member (context D_Auditor1, D_Auditor2, …)
//   in-capmkt:WhetherTheFirmHoldsAValidPeerReviewCertificateIssuedByPeerReviewBoardOfICAI   same contexts
//   in-capmkt:ValidityDateOfCertificate           same contexts
//   …:DeclarationOfUnmodifiedOpinionOrStatementOnImpactOfAuditQualification   OneD (also in the older in-bse-fin files)
//   …:WhetherResultsAreAuditedOrUnaudited, NatureOfReportStandaloneConsolidated, DateOfStartOfReportingPeriod,
//   DateOfEndOfReportingPeriod, DateOfBoardMeetingWhenFinancialResultsWereApproved, Symbol   OneD
// G8 phase 2 adds boardSnapshot (end of file): board composition from the governance XBRL (in-bse-cg, CG_*.xml) and the
// Integrated Filing – Governance XBRL (in-capmkt), by the field names reported from the stored files (log #405).
import type { XbrlInstance } from "./xbrl.js";

export interface AuditorFirm { firm: string; key: string; peerReview: boolean | null; certValidTo: string | null; source: string }
export type OpinionKind = "unmodified" | "not_applicable" | "other";
export interface AuditorSnapshot {
  symbol: string | null;
  basis: "consolidated" | "standalone" | null;
  periodStart: string | null;
  periodEnd: string | null;
  boardDate: string | null;
  audited: string | null; // "Audited" / "Unaudited" as filed
  auditors: AuditorFirm[]; // empty: the file names no auditor (older template), not "no auditor"
  opinion: { kind: OpinionKind; value: string; source: string } | null;
}

const local = (tag: string) => tag.slice(tag.indexOf(":") + 1);

/** Firm name → comparison key: case, punctuation, "&"/"and", "LLP"/"Chartered Accountants" and spacing ignored. */
export function auditorKey(name: string): string {
  return name.toLowerCase().replace(/&/g, " and ").replace(/\bchartered accountants?\b/g, " ").replace(/\b(llp|l\.l\.p\.?)\b/g, " ")
    .replace(/\bcompany\b/g, "co").replace(/[^a-z0-9]+/g, "");
}

export function opinionKind(v: string): OpinionKind {
  const s = v.trim().toLowerCase();
  if (/^declaration of unmodified opinion/.test(s)) return "unmodified";
  if (/^(not applicable|na|n\.a\.?)$/.test(s)) return "not_applicable";
  return "other";
}

/** One filing's auditor facts. Entity-level facts are taken from dimension-free contexts (OneD first). */
export function auditorSnapshot(inst: XbrlInstance): AuditorSnapshot {
  const plain = (f: { contextRef: string }) => { const c = inst.contexts.get(f.contextRef); return !c || Object.keys(c.dims).length === 0; };
  const meta = (name: string) => {
    const fs = inst.facts.filter((f) => local(f.tag) === name && f.value !== null && f.value !== "" && plain(f));
    return (fs.find((f) => f.contextRef === "OneD") ?? fs[0]) ?? null;
  };
  const byCtx = new Map<string, AuditorFirm>();
  for (const f of inst.facts) {
    if (local(f.tag) !== "AuditorsFirmName" || !f.value) continue;
    byCtx.set(f.contextRef, { firm: f.value.replace(/\s+/g, " ").trim(), key: auditorKey(f.value), peerReview: null, certValidTo: null, source: `${f.tag}@${f.contextRef}` });
  }
  for (const f of inst.facts) {
    const a = byCtx.get(f.contextRef);
    if (!a || f.value === null) continue;
    if (local(f.tag) === "WhetherTheFirmHoldsAValidPeerReviewCertificateIssuedByPeerReviewBoardOfICAI") a.peerReview = /^true$/i.test(f.value) ? true : /^false$/i.test(f.value) ? false : null;
    if (local(f.tag) === "ValidityDateOfCertificate") a.certValidTo = /^\d{4}-\d{2}-\d{2}$/.test(f.value) ? f.value : null;
  }
  // D_Auditor1, D_Auditor2, … in filed order (by the AuditorAxis member when present)
  const order = (id: string) => inst.contexts.get(id)?.dims["in-capmkt:AuditorAxis"] ?? id;
  const seen = new Set<string>();
  const auditors = [...byCtx.entries()].sort(([a], [b]) => order(a).localeCompare(order(b), "en", { numeric: true })).map(([, v]) => v)
    .filter((a) => a.key && !seen.has(a.key) && (seen.add(a.key), true));
  const op = meta("DeclarationOfUnmodifiedOpinionOrStatementOnImpactOfAuditQualification");
  const nature = meta("NatureOfReportStandaloneConsolidated")?.value?.toLowerCase() ?? null;
  return {
    symbol: meta("Symbol")?.value ?? null,
    basis: nature === "consolidated" || nature === "standalone" ? nature : null,
    periodStart: meta("DateOfStartOfReportingPeriod")?.value ?? null,
    periodEnd: meta("DateOfEndOfReportingPeriod")?.value ?? null,
    boardDate: meta("DateOfBoardMeetingWhenFinancialResultsWereApproved")?.value ?? null,
    audited: meta("WhetherResultsAreAuditedOrUnaudited")?.value ?? null,
    auditors,
    opinion: op?.value ? { kind: opinionKind(op.value), value: op.value, source: `${op.tag}@${op.contextRef}` } : null,
  };
}

export interface AuditorChange {
  type: "auditor_change";
  symbol: string | null;
  basis: string | null;
  /** The change happened after `prevPeriodEnd` and by `periodEnd` (the first filing naming the new set). */
  prevPeriodEnd: string;
  periodEnd: string;
  boardDate: string | null; // when the first filing with the new set was approved (the market learns it then or later)
  outgoing: string[];
  incoming: string[];
  continuing: string[];
  source: string; // the field compared
  ref?: string; // caller's file reference of the filing with the new set
}
export interface AuditOpinionEvent { type: "audit_opinion_modified"; symbol: string | null; basis: string | null; periodEnd: string; boardDate: string | null; value: string; source: string; ref?: string }

/** Auditor changes between consecutive filings of one company, per basis (consolidated and standalone separately).
 *  Filings that name no auditor are skipped (unknown, not a change); several filings for one period (restatement,
 *  re-filing) collapse to the latest given. Opinions other than "unmodified" / "not applicable" are events too. */
export function auditorEvents(snaps: (AuditorSnapshot & { ref?: string })[]): (AuditorChange | AuditOpinionEvent)[] {
  const out: (AuditorChange | AuditOpinionEvent)[] = [];
  const groups = new Map<string, Map<string, AuditorSnapshot & { ref?: string }>>();
  for (const s of snaps) {
    if (!s.periodEnd) continue;
    if (s.opinion?.kind === "other") out.push({ type: "audit_opinion_modified", symbol: s.symbol, basis: s.basis, periodEnd: s.periodEnd, boardDate: s.boardDate, value: s.opinion.value, source: s.opinion.source, ...(s.ref ? { ref: s.ref } : {}) });
    if (!s.auditors.length) continue;
    const g = `${s.symbol ?? ""}|${s.basis ?? ""}`;
    const m = groups.get(g) ?? groups.set(g, new Map()).get(g)!;
    m.set(s.periodEnd, s);
  }
  for (const m of groups.values()) {
    const seq = [...m.values()].sort((a, b) => a.periodEnd!.localeCompare(b.periodEnd!));
    for (let i = 1; i < seq.length; i++) {
      const p = seq[i - 1]!, c = seq[i]!;
      const pk = new Map(p.auditors.map((a) => [a.key, a.firm])), ck = new Map(c.auditors.map((a) => [a.key, a.firm]));
      const outgoing = [...pk].filter(([k]) => !ck.has(k)).map(([, v]) => v), incoming = [...ck].filter(([k]) => !pk.has(k)).map(([, v]) => v);
      if (!outgoing.length && !incoming.length) continue;
      out.push({ type: "auditor_change", symbol: c.symbol, basis: c.basis, prevPeriodEnd: p.periodEnd!, periodEnd: c.periodEnd!, boardDate: c.boardDate, outgoing, incoming,
        continuing: [...ck].filter(([k]) => pk.has(k)).map(([, v]) => v), source: "in-capmkt:AuditorsFirmName (AuditorAxis)", ...(c.ref ? { ref: c.ref } : {}) });
    }
  }
  return out.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || a.type.localeCompare(b.type));
}

// ── G8 phase 2: board composition from the governance XBRL ──────────────────────────────────────────────────────────
// HARD RULE (owner): a director's PAN, DIN and date of birth are never read, stored, logged or returned. The reader takes
// facts by an allow-list of local names only (name, category / position, status, appointment and cessation dates);
// identifier tags are dropped before anything else looks at the file, and identifier-shaped text is scrubbed out of
// the free-text fields kept. A director is identified within a company by the normalised name only.
// Field names (log #405, census of stored INFY / SUNPHARMA / HDFCBANK files): per CompositionOfBoardOfDirectorsAxis
// member NameOftheDirector, Title, PositionOfDirectorInBoardOne/Two/Three (category), DateOfAppointmentOfDirector,
// DateOfCessation, CurrentStatusDirector, TenureOfDirector; NoOfInvestorComplaints* in the filing's own context. The
// patterns below accept the spelling variants (NameOfTheDirector, CategoryOfDirector…, DateOfCessationOfDirector …).

/** Tags that are never read (PAN, DIN, date of birth and any other personal identifier). */
export const GOV_DENY = /PermanentAccountNumber|IdentificationNumber|DateOfBirth|Birth|Aadhaar|Passport|(^|[a-z])PAN([A-Z]|$)|(^|[a-z])DIN([A-Z]|$)/;
const NAME_TAG = /^NameOf(The)?Director$/i;
const CATEGORY_TAG = /^(CategoryOfDirector\w*|Category\w*OfDirectors?|PositionOfDirectorInBoard\w*)$/i;
const STATUS_TAG = /^(CurrentStatus(Of)?(The)?Director|StatusOfDirector)$/i;
const APPOINTED_TAGS = [/^(InitialDateOfAppointment(OfDirector)?|DateOfInitialAppointment(OfDirector)?)$/i, /^DateOfAppointment(OfDirector)?$/i];
const CEASED_TAG = /^DateOfCessation(OfDirector)?$/i;
const PENDING_TAG = /InvestorComplaints?\w*(Pending|Unresolved|Remaining|Outstanding)|(Pending|Unresolved|Remaining|Outstanding)\w*InvestorComplaints?/i;
const PERIOD_END_TAGS = /^(DateOfEndOfReportingPeriod|DateOfEndOfReportingQuarter|QuarterEndDate|DateOfEndOfQuarter|ReportingPeriodEndDate)$/i;

/** Personal-identifier-shaped text (PAN: 5 letters, 4 digits, 1 letter; DIN: 8 digits) removed from free text. */
export function scrubIds(s: string): string {
  return s.replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, " ").replace(/\b\d{8}\b/g, " ").replace(/\(\s*\)|\[\s*\]/g, " ").replace(/\s+/g, " ").trim();
}
/** A director's name → key within a company: case, honorifics, punctuation and spacing ignored. */
export function directorKey(name: string): string {
  return scrubIds(name).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim()
    .replace(/^((mr|mrs|ms|miss|dr|shri|shree|sri|smt|kum|prof|capt|justice|adv)\s+)+/, "").replace(/\s+/g, " ").trim();
}

export interface Director { name: string; key: string; category: string | null; status: string | null; appointedOn: string | null; ceasedOn: string | null; source: string }
export interface BoardSnapshot {
  schema: "in-bse-cg" | "in-capmkt" | "other";
  symbol: string | null;
  periodEnd: string | null;
  directors: Director[]; // empty: the file names no director (not "no board")
  complaintsPending: number | null;
  complaintsSource: string | null;
}

const isoDate = (v: string | null | undefined) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec((v ?? "").trim()); return m ? m[1]! : null; };
const clean = (v: string) => scrubIds(v.replace(/\s+/g, " ").trim());

export function boardSnapshot(inst: XbrlInstance): BoardSnapshot {
  // identifier tags are dropped first: nothing below can see them
  const facts = inst.facts.filter((f) => !GOV_DENY.test(local(f.tag)));
  const plain = (f: { contextRef: string }) => { const c = inst.contexts.get(f.contextRef); return !c || Object.keys(c.dims).length === 0; };
  const meta = (re: RegExp) => { const fs = facts.filter((f) => re.test(local(f.tag)) && f.value && plain(f)); return fs.find((f) => f.contextRef === "OneD") ?? fs[0] ?? null; };
  const ns = new Set(facts.map((f) => f.tag.slice(0, f.tag.indexOf(":"))));
  const schema = ns.has("in-bse-cg") ? "in-bse-cg" : ns.has("in-capmkt") ? "in-capmkt" : "other";
  let periodEnd = isoDate(meta(PERIOD_END_TAGS)?.value);
  if (!periodEnd) { // else the latest end of a dimension-free context (the filing's own period)
    for (const c of inst.contexts.values()) if (!Object.keys(c.dims).length) { const e = isoDate(c.end ?? c.instant); if (e && (!periodEnd || e > periodEnd)) periodEnd = e; }
  }
  const byCtx = new Map<string, typeof facts>();
  for (const f of facts) { const l = byCtx.get(f.contextRef); if (l) l.push(f); else byCtx.set(f.contextRef, [f]); }
  const order = (id: string) => Object.values(inst.contexts.get(id)?.dims ?? {}).join("|") || id;
  const seen = new Set<string>(), directors: Director[] = [];
  for (const [ctx, fs] of [...byCtx].sort(([a], [b]) => order(a).localeCompare(order(b), "en", { numeric: true }))) {
    const nf = fs.find((f) => NAME_TAG.test(local(f.tag)) && f.value);
    if (!nf) continue;
    const name = clean(nf.value!), key = directorKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const val = (re: RegExp) => { const v = fs.find((f) => re.test(local(f.tag)) && f.value)?.value; return v ? clean(v) : null; };
    const rank = (t: string) => local(t).replace(/One$/, "1").replace(/Two$/, "2").replace(/Three$/, "3").replace(/Four$/, "4"); // …BoardOne, …Two, …Three in that order
    const cats = [...new Set(fs.filter((f) => CATEGORY_TAG.test(local(f.tag)) && f.value).sort((a, b) => rank(a.tag).localeCompare(rank(b.tag))).map((f) => clean(f.value!)))]
      .filter((v) => v && !/^(not applicable|na|n\.a\.?|none|-)$/i.test(v));
    let appointed: string | null = null;
    for (const re of APPOINTED_TAGS) appointed ??= isoDate(val(re));
    directors.push({ name, key, category: cats.length ? cats.join(" / ") : null, status: val(STATUS_TAG), appointedOn: appointed, ceasedOn: isoDate(val(CEASED_TAG)), source: `${nf.tag}@${ctx}` });
  }
  // pending at the end of the period (never the opening count: "…PendingAtTheBeginning…" is skipped)
  const pfs = facts.filter((f) => PENDING_TAG.test(local(f.tag)) && !/Beginning|Opening|Start/i.test(local(f.tag)) && f.value && plain(f));
  const pf = pfs.find((f) => /End|Clos/i.test(local(f.tag))) ?? pfs[0] ?? null;
  const pending = pf?.value != null && /^\d+(\.0+)?$/.test(pf.value.trim()) ? Number(pf.value) : null;
  return { schema, symbol: meta(/^Symbol$/)?.value ?? null, periodEnd, directors, complaintsPending: pending, complaintsSource: pending === null ? null : `${pf!.tag}@${pf!.contextRef}` };
}

/** On the board at the period end: not ceased by then, and the filed status (if any) not a cessation. */
export function activeAt(d: { status: string | null; ceasedOn: string | null }, periodEnd: string): boolean {
  if (d.ceasedOn && d.ceasedOn <= periodEnd) return false;
  return !/ceas|resign|retir|inactive|vacat|removed|demise|deceased/i.test(d.status ?? "");
}
/** Independent director by the filed category ("Non-Executive - Independent Director"; not "Non-Independent"). */
export const isIndependent = (category: string | null) => !!category && /independent/i.test(category.replace(/non[\s-]*independent/gi, ""));
