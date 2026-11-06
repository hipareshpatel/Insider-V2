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
// Director / KMP changes are not read here: no structured sample of them (governance XBRL, announcement rows with those
// subjects) is stored in the repo, so no format is assumed.
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
