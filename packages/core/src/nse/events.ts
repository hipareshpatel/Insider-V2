// M2 event readers (owner #289): insider trading (PIT, SEBI PIT Reg 7), takeover disclosures (SAST Reg 29), board
// meetings, credit ratings — from NSE's JSON lists. Formats checked on real lists (INFY PIT 2024 Q1, INFY SAST 2021→,
// all-company board meetings Oct 2026, credit ratings Jan 2024). Each row gets a stable key, so re-reading an
// overlapping list (capped latest-20 list + full dated list, D149) never double-counts.
import { isoFromNseDate } from "./structure.js";
import type { XbrlInstance } from "../xbrl.js";

const rowsOf = (json: string): Record<string, unknown>[] => { const d = JSON.parse(json) as unknown; return Array.isArray(d) ? d as Record<string, unknown>[] : ((d as { data?: Record<string, unknown>[] }).data ?? []); };
const str = (v: unknown) => { const s = String(v ?? "").trim(); return s === "-" || s === "null" ? "" : s; };
const int = (v: unknown) => { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
/** "22-Mar-2024 16:55" / "22-MAR-2024 16:55:10" → "2024-03-22T16:55:00" (IST, as published). */
export function nseDateTime(s: unknown): string | null {
  const t = str(s), d = isoFromNseDate(t);
  if (!d) return null;
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t.slice(10));
  return m ? `${d}T${m[1]!.padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}` : `${d}T00:00:00`;
}
/** Small stable hash (FNV-1a 64-bit, hex) of the fields that define a row. */
export function rowKey(...parts: unknown[]): string {
  let h = 0xcbf29ce484222325n;
  for (const c of new TextEncoder().encode(parts.map((p) => String(p ?? "")).join("\u001f"))) { h ^= BigInt(c); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16).padStart(16, "0");
}

export interface InsiderTrade {
  key: string; symbol: string; person: string; category: string; secType: string; txn: string; mode: string;
  qty: number | null; valueRs: string; beforeQty: number | null; afterQty: number | null; beforePct: string; afterPct: string;
  fromDate: string | null; toDate: string | null; intimated: string | null; disclosedAt: string | null; did: string; pid: string; exchange: string; derivative: string;
}
export function parsePit(json: string): InsiderTrade[] {
  return rowsOf(json).map((r) => {
    const t = { symbol: str(r.symbol), person: str(r.acqName), category: str(r.personCategory), secType: str(r.secType), txn: str(r.tdpTransactionType), mode: str(r.acqMode),
      qty: int(r.secAcq), valueRs: str(r.secVal), beforeQty: int(r.befAcqSharesNo), afterQty: int(r.afterAcqSharesNo), beforePct: str(r.befAcqSharesPer), afterPct: str(r.afterAcqSharesPer),
      fromDate: isoFromNseDate(str(r.acqfromDt)), toDate: isoFromNseDate(str(r.acqtoDt)), intimated: isoFromNseDate(str(r.intimDt)), disclosedAt: nseDateTime(r.date),
      did: str(r.did), pid: str(r.pid), exchange: str(r.exchange), derivative: str(r.derivativeType) };
    return { key: rowKey("pit", t.symbol, t.did, t.pid, t.person, t.secType, t.txn, t.qty, t.valueRs, t.fromDate, t.toDate, t.afterQty), ...t };
  }).filter((t) => t.symbol);
}

/** C53: NSE's insider-trading system since 3 May 2026 — one PIT XBRL per filing (in-bse-co taxonomy; NSE and BSE share
 *  it), one dimensioned context per disclosed person ("Disclosure1", "Disclosure2", …). Read from a real filing
 *  (ACEVECTOR, 3 Nov 2026). Values as filed. The identification number (PAN / DIN / CIN) is never read. Keys are
 *  "pitx:<appId>:<context>", so a revised filing can replace its original by appId (prevAppId). */
export function parsePitXbrl(inst: XbrlInstance, meta: { appId: string; broadcast: unknown; symbol?: string }): InsiderTrade[] {
  const v = (ctx: string, local: string) => inst.facts.find((f) => f.contextRef === ctx && f.tag.endsWith(`:${local}`) && !f.nil)?.value ?? null;
  const symbol = inst.facts.find((f) => f.tag.endsWith(":Symbol"))?.value?.trim() || meta.symbol || "";
  const disclosedAt = nseDateTime(meta.broadcast);
  const ctxs = [...inst.contexts.values()].filter((c) => Object.keys(c.dims).length && inst.facts.some((f) => f.contextRef === c.id && f.tag.endsWith(":NameOfThePerson")));
  return ctxs.map((c) => ({
    key: `pitx:${meta.appId}:${c.id}`, symbol,
    person: str(v(c.id, "NameOfThePerson")), category: str(v(c.id, "CategoryOfPerson")), secType: str(v(c.id, "TypeOfInstrument")),
    txn: str(v(c.id, "SecuritiesAcquiredOrDisposedTransactionType")), mode: str(v(c.id, "ModeOfAcquisitionOrDisposal")),
    qty: int(v(c.id, "SecuritiesAcquiredOrDisposedNumberOfSecurity")), valueRs: str(v(c.id, "SecuritiesAcquiredOrDisposedValueOfSecurity")),
    beforeQty: int(v(c.id, "SecuritiesHeldPriorToAcquisitionOrDisposalNumberOfSecurity")), afterQty: int(v(c.id, "SecuritiesHeldPostAcquistionOrDisposalNumberOfSecurity") ?? v(c.id, "SecuritiesHeldPostAcquisitionOrDisposalNumberOfSecurity")),
    beforePct: str(v(c.id, "SecuritiesHeldPriorToAcquisitionOrDisposalPercentageOfShareholding")), afterPct: str(v(c.id, "SecuritiesHeldPostAcquistionOrDisposalPercentageOfShareholding") ?? v(c.id, "SecuritiesHeldPostAcquisitionOrDisposalPercentageOfShareholding")),
    fromDate: v(c.id, "DateOfAllotmentAdviceOrAcquisitionOfSharesOrSaleOfSharesSpecifyFromDate"), toDate: v(c.id, "DateOfAllotmentAdviceOrAcquisitionOfSharesOrSaleOfSharesSpecifyToDate"),
    intimated: v(c.id, "DateOfIntimationToCompany"), disclosedAt, did: meta.appId, pid: c.id, exchange: str(v(c.id, "ExchangeOnWhichTheTradeWasExecuted")),
    derivative: str(v(c.id, "TypeOfContract") ?? v(c.id, "DerivativeTypeOfContract")),
  })).filter((t) => t.symbol);
}

export interface SastDisclosure {
  key: string; symbol: string; acquirer: string; promoter: boolean | null; regType: string; action: string; mode: string; secType: string;
  sharesAcq: number | null; sharesSale: number | null; sharesAfter: number | null; pctAcq: string; pctSale: string; pctAfter: string; period: string; disclosedAt: string | null;
}
export function parseSast(json: string): SastDisclosure[] {
  return rowsOf(json).map((r) => ({
    key: str(r.application_no) || rowKey("sast", r.symbol, r.acquirerName, r.timestamp, r.noOfShareAft),
    symbol: str(r.symbol), acquirer: str(r.acquirerName), promoter: str(r.promoterType) ? str(r.promoterType).toUpperCase() === "Y" : null, regType: str(r.regType),
    action: str(r.acqSaleType), mode: str(r.acquisitionMode), secType: str(r.acqType), sharesAcq: int(r.noOfShareAcq), sharesSale: int(r.noOfShareSale), sharesAfter: int(r.noOfShareAft),
    pctAcq: str(r.totAcqShare), pctSale: str(r.totSaleShare), pctAfter: str(r.totAftShare), period: str(r.acquirerDate), disclosedAt: nseDateTime(r.timestamp ?? r.sysTime),
  })).filter((x) => x.symbol);
}

export interface BoardMeeting { key: string; symbol: string; meetingDate: string | null; purpose: string; description: string; intimation: string; announcedAt: string | null; xbrl: string }
export function parseBoardMeetings(json: string): BoardMeeting[] {
  return rowsOf(json).map((r) => {
    const b = { symbol: str(r.bm_symbol), meetingDate: isoFromNseDate(str(r.bm_date)), purpose: str(r.bm_purpose), description: str(r.bm_desc), intimation: str(r.intimationType), announcedAt: nseDateTime(r.bm_timestamp), xbrl: str(r.attachment) };
    return { key: rowKey("bm", b.symbol, b.meetingDate, b.announcedAt, b.purpose), ...b };
  }).filter((b) => b.symbol);
}

export interface CreditRating {
  key: string; symbol: string; company: string; isin: string; agency: string; rating: string; outlook: string; action: string; ratedOn: string | null;
  earlierRating: string; earlierOutlook: string; disclosedAt: string | null; appId: string;
}
/** DateofCR is dd-mm-yyyy. Symbol "NOTLISTED" = rated entity without listed equity (kept; D127 stores everything). */
export function parseCreditRatings(json: string): CreditRating[] {
  const dmy = (s: string) => { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s); return m ? `${m[3]}-${m[2]}-${m[1]}` : isoFromNseDate(s); };
  return rowsOf(json).map((r) => {
    const c = { symbol: str(r.Symbol), company: str(r.CompanyName), isin: str(r.ISIN), agency: str(r.NameOfCRAgency), rating: str(r.CreditRating), outlook: str(r.Outlook),
      action: str(r.RatingAction) || str(r.SpecifyOthRatingActn), ratedOn: dmy(str(r.DateofCR)), earlierRating: str(r.CreditRatingEarlier), earlierOutlook: str(r.OutlookEarlier),
      disclosedAt: nseDateTime(r.BroadcastDateTime), appId: str(r.AppID) };
    return { key: rowKey("cr", c.appId, c.isin, c.agency, c.rating, c.ratedOn, c.action), ...c };
  }).filter((c) => c.agency && c.rating);
}
