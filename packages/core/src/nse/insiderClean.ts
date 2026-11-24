// C53b: cleaning rules for NSE insider trades (SEBI PIT Reg 7). The ideas come from the public NSE-BSE-Insider-Tracker
// repo's cleaning layer (insiders_clean/insider.py, docs/CLEAN_LAYER.md), re-implemented here in TypeScript on our own
// InsiderTrade rows — no code copied. Pure functions, no I/O. Nothing is corrected and nothing is deleted from storage:
// a row keeps the numbers it was filed with; this layer only LABELS rows (kind, side, role, flags) and says which rows
// are copies of, or replaced by, another row, each with a counted reason.
//
// What the raw rows cannot tell you, and this layer fixes:
//  - Only an open-market trade is a decision to buy or sell. ESOP, gifts, inter-se transfers, pledges, schemes, OFS,
//    allotments are filed the same way. (INFY Q1 2024: 33 of 40 rows are ESOP, 5 off-market, 2 market sales.)
//  - NSE files a pledge, a release, an invocation, or a bare holding disclosure under a buy/sell word; the side must come
//    from the transaction type, with the mode only as a fallback (real filings contradict themselves).
//  - Roles come as free text ("Promoter and Director", "-", "Directors Immediate Relative").
//  - NSE cuts names at ~30 characters, re-files the same trade, and revises a filing with or without prevAppId.
import type { InsiderTrade } from "./events.js";

// ---- classification --------------------------------------------------------------------------------------------------
export type InsiderKind =
  | "market" | "off_market" | "pledge_create" | "pledge_revoke" | "pledge_invoke" | "esop" | "gift" | "inter_se" | "scheme" | "conversion"
  | "offer_for_sale" | "preferential" | "rights" | "bonus" | "buyback" | "transmission" | "allotment" | "other" | "holding_only" | "missing" | "unrecognised";
export type InsiderRole = "promoter" | "promoter_group" | "director" | "kmp" | "designated_person" | "immediate_relative" | "employee" | "other" | "missing";
export type InsiderSide = "BUY" | "SELL";

/** What filers write when a field is empty. */
const BLANK = new Set(["", "-", "--", "na", "n.a.", "nil", "none", "null"]);
/** Mode of acquisition → kind. First match wins, so the specific phrases come before the broad ones. */
const MODE_RULES: [RegExp, InsiderKind][] = [
  [/off[\s-]*market/, "off_market"], [/invo[ck]/, "pledge_invoke"], [/revo[ck]|release/, "pledge_revoke"], [/pledge|encumb/, "pledge_create"],
  [/esop|esos|employee|stock option|sweat/, "esop"], [/gift/, "gift"], [/inter[\s-]*se/, "inter_se"], [/scheme|amalgamat|merger|demerger|arrangement/, "scheme"],
  [/conver|warrant/, "conversion"], [/offer for sale|\bofs\b/, "offer_for_sale"], [/preferential/, "preferential"], [/right/, "rights"], [/bonus/, "bonus"],
  [/buy[\s-]*back/, "buyback"], [/transmission|inherit|succession/, "transmission"], [/allot/, "allotment"],
  // A block or bulk deal is a trade on the exchange: one exchange files the block-window sale as 'Market Sale' and the other
  // as 'Block Deal', and the two must read alike.
  [/block\s*deal|bulk\s*deal/, "market"], [/market\s*(purchase|sale|sell|buy)|open market|on[\s-]*market|market/, "market"], [/^others?$|^any other/, "other"],
];
/** A relative is filed under the insider's own word ("Directors Immediate Relative"), so relative rules come first: a
 *  director's relative is no director. A promoter's immediate relative is promoter group by SEBI's definition. */
const ROLE_RULES: [RegExp, InsiderRole][] = [
  [/promoters?\W*(immediate\s*)?relative/, "promoter_group"], [/immediate\s*relative|relative/, "immediate_relative"], [/promoter\s*group/, "promoter_group"],
  [/promoter/, "promoter"], [/director/, "director"], [/key\s*managerial|\bkmp\b/, "kmp"], [/designated/, "designated_person"], [/employee/, "employee"], [/other/, "other"],
];
/** The transaction type names a pledge, release or invocation where the mode is blank. */
const TYPE_KIND_RULES: [RegExp, InsiderKind][] = [[/invo[ck]/, "pledge_invoke"], [/revo[ck]|releas/, "pledge_revoke"], [/pledge|encumb/, "pledge_create"]];

const low = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function classifyMode(mode: unknown): InsiderKind {
  const s = low(mode);
  if (BLANK.has(s)) return "missing";
  return MODE_RULES.find(([re]) => re.test(s))?.[1] ?? "unrecognised";
}
/** A pledge kind from the filed transaction type, or null. */
export function kindFromType(txn: unknown): InsiderKind | null {
  const s = low(txn);
  return TYPE_KIND_RULES.find(([re]) => re.test(s))?.[1] ?? null;
}
export function classifyRole(category: unknown): InsiderRole {
  const s = low(category);
  if (BLANK.has(s)) return "missing";
  return ROLE_RULES.find(([re]) => re.test(s))?.[1] ?? "other";
}
const isPledge = (k: InsiderKind) => k.startsWith("pledge_");
function sideWord(text: unknown): InsiderSide | null {
  const t = String(text ?? "").toUpperCase();
  if (/PLEDGE|REVOK|INVOC|INVOK/.test(t) && !/BUY|SELL|PURCHASE|SALE/.test(t)) return null;
  if (/BUY|ACQUI|PURCHASE/.test(t)) return "BUY";
  if (/SELL|DISPOS|SALE/.test(t)) return "SELL";
  return null;
}
/** The transaction type decides; the mode is only a fallback (real filings contradict themselves: mode 'Market Purchase',
 *  type 'Disposal', holding 37,894 → 37,104 is a sale). */
export const sideOf = (txn: unknown, mode: unknown): InsiderSide | null => sideWord(txn) ?? sideWord(mode);

// ---- holding check ---------------------------------------------------------------------------------------------------
export type HoldingCheck = "match" | "differs" | "against_side" | "against_side_and_differs" | "not_filed" | "not_applicable";
/** Holding after − holding before against the shares traded. `differs` = size off by more than 1% or 1 share;
 *  `against_side` = right size, wrong direction (a buy that lowers the holding). A pledge leaves the holding unchanged by
 *  design, so pledges and rows without a side are not applicable. */
export function holdingCheck(r: { side: InsiderSide | null; kind: InsiderKind; qty: number | null; beforeQty: number | null; afterQty: number | null }): HoldingCheck {
  if (!r.side || isPledge(r.kind)) return "not_applicable";
  if (r.qty === null || !(r.qty > 0) || r.beforeQty === null || r.afterQty === null) return "not_filed";
  const moved = r.afterQty - r.beforeQty, sizeOk = Math.abs(Math.abs(moved) - r.qty) <= Math.max(r.qty * 0.01, 1);
  const against = moved * (r.side === "BUY" ? 1 : -1) < 0;
  return sizeOk ? (against ? "against_side" : "match") : (against ? "against_side_and_differs" : "differs");
}

// ---- Reg 7(2) deadlines ----------------------------------------------------------------------------------------------
/** SEBI PIT Reg 7(2)(a) insider → company and 7(2)(b) company → exchange: each within 2 trading sessions. */
export const DISCLOSURE_LIMIT_SESSIONS = 2;
/** Sessions in (start, end], from a sorted ascending list of trading days (YYYY-MM-DD). null when the list does not cover
 *  both dates (the answer would be a guess). */
export function sessionsAfter(sessions: readonly string[], start: string | null, end: string | null): number | null {
  if (!start || !end || sessions.length === 0 || start < sessions[0]! || end > sessions[sessions.length - 1]!) return null;
  if (end <= start) return 0;
  const upTo = (d: string) => { let lo = 0, hi = sessions.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sessions[m]! <= d) lo = m + 1; else hi = m; } return lo; };
  return upTo(end) - upTo(start);
}

// ---- names -----------------------------------------------------------------------------------------------------------
/** One key per person: lower case, punctuation and whitespace (a stray newline too) become single dashes. */
export const personKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const TRUNCATION_MIN_KEY = 15;            // a shorter key is too ambiguous to merge
const TRUNCATION_RAW_LEN: [number, number] = [26, 32];   // a name cut at a word boundary is only "cut" when its raw spelling is about NSE's cut
const OTHER_PERSON_WORDS = new Set(["huf", "trust", "family", "foundation", "estate", "minor"]);
const CORPORATE_WORDS = new Set(["private", "limited", "llp", "company", "corporation", "holding", "holdings", "investment", "investments", "ventures", "enterprises", "capital", "fund", "industries", "associates", "partners", "finance", "securities", "international", "inc"]);
/** `long` starts with `short`: is `short` the same name cut short? Cut mid-word: yes. Cut at a word boundary: only when the
 *  raw spelling is as long as NSE's cut, and the added words never make another person (an HUF, a trust; a company when
 *  `short` is no company). "Ramesh Kumar Agarwal" and "Ramesh Kumar Agarwal HUF" are two people. */
function isTruncation(short: string, long: string, rawLen: number): boolean {
  if (long[short.length] !== "-") return true;
  if (rawLen < TRUNCATION_RAW_LEN[0] || rawLen > TRUNCATION_RAW_LEN[1]) return false;
  const added = long.slice(short.length + 1).split("-");
  if (added.some((w) => OTHER_PERSON_WORDS.has(w))) return false;
  return !added.some((w) => CORPORATE_WORDS.has(w)) || short.split("-").some((w) => CORPORATE_WORDS.has(w));
}

// ---- cleaning --------------------------------------------------------------------------------------------------------
/** What the cleaner reads from a stored or freshly parsed row. Dates are ISO (YYYY-MM-DD); `disclosedAt` is the broadcast
 *  time. `appId` is NSE's filing number (for new-system rows, `did`); `prevAppId` / `submissionType` are NSE's revision
 *  markers from the filing list, when the caller has them. */
export type InsiderInput = Pick<InsiderTrade, "key" | "symbol" | "person" | "category" | "secType" | "txn" | "mode" | "qty" | "valueRs" | "beforeQty" | "afterQty" | "fromDate" | "toDate" | "intimated" | "disclosedAt">
  & { appId?: string; prevAppId?: string; submissionType?: string };

export interface CleanTrade extends InsiderInput {
  kind: InsiderKind; isMarket: boolean; side: InsiderSide | null; role: InsiderRole; roleSource: "filing" | "same_person_other_filing" | "missing";
  personId: string; personName: string; value: number | null; price: number | null; holdingChangePct: number | null; holdingCheck: HoldingCheck;
  insiderToCompanySessions: number | null; insiderFiledLate: boolean | null; companyToExchangeSessions: number | null; companyFiledLate: boolean | null;
  flags: string[]; marks: string[]; needsReview: boolean;
}
export type RemovalReason = "superseded_by_revision" | "superseded_by_revision_marker" | "corrected_refiling" | "repeat_filing" | "refiled_with_other_holdings";
export interface CleanResult { trades: CleanTrade[]; removed: { key: string; reason: RemovalReason }[]; counts: Record<string, unknown> }
export interface CleanOptions {
  /** Today (YYYY-MM-DD) for the future-date flags. Required: the cleaner never reads a clock. */
  runDate: string;
  /** Trading days, sorted ascending, for the Reg 7(2) deadlines. Without it the deadline fields are null. */
  sessions?: readonly string[];
}

/** A holding base below this makes a % change meaningless (a small base turns an ordinary buy into a four-digit %). */
export const HOLDING_BASE_MIN = 25_000;
/** A market trade that multiplies the person's holding by more than this is almost never an open-market buy. */
export const HOLDING_MULTIPLE_REVIEW = 20;
/** Promoter-group transfers on the market: prices of the two sides within 2%. */
export const GROUP_TRANSFER_PRICE_GAP = 0.02;

const num = (v: string): number | null => { const n = Number(String(v ?? "").replace(/,/g, "")); return String(v ?? "").trim() !== "" && Number.isFinite(n) ? n : null; };
const count = (xs: Iterable<string>) => { const o: Record<string, number> = {}; for (const x of xs) o[x] = (o[x] ?? 0) + 1; return o; };
const groupBy = <T>(xs: readonly T[], key: (x: T) => string) => { const m = new Map<string, T[]>(); for (const x of xs) { const k = key(x); (m.get(k) ?? m.set(k, []).get(k)!).push(x); } return m; };
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

export function cleanInsiderTrades(input: readonly InsiderInput[], opts: CleanOptions): CleanResult {
  const sessions = opts.sessions ?? [];
  // --- classification ---
  let rows: CleanTrade[] = input.map((r) => {
    let kind = classifyMode(r.mode);
    const byType = kindFromType(r.txn);
    if (kind === "missing" && byType) kind = byType;
    let side = sideOf(r.txn, r.mode);
    const value = num(r.valueRs);
    // Holding-only disclosures (on appointment, on becoming a promoter): no shares change hands, yet a blank type is filed as a
    // buy. Recognised from the numbers, not the wording: no quantity, no value, a holding filed and unchanged.
    const hb = r.beforeQty, ha = r.afterQty;
    if (!(r.qty !== null && r.qty > 0) && !(value !== null && value > 0) && !isPledge(kind) && (hb !== null || ha !== null) && !(hb !== null && ha !== null && hb !== ha)) { kind = "holding_only"; side = null; }
    if (isPledge(kind)) side = null;  // a pledge moves no shares between owners
    const role = classifyRole(r.category);
    return { ...r, kind, isMarket: kind === "market", side, role, roleSource: role === "missing" ? "missing" : "filing", personId: personKey(r.person), personName: r.person.trim(), value,
      price: r.qty !== null && r.qty > 0 && value !== null ? value / r.qty : null,
      holdingChangePct: hb !== null && ha !== null && hb >= HOLDING_BASE_MIN ? (ha - hb) / hb * 100 : null,
      holdingCheck: "not_applicable", insiderToCompanySessions: null, insiderFiledLate: null, companyToExchangeSessions: null, companyFiledLate: null, flags: [], marks: [], needsReview: false };
  });

  // --- truncated names: within one company, a key that is a prefix of exactly one longer key is that person cut short ---
  const rawLen = new Map<string, number>();
  for (const r of rows) rawLen.set(r.personId, Math.max(rawLen.get(r.personId) ?? 0, r.person.trim().length));
  const remap = new Map<string, string>();
  for (const [sym, grp] of groupBy(rows, (r) => r.symbol)) {
    const ids = [...new Set(grp.map((r) => r.personId))].filter(Boolean).sort((a, b) => b.length - a.length);
    for (const short of ids) {
      if (short.length < TRUNCATION_MIN_KEY) continue;
      const longer = ids.filter((i) => i.length > short.length && i.startsWith(short) && !remap.has(`${sym}\u001f${i}`));
      if (longer.length === 1 && isTruncation(short, longer[0]!, rawLen.get(short) ?? 0)) remap.set(`${sym}\u001f${short}`, longer[0]!);
    }
  }
  let namesMerged = 0;
  for (const r of rows) { const to = remap.get(`${r.symbol}\u001f${r.personId}`); if (to) { r.personId = to; namesMerged++; } }
  const longest = new Map<string, string>();
  for (const r of rows) { const k = `${r.symbol}\u001f${r.personId}`, cur = longest.get(k); if (!cur || r.person.trim().length > cur.length) longest.set(k, r.person.trim()); }
  for (const r of rows) r.personName = longest.get(`${r.symbol}\u001f${r.personId}`) ?? r.personName;

  // --- a missing role takes the role the same person filed elsewhere in the same company (most common wins) ---
  const roleVotes = new Map<string, Record<string, number>>();
  for (const r of rows) if (r.role !== "missing" && r.personId) { const k = `${r.symbol}\u001f${r.personId}`, v = roleVotes.get(k) ?? roleVotes.set(k, {}).get(k)!; v[r.role] = (v[r.role] ?? 0) + 1; }
  let rolesFilled = 0;
  for (const r of rows) {
    if (r.role !== "missing" || !r.personId) continue;
    const v = roleVotes.get(`${r.symbol}\u001f${r.personId}`);
    const best = v ? Object.entries(v).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
    if (best) { r.role = best as InsiderRole; r.roleSource = "same_person_other_filing"; rolesFilled++; }
  }

  // --- removals: a filing replaced by a later one, or a copy of another row. Nothing is deleted from storage. ---
  const removed: { key: string; reason: RemovalReason }[] = [];
  const gone = new Set<CleanTrade>();   // by object, not key: identical filed rows share a key (the stored table collapses them on insert)
  const drop = (rs: Iterable<CleanTrade>, reason: RemovalReason) => { for (const r of rs) if (!gone.has(r)) { gone.add(r); removed.push({ key: r.key, reason }); } };
  // (1) a filing whose prevAppId names a filing we hold replaces it
  const known = new Set(rows.map((r) => r.appId).filter((a): a is string => !!a));
  const replaced = new Set(rows.map((r) => r.prevAppId).filter((a): a is string => !!a && known.has(a)));
  drop(rows.filter((r) => r.appId && replaced.has(r.appId)), "superseded_by_revision");
  // (2) a filing NSE lists as 'Revision' without a prevAppId we can follow replaces the one earlier filing with rows of the same person, trade
  // dates and kind (preferring the same side): that catches a corrected quantity or value, which the content match below cannot.
  const marker = { revision_rows: 0, replaced_rows: 0, ambiguous: 0, no_original: 0 };
  const live = () => rows.filter((r) => !gone.has(r));
  const isMarked = (r: CleanTrade) => /^revis/i.test((r.submissionType ?? "").trim()) && (!r.prevAppId || !known.has(r.prevAppId));
  const tradeKey = (r: CleanTrade) => [r.symbol, r.personId, r.fromDate ?? r.toDate, r.toDate, r.kind].join("\u001f");
  const marked = live().filter(isMarked);
  marker.revision_rows = marked.length;
  const pool0 = groupBy(live().filter((r) => r.toDate && r.disclosedAt), tradeKey);
  for (const [, g] of groupBy(marked.filter((r) => r.toDate && r.disclosedAt), (r) => `${r.appId ?? ""}\u001f${tradeKey(r)}`)) {
    const at = g.map((r) => r.disclosedAt!).sort().at(-1)!;
    const pool = (pool0.get(tradeKey(g[0]!)) ?? []).filter((r) => (r.appId ?? "") !== (g[0]!.appId ?? "") && r.disclosedAt! < at && !gone.has(r));
    if (!pool.length) { marker.no_original += g.length; continue; }
    const sides = new Set(g.map((r) => r.side).filter(Boolean));
    const same = sides.size ? pool.filter((r) => r.side && sides.has(r.side)) : pool;
    const apps = [...new Set((same.length ? same : pool).map((r) => r.appId ?? ""))];
    if (apps.length !== 1) { marker.ambiguous += g.length; continue; }
    const hit = pool.filter((r) => (r.appId ?? "") === apps[0]);
    drop(hit, "superseded_by_revision_marker"); marker.replaced_rows += hit.length;
  }
  // (3) content: same company, person, side, quantity, value (to the nearest Rs 10: NSE's two files of one filing round a rupee
  // apart), trade dates and holdings. The latest broadcast wins; on a tie the copy that filed a mode. If the mode changed it was
  // a correction, otherwise a repeat.
  const appNum = (r: CleanTrade) => { const n = Number(r.appId); return Number.isFinite(n) ? n : -1; };
  const latestFirst = [...live()].sort((a, b) => (b.disclosedAt ?? "").localeCompare(a.disclosedAt ?? "") || appNum(b) - appNum(a) || Number(low(b.mode) !== "") - Number(low(a.mode) !== ""));
  const contentKey = (r: CleanTrade) => [r.symbol, r.personId, r.side ?? "-", r.qty, r.value === null ? "" : Math.round(r.value / 10) * 10, r.fromDate, r.toDate, r.beforeQty, r.afterQty].join("\u001f");
  const keptByContent = new Map<string, CleanTrade>();
  const duplicates: CleanTrade[] = [];
  for (const r of latestFirst) { const k = contentKey(r); if (keptByContent.has(k)) duplicates.push(r); else keptByContent.set(k, r); }
  // Why copies were removed: the same filing listed twice (same filing number), or the trade filed again under another number.
  const breakdown = { same_filing_id: 0, different_filing_id: 0, no_filing_id: 0 };
  for (const r of duplicates) { const a = r.appId, b = keptByContent.get(contentKey(r))!.appId; breakdown[!a || !b ? "no_filing_id" : a === b ? "same_filing_id" : "different_filing_id"]++; }
  drop(duplicates.filter((r) => low(r.mode) !== low(keptByContent.get(contentKey(r))!.mode)), "corrected_refiling");
  drop(duplicates, "repeat_filing");
  // (4) a trade filed again with other holdings: same company, person, side, shares, value and dates, holdings typed differently, and the rows
  // not one after the other (no row's holding after is another's holding before: that would be two tranches). The latest broadcast is kept.
  const sized = latestFirst.filter((r) => !gone.has(r) && r.personId && r.qty !== null && r.qty > 0 && r.value !== null && r.value > 0);
  const refKey = (r: CleanTrade) => [r.symbol, r.personId, r.side ?? "-", r.qty, r.value === null ? "" : Math.round(r.value / 10) * 10, r.fromDate, r.toDate].join("\u001f");
  for (const [, g] of groupBy(sized, refKey)) {
    if (g.length < 2) continue;
    const before = new Set(g.map((r) => r.beforeQty).filter((x) => x !== null)), after = new Set(g.map((r) => r.afterQty).filter((x) => x !== null));
    if ([...before].some((b) => after.has(b))) continue;   // tranches
    drop(g.slice(1), "refiled_with_other_holdings");
  }
  rows = live();

  // --- promoter-group transfers on the market: a promoter or promoter-group market buy and another's market sale of one company, same
  // trade dates, same shares, prices within 2%, paired one to one. The group holds what it held: read as inter-se, never market. ---
  let groupTransfers = 0;
  const cand = rows.filter((r) => r.kind === "market" && (r.role === "promoter" || r.role === "promoter_group") && r.side && r.qty !== null && r.qty > 0 && r.toDate && r.price !== null);
  for (const [, g] of groupBy(cand, (r) => [r.symbol, r.fromDate ?? r.toDate, r.toDate, r.qty].join("\u001f"))) {
    const sells = g.filter((r) => r.side === "SELL");
    for (const b of g.filter((r) => r.side === "BUY")) {
      const k = sells.findIndex((s) => s.personId !== b.personId && s.price! > 0 && Math.abs(b.price! - s.price!) <= GROUP_TRANSFER_PRICE_GAP * s.price!);
      if (k < 0) continue;
      for (const r of [b, sells[k]!]) { r.kind = "inter_se"; r.isMarket = false; r.marks.push("promoter_group_transfer"); groupTransfers++; }
      sells.splice(k, 1);
    }
  }

  // --- checks: each row is kept, flagged rows are held back from rankings until looked at ---
  for (const r of rows) {
    r.holdingCheck = holdingCheck(r);
    const f = r.flags, from = r.fromDate, to = r.toDate, intim = r.intimated, bc = day(r.disclosedAt);
    const st = r.secType.trim().toLowerCase();
    // Only equity shares are the company's shares: ADR/GDR/FCCB, warrants, derivatives, debentures, 'any other instrument' are held back.
    // (INFY Q1 2024: 34 of 40 rows are ADR/GDR/FCCB.) Blank is taken as shares, as filed.
    if (st !== "" && !st.includes("equity")) f.push("not_equity_shares");
    if (r.kind === "unrecognised" || r.kind === "missing") f.push("unrecognised_mode");
    if (r.isMarket) {
      const m = r.afterQty !== null && r.beforeQty !== null && r.beforeQty > 0 ? r.afterQty / r.beforeQty : null;
      if (m !== null && m > HOLDING_MULTIPLE_REVIEW) f.push("holding_jump_on_market_trade");
    }
    if (r.holdingCheck === "differs" || r.holdingCheck === "against_side_and_differs") f.push("holding_change_differs_from_quantity");
    if (r.holdingCheck.startsWith("against_side")) f.push("holding_moves_against_side");
    if (r.isMarket && r.qty !== null && r.qty > 0 && !(r.value !== null && r.value > 0)) f.push("missing_or_zero_value");
    if (r.isMarket && !(r.qty !== null && r.qty > 0)) f.push("missing_quantity");
    const modeSide = sideWord(r.mode);
    if (r.isMarket && modeSide && r.side && modeSide !== r.side) f.push("mode_contradicts_side");
    if ((from && to && from > to) || (intim && bc && intim > bc)) f.push("dates_out_of_order");
    if ((to && intim && to > intim) || (to && bc && to > bc)) f.push("disclosed_before_trade");
    if (to && to > opts.runDate) f.push("trade_date_in_future");
    if ((intim && intim > opts.runDate) || (bc && bc > opts.runDate)) f.push("disclosure_dated_in_future");
    // Reg 7(2) deadlines in trading sessions (null when no session list covers the dates)
    r.insiderToCompanySessions = sessionsAfter(sessions, to, intim);
    r.companyToExchangeSessions = sessionsAfter(sessions, intim, bc);
    r.insiderFiledLate = r.insiderToCompanySessions === null ? null : r.insiderToCompanySessions > DISCLOSURE_LIMIT_SESSIONS;
    r.companyFiledLate = r.companyToExchangeSessions === null ? null : r.companyToExchangeSessions > DISCLOSURE_LIMIT_SESSIONS;
    r.needsReview = f.length > 0;
  }

  const flagCounts = count(rows.flatMap((r) => r.flags)), byReason = count(removed.map((x) => x.reason));
  return { trades: rows, removed, counts: {
    input_rows: input.length, output_rows: rows.length, removed: byReason, kinds: count(rows.map((r) => r.kind)), roles: count(rows.map((r) => r.role)),
    flags: flagCounts, needs_review: rows.filter((r) => r.needsReview).length, holding_check: count(rows.map((r) => r.holdingCheck)), revision_marker: marker,
    removal_breakdown: breakdown, names_merged: namesMerged, roles_filled_from_other_filings: rolesFilled, roles_still_missing: rows.filter((r) => r.role === "missing").length,
    promoter_group_transfers_on_market: groupTransfers, market_trades: rows.filter((r) => r.isMarket).length,
  } };
}
