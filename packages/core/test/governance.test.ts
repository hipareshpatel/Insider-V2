// G8 phase 1: auditor facts and auditor-change events from real stored results XBRL (Integrated Filing – Financials).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditorEvents, auditorKey, auditorSnapshot, opinionKind, parseXbrl } from "../src/index.js";

const fx = (n: string) => readFileSync(join(import.meta.dirname, "fixtures", "nse", n), "utf8");
const snap = (n: string) => auditorSnapshot(parseXbrl(fx(n)));

describe("auditorSnapshot (real Integrated Filing XBRL)", () => {
  it("INFY Q2 FY27 consolidated: one auditor with its peer-review certificate, unmodified opinion", () => {
    expect(snap("xbrl_INFY_IF_Q2FY27_cons_full.xml")).toEqual({
      symbol: "INFY", basis: "consolidated", periodStart: "2026-07-01", periodEnd: "2026-09-30", boardDate: "2026-10-23", audited: "Audited",
      auditors: [{ firm: "Deloitte Haskins and Sells LLP", key: "deloittehaskinsandsells", peerReview: true, certValidTo: "2027-07-31", source: "in-capmkt:AuditorsFirmName@D_Auditor1" }],
      opinion: { kind: "unmodified", value: "Declaration of unmodified opinion", source: "in-capmkt:DeclarationOfUnmodifiedOpinionOrStatementOnImpactOfAuditQualification@OneD" },
    });
  });
  it("HDFCBANK Q2 FY27 (bank template): joint auditors in AuditorAxis order, XML entities decoded", () => {
    const s = snap("xbrl_HDFCBANK_IF_Q2FY27_full.xml");
    expect(s.auditors.map((a) => [a.firm, a.certValidTo])).toEqual([["B S R & Co. LLP", "2028-07-31"], ["Batliboi & Purohit", "2028-04-30"]]);
    expect(s).toMatchObject({ symbol: "HDFCBANK", basis: "standalone", periodEnd: "2026-09-30", audited: "Unaudited" });
  });
  it("GODIGIT Q1 FY27 (insurer): two auditors", () => {
    expect(snap("xbrl_GODIGIT_Q1FY27_gi.xml").auditors.map((a) => a.firm)).toEqual(["Kirane and Pandit LLP", "PKF Sridhar & Santhanam LLP"]);
  });
  it("older results template (in-bse-fin, FY25): no auditor names, opinion only", () => {
    const s = snap("xbrl_INFY_Q2FY25_cons.xml");
    expect(s.auditors).toEqual([]);
    expect(s.opinion).toEqual({ kind: "not_applicable", value: "Not applicable", source: "in-bse-fin:DeclarationOfUnmodifiedOpinionOrStatementOnImpactOfAuditQualification@OneD" });
    expect(snap("xbrl_INFY_Q4FY24_cons.xml").opinion?.kind).toBe("unmodified");
  });
  it("trimmed file without auditor facts: empty list, not an error", () => {
    expect(snap("xbrl_INFY_IF_Q2FY27_trim.xml").auditors).toEqual([]);
  });
});

describe("auditorKey / opinionKind", () => {
  it("ignores case, punctuation, & vs and, LLP", () => {
    expect(auditorKey("B S R & Co. LLP")).toBe(auditorKey("B.S.R. and Co LLP"));
    expect(auditorKey("Deloitte Haskins & Sells LLP")).toBe(auditorKey("DELOITTE HASKINS AND SELLS"));
    expect(auditorKey("Deloitte Haskins & Sells LLP")).not.toBe(auditorKey("Price Waterhouse & Co Chartered Accountants LLP"));
  });
  it("classifies the opinion declaration", () => {
    expect(opinionKind("Declaration of unmodified opinion")).toBe("unmodified");
    expect(opinionKind("Not applicable")).toBe("not_applicable");
    expect(opinionKind("Statement on impact of audit qualification")).toBe("other");
  });
});

describe("auditorEvents (consecutive filings of one company)", () => {
  const q4 = { ...snap("xbrl_INFY_IF_Q4FY26_cons.xml"), ref: "q4" }, q2 = { ...snap("xbrl_INFY_IF_Q2FY27_cons_full.xml"), ref: "q2" };
  it("same firm in INFY Q4 FY26 and Q2 FY27 (real files): no event", () => {
    expect(q4.auditors.map((a) => a.firm)).toEqual(["Deloitte Haskins and Sells LLP"]);
    expect(auditorEvents([q2, q4])).toEqual([]);
  });
  it("a new firm in the later filing (real Q2 FY27 file with the firm name replaced): change with outgoing / incoming", () => {
    const x = fx("xbrl_INFY_IF_Q2FY27_cons_full.xml").replace(">Deloitte Haskins and Sells LLP<", ">S R Batliboi &amp; Associates LLP<");
    const changed = { ...auditorSnapshot(parseXbrl(x)), ref: "q2x" };
    expect(auditorEvents([changed, q4])).toEqual([{ type: "auditor_change", symbol: "INFY", basis: "consolidated", prevPeriodEnd: "2026-03-31", periodEnd: "2026-09-30", boardDate: "2026-10-23",
      outgoing: ["Deloitte Haskins and Sells LLP"], incoming: ["S R Batliboi & Associates LLP"], continuing: [], source: "in-capmkt:AuditorsFirmName (AuditorAxis)", ref: "q2x" }]);
  });
  it("a filing naming no auditor is skipped, not read as a change; bases are compared separately", () => {
    const blank = { ...q2, auditors: [], periodEnd: "2026-06-30" };
    const standalone = { ...q2, basis: "standalone" as const, auditors: [{ ...q2.auditors[0]!, firm: "Other LLP", key: "other" }] };
    expect(auditorEvents([q4, blank, q2, standalone])).toEqual([]);
  });
  it("one joint auditor replaced: continuing firm kept apart", () => {
    const h = snap("xbrl_HDFCBANK_IF_Q2FY27_full.xml");
    const prev = { ...h, periodEnd: "2026-06-30", auditors: [h.auditors[0]!, { ...h.auditors[1]!, firm: "M M Nissim & Co LLP", key: auditorKey("M M Nissim & Co LLP") }] };
    expect(auditorEvents([prev, h])).toMatchObject([{ outgoing: ["M M Nissim & Co LLP"], incoming: ["Batliboi & Purohit"], continuing: ["B S R & Co. LLP"] }]);
  });
  it("a modified opinion is its own event", () => {
    const q = { ...q2, opinion: { kind: "other" as const, value: "Statement on impact of audit qualification", source: "x" } };
    expect(auditorEvents([q])).toEqual([{ type: "audit_opinion_modified", symbol: "INFY", basis: "consolidated", periodEnd: "2026-09-30", boardDate: "2026-10-23", value: "Statement on impact of audit qualification", source: "x", ref: "q2" }]);
  });
});
