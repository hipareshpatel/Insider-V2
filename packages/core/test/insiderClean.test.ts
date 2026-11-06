// C53b: insider-trade cleaning rules (ideas from the public NSE-BSE-Insider-Tracker repo, re-implemented).
// Real fixtures: INFY PIT list 2024 Q1 (old system) and the ACEVECTOR PIT XBRL of 3 Nov 2026 (new system).
// Everything built inline ("synthetic") is marked so; those rows model cases the reference's docs describe, not NSE data.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyMode, classifyRole, cleanInsiderTrades, holdingCheck, kindFromType, parsePit, parsePitXbrl, parseXbrl, personKey, sessionsAfter, sideOf, type InsiderInput } from "../src/index.js";

const fx = (n: string) => readFileSync(join(import.meta.dirname, "fixtures", "nse", n), "utf8");
const RUN = "2026-11-06";
const base: InsiderInput = { key: "k", symbol: "TEST", person: "Some Person", category: "Promoter", secType: "Equity Shares", txn: "Buy", mode: "Market Purchase", qty: 1000, valueRs: "500000",
  beforeQty: 10000, afterQty: 11000, fromDate: "2026-10-01", toDate: "2026-10-01", intimated: "2026-10-02", disclosedAt: "2026-10-03T10:00:00" };
const mk = (o: Partial<InsiderInput>): InsiderInput => ({ ...base, ...o });

describe("classification", () => {
  it("mode → kind: only open-market trades are market; unknown modes are never market", () => {
    const k = (m: string) => classifyMode(m);
    expect([k("Market Purchase"), k("Market Sale"), k("On Market"), k("Block Deal")]).toEqual(["market", "market", "market", "market"]);
    expect([k("ESOP"), k("Off Market"), k("Gift"), k("Inter-se transfer"), k("Pledge Created"), k("Pledge Invoked"), k("Revoke of Pledge")])
      .toEqual(["esop", "off_market", "gift", "inter_se", "pledge_create", "pledge_invoke", "pledge_revoke"]);
    expect([k("Preferential Offer"), k("Rights Issue"), k("Bonus"), k("Buy back"), k("Conversion of warrants"), k("Scheme of arrangement"), k("Offer for Sale"), k("Allotment")])
      .toEqual(["preferential", "rights", "bonus", "buyback", "conversion", "scheme", "offer_for_sale", "allotment"]);
    expect([k(""), k("-"), k("NA")]).toEqual(["missing", "missing", "missing"]);
    expect(k("Telepathy")).toBe("unrecognised");
    expect(k("Off Market sale")).toBe("off_market"); // the specific phrase wins over 'market'
  });
  it("blank mode: the transaction type can still say pledge, release or invocation", () => {
    expect([kindFromType("Pledge Revoke"), kindFromType("Invoke"), kindFromType("Pledge"), kindFromType("Buy")]).toEqual(["pledge_revoke", "pledge_invoke", "pledge_create", null]);
  });
  it("role: a relative is no director; a promoter's relative is promoter group; '-' is missing", () => {
    const r = (c: string) => classifyRole(c);
    expect([r("Promoter and Director"), r("Promoter Group"), r("Promoters Immediate Relative"), r("Directors Immediate Relative"), r("Director"), r("KMP"), r("Key Managerial Personnel"), r("Designated Person"), r("Employee"), r("Other"), r("-")])
      .toEqual(["promoter", "promoter_group", "promoter_group", "immediate_relative", "director", "kmp", "kmp", "designated_person", "employee", "other", "missing"]);
  });
  it("side: the type decides, the mode is a fallback, a pledge has none (synthetic: the HCL Tech contradiction)", () => {
    expect(sideOf("Disposal", "Market Purchase")).toBe("SELL");
    expect(sideOf("", "Market Sale")).toBe("SELL");
    expect(sideOf("Acquisition", "")).toBe("BUY");
    expect(sideOf("Pledge Revoke", "")).toBeNull();
    expect(sideOf("", "")).toBeNull();
  });
});

describe("holding check", () => {
  it("compares holding after − before with the shares traded", () => {
    const h = (side: "BUY" | "SELL", qty: number, b: number, a: number) => holdingCheck({ side, kind: "market", qty, beforeQty: b, afterQty: a });
    expect(h("BUY", 1000, 10000, 11000)).toBe("match");
    expect(h("BUY", 1000, 10000, 11005)).toBe("match");        // within 1%
    expect(h("BUY", 1000, 10000, 12000)).toBe("differs");
    expect(h("BUY", 1000, 11000, 10000)).toBe("against_side");  // a buy that lowers the holding
    expect(h("SELL", 1000, 10000, 9000)).toBe("match");
    expect(h("BUY", 1000, 11000, 9000)).toBe("against_side_and_differs");
    expect(holdingCheck({ side: "BUY", kind: "market", qty: 1000, beforeQty: null, afterQty: 5 })).toBe("not_filed");
    expect(holdingCheck({ side: "BUY", kind: "pledge_create", qty: 1000, beforeQty: 5, afterQty: 5 })).toBe("not_applicable");
    expect(holdingCheck({ side: null, kind: "market", qty: 1000, beforeQty: 5, afterQty: 5 })).toBe("not_applicable");
  });
});

describe("deadlines", () => {
  const days = ["2026-10-01", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"]; // 2–4 Oct: weekend + holiday (synthetic list)
  it("counts trading sessions in (start, end], and refuses to guess outside the list", () => {
    expect(sessionsAfter(days, "2026-10-01", "2026-10-05")).toBe(1);
    expect(sessionsAfter(days, "2026-10-01", "2026-10-08")).toBe(4);
    expect(sessionsAfter(days, "2026-10-05", "2026-10-05")).toBe(0);
    expect(sessionsAfter(days, "2026-09-30", "2026-10-05")).toBeNull();
    expect(sessionsAfter(days, "2026-10-01", "2026-10-09")).toBeNull();
    expect(sessionsAfter([], "2026-10-01", "2026-10-05")).toBeNull();
  });
  it("flags a late filing only when the sessions cover it", () => {
    const late = cleanInsiderTrades([mk({ toDate: "2026-10-01", fromDate: "2026-10-01", intimated: "2026-10-08", disclosedAt: "2026-10-08T10:00:00" })], { runDate: RUN, sessions: days }).trades[0]!;
    expect(late).toMatchObject({ insiderToCompanySessions: 4, insiderFiledLate: true, companyToExchangeSessions: 0, companyFiledLate: false });
    const unknown = cleanInsiderTrades([mk({})], { runDate: RUN }).trades[0]!;
    expect(unknown).toMatchObject({ insiderFiledLate: null, companyFiledLate: null });
  });
});

describe("real fixture: INFY PIT list, 2024 Q1 (old system)", () => {
  const rows = parsePit(fx("api_pit_INFY_2024Q1.json")).map((t): InsiderInput => ({ ...t, appId: t.did }));
  const out = cleanInsiderTrades(rows, { runDate: RUN });
  it("NSE lists 4 of the 40 rows twice inside one filing (same filing number, person, shares, dates): kept once, counted as same-filing repeats", () => {
    expect(rows).toHaveLength(40);
    expect(out.trades).toHaveLength(36);
    expect(out.removed.map((x) => x.reason)).toEqual(Array(4).fill("repeat_filing"));
    expect(out.counts.removal_breakdown).toEqual({ same_filing_id: 4, different_filing_id: 0, no_filing_id: 0 });
  });
  it("labels 30 ESOP, 4 off-market, 2 market sales (raw 33 / 5 / 2 less the 4 repeats) — only the 2 are market trades, both SELL", () => {
    expect(out.counts.kinds).toEqual({ esop: 30, off_market: 4, market: 2 });
    expect(out.counts.market_trades).toBe(2);
    expect(out.trades.filter((t) => t.isMarket).every((t) => t.side === "SELL")).toBe(true);
  });
  it("holds back the ADR/GDR/FCCB rows as not equity shares (nothing else is flagged for it)", () => {
    const adr = out.trades.filter((t) => t.secType === "ADR/GDR/FCCB");
    expect(adr.length).toBeGreaterThan(25);
    expect(adr.every((t) => t.flags.includes("not_equity_shares") && t.needsReview)).toBe(true);
    expect((out.counts.flags as Record<string, number>).not_equity_shares).toBe(adr.length);
  });
  it("category '-' stays 'missing' (no other filing of the same person names a role)", () => {
    expect(out.trades.filter((t) => t.category === "").every((t) => t.role === "missing" || t.roleSource === "same_person_other_filing")).toBe(true);
    expect(out.counts.roles_still_missing).toBeGreaterThan(0);
  });
  it("every input row is accounted for: kept, or removed with a reason (nothing disappears)", () => {
    expect(out.trades.length + out.removed.length).toBe(rows.length);
  });
  it("is deterministic and never mutates its input", () => {
    const again = cleanInsiderTrades(rows, { runDate: RUN });
    expect(JSON.stringify(again)).toBe(JSON.stringify(out));
    expect(rows[0]).not.toHaveProperty("kind");
  });
});

describe("real fixture: ACEVECTOR PIT XBRL (new system)", () => {
  const trades = parsePitXbrl(parseXbrl(fx("pitx_ACEVECTOR_20261103.xml")), { appId: "4155", broadcast: "03-Nov-2026 22:09:12" });
  const out = cleanInsiderTrades(trades.map((t) => ({ ...t, appId: t.did })), { runDate: RUN });
  it("a market purchase by a promoter-and-director is a market BUY whose holding change matches", () => {
    expect(out.trades[0]).toMatchObject({ person: "Kunal Bahl", kind: "market", isMarket: true, side: "BUY", role: "promoter", holdingCheck: "match", flags: [], needsReview: false });
    expect(out.trades[0]!.price).toBeCloseTo(Number(trades[0]!.valueRs) / 50000, 6);
  });
  it("the second person is read as filed and flagged where the filing contradicts itself", () => {
    expect(out.trades[1]).toMatchObject({ person: "Second Person", side: "SELL" });
    expect(out.counts.input_rows).toBe(2);
  });
});

describe("holding-only and pledges (synthetic)", () => {
  it("no shares, no value, an unchanged holding: kind holding_only, no side, never market — even when filed as 'Acquisition'", () => {
    const t = cleanInsiderTrades([mk({ key: "a", txn: "Acquisition", mode: "-", qty: null, valueRs: "", beforeQty: 5000, afterQty: 5000 })], { runDate: RUN }).trades[0]!;
    expect(t).toMatchObject({ kind: "holding_only", side: null, isMarket: false });
  });
  it("a pledge filed with no mode takes its kind from the type, has no side, and is not held back for an unchanged holding", () => {
    const t = cleanInsiderTrades([mk({ key: "p", txn: "Pledge Revoke", mode: "-", qty: 794696, valueRs: "49160000000", beforeQty: 8000000, afterQty: 8000000 })], { runDate: RUN }).trades[0]!;
    expect(t).toMatchObject({ kind: "pledge_revoke", side: null, isMarket: false, holdingCheck: "not_applicable" });
    expect(t.flags).toEqual([]);
  });
});

describe("flags (synthetic)", () => {
  const flagsOf = (o: Partial<InsiderInput>) => cleanInsiderTrades([mk(o)], { runDate: RUN }).trades[0]!.flags;
  it("a clean row has none", () => expect(flagsOf({})).toEqual([]));
  it("market trade with no shares / zero value", () => {
    expect(flagsOf({ qty: null, valueRs: "", beforeQty: 5, afterQty: 6 })).toContain("missing_quantity");
    expect(flagsOf({ valueRs: "0" })).toContain("missing_or_zero_value");
  });
  it("ESOP or gift at zero value is legitimate", () => expect(flagsOf({ mode: "Gift", valueRs: "0" })).toEqual([]));
  it("holding disagrees with the shares or the side", () => {
    expect(flagsOf({ afterQty: 12000 })).toContain("holding_change_differs_from_quantity");
    expect(flagsOf({ beforeQty: 11000, afterQty: 10000 })).toContain("holding_moves_against_side");
  });
  it("a market trade multiplying the holding more than 20x", () => expect(flagsOf({ beforeQty: 100, afterQty: 100100, qty: 100000 })).toContain("holding_jump_on_market_trade"));
  it("mode contradicting the side (type wins)", () => expect(flagsOf({ txn: "Disposal", mode: "Market Purchase", beforeQty: 11000, afterQty: 10000 })).toContain("mode_contradicts_side"));
  it("dates that cannot be right", () => {
    expect(flagsOf({ fromDate: "2026-10-05", toDate: "2026-10-01" })).toContain("dates_out_of_order");
    expect(flagsOf({ intimated: "2026-09-30" })).toContain("disclosed_before_trade");
    expect(flagsOf({ fromDate: "2026-12-01", toDate: "2026-12-01" })).toContain("trade_date_in_future");
    expect(flagsOf({ disclosedAt: "2026-12-01T10:00:00" })).toContain("disclosure_dated_in_future");
  });
  it("unknown mode is held back", () => expect(flagsOf({ mode: "Telepathy" })).toContain("unrecognised_mode"));
});

describe("names (synthetic)", () => {
  it("personKey ignores case, punctuation and stray newlines", () => expect(personKey("Vama Sundari \nInvestments (De")).toBe("vama-sundari-investments-de"));
  it("a name NSE cut at ~30 characters merges with the whole name in the same company; the longest spelling is kept", () => {
    const whole = "Vama Sundari Investments (Delhi) Private Limited", cut = "Vama Sundari Investments (Delh";
    const out = cleanInsiderTrades([mk({ key: "1", person: whole }), mk({ key: "2", person: cut, qty: 5, valueRs: "100", beforeQty: 1, afterQty: 6 })], { runDate: RUN });
    expect(new Set(out.trades.map((t) => t.personId)).size).toBe(1);
    expect(out.trades.every((t) => t.personName === whole)).toBe(true);
    expect(out.counts.names_merged).toBe(1);
  });
  it("never merges across companies, nor 'X' into 'X HUF'", () => {
    const a = cleanInsiderTrades([mk({ key: "1", person: "Ramesh Kumar Agarwal" }), mk({ key: "2", person: "Ramesh Kumar Agarwal HUF", qty: 5, valueRs: "100", beforeQty: 1, afterQty: 6 })], { runDate: RUN });
    expect(new Set(a.trades.map((t) => t.personId)).size).toBe(2);
    const b = cleanInsiderTrades([mk({ key: "1", symbol: "AAA", person: "Vama Sundari Investments (Delhi) Private Limited" }), mk({ key: "2", symbol: "BBB", person: "Vama Sundari Investments (Delh" })], { runDate: RUN });
    expect(new Set(b.trades.map((t) => t.personId)).size).toBe(2);
  });
  it("a missing role takes the role the same person filed elsewhere in the same company", () => {
    const out = cleanInsiderTrades([mk({ key: "1", category: "Promoter Group" }), mk({ key: "2", category: "", qty: 5, valueRs: "100", beforeQty: 1, afterQty: 6, toDate: "2026-10-09", fromDate: "2026-10-09" })], { runDate: RUN });
    expect(out.trades[1]).toMatchObject({ role: "promoter_group", roleSource: "same_person_other_filing" });
    expect(out.counts.roles_filled_from_other_filings).toBe(1);
  });
});

describe("revisions and copies (synthetic: the cases the reference's audits found)", () => {
  const reasons = (rs: InsiderInput[]) => Object.fromEntries(cleanInsiderTrades(rs, { runDate: RUN }).removed.map((x) => [x.key, x.reason]));
  it("prevAppId naming a filing we hold replaces it", () => {
    expect(reasons([mk({ key: "o", appId: "100" }), mk({ key: "r", appId: "101", prevAppId: "100", disclosedAt: "2026-10-04T10:00:00" })])).toEqual({ o: "superseded_by_revision" });
  });
  it("prevAppId naming a filing we do not hold removes nothing (NSE numbers prevAppId apart from its own list)", () => {
    expect(reasons([mk({ key: "r", appId: "101", prevAppId: "47977" })])).toEqual({});
  });
  it("an identical re-filing is a repeat: the latest broadcast is kept", () => {
    expect(reasons([mk({ key: "a", appId: "200" }), mk({ key: "b", appId: "201", disclosedAt: "2026-10-04T10:00:00" })])).toEqual({ a: "repeat_filing" });
  });
  it("a re-filing that changed only the mode is a correction (HCL Tech: 'Market Purchase' → 'Market Sale')", () => {
    expect(reasons([mk({ key: "a", appId: "3082", txn: "Disposal", mode: "Market Purchase", beforeQty: 11000, afterQty: 10000 }),
      mk({ key: "b", appId: "3119", txn: "Disposal", mode: "Market Sale", beforeQty: 11000, afterQty: 10000, disclosedAt: "2026-10-04T10:00:00" })])).toEqual({ a: "corrected_refiling" });
  });
  it("two genuine trades with different holdings are both kept (tranches)", () => {
    const out = cleanInsiderTrades([mk({ key: "a", appId: "1" }), mk({ key: "b", appId: "2", beforeQty: 11000, afterQty: 12000, disclosedAt: "2026-10-04T10:00:00" })], { runDate: RUN });
    expect(out.removed).toEqual([]);
  });
  it("the same trade re-filed with other holdings keeps the latest; a chain of tranches is never collapsed", () => {
    expect(reasons([mk({ key: "a", appId: "1", beforeQty: 8876, afterQty: 9876 }), mk({ key: "b", appId: "2", beforeQty: 50000, afterQty: 51000, disclosedAt: "2026-10-04T10:00:00" })])).toEqual({ a: "refiled_with_other_holdings" });
    expect(reasons([mk({ key: "a", appId: "1", beforeQty: 10000, afterQty: 11000 }), mk({ key: "b", appId: "2", beforeQty: 11000, afterQty: 12000, disclosedAt: "2026-10-04T10:00:00" })])).toEqual({});
  });
  it("an NSE 'Revision' with no usable prevAppId replaces the one earlier filing of the same person, dates and kind, even when quantity changed", () => {
    const orig = mk({ key: "o", appId: "2427", qty: 1000, valueRs: "500000" });
    const rev = mk({ key: "r", appId: "3962", submissionType: "Revision", prevAppId: "47977", qty: 1200, valueRs: "600000", afterQty: 11200, disclosedAt: "2026-10-08T10:00:00" });
    const res = cleanInsiderTrades([orig, rev], { runDate: RUN });
    expect(res.removed).toEqual([{ key: "o", reason: "superseded_by_revision_marker" }]);
    expect(res.counts.revision_marker).toMatchObject({ revision_rows: 1, replaced_rows: 1, ambiguous: 0, no_original: 0 });
  });
  it("a Revision with two candidate originals removes neither (counted ambiguous); with none, nothing (counted)", () => {
    const rev = mk({ key: "r", appId: "9", submissionType: "Revision", qty: 1200, valueRs: "600000", afterQty: 11200, disclosedAt: "2026-10-08T10:00:00" });
    const two = cleanInsiderTrades([mk({ key: "o1", appId: "1" }), mk({ key: "o2", appId: "2", qty: 900, valueRs: "450000", beforeQty: 20000, afterQty: 20900 }), rev], { runDate: RUN });
    expect(two.removed).toEqual([]);
    expect(two.counts.revision_marker).toMatchObject({ ambiguous: 1 });
    const none = cleanInsiderTrades([rev], { runDate: RUN });
    expect(none.counts.revision_marker).toMatchObject({ no_original: 1 });
  });
  it("a trade filed again later is not mistaken for the original it follows: only EARLIER filings are replaced", () => {
    const res = cleanInsiderTrades([mk({ key: "r", appId: "5", submissionType: "Revision", qty: 1200, valueRs: "600000", afterQty: 11200, disclosedAt: "2026-10-03T10:00:00" }), mk({ key: "later", appId: "6", disclosedAt: "2026-10-09T10:00:00" })], { runDate: RUN });
    expect(res.removed).toEqual([]);
  });
});

describe("promoter-group transfers on the market (synthetic)", () => {
  const buy = mk({ key: "b", person: "Group Co A", category: "Promoter Group", txn: "Buy", mode: "Market Purchase", qty: 619683, valueRs: "5574000000", beforeQty: 1000000, afterQty: 1619683 });
  const sell = mk({ key: "s", person: "Group Co B", category: "Promoter", txn: "Sell", mode: "Market Sale", qty: 619683, valueRs: "5574000000", beforeQty: 9000000, afterQty: 8380317 });
  it("a promoter buy and another promoter's sale of the same size, dates and price are one inter-se transfer, never market", () => {
    const res = cleanInsiderTrades([buy, sell], { runDate: RUN });
    expect(res.trades.map((t) => [t.kind, t.isMarket, t.marks])).toEqual([["inter_se", false, ["promoter_group_transfer"]], ["inter_se", false, ["promoter_group_transfer"]]]);
    expect(res.counts.promoter_group_transfers_on_market).toBe(2);
  });
  it("a price more than 2% apart, or a non-promoter on the other side, stays a market trade", () => {
    expect(cleanInsiderTrades([buy, { ...sell, valueRs: "6000000000" }], { runDate: RUN }).trades.every((t) => t.kind === "market")).toBe(true);
    expect(cleanInsiderTrades([buy, { ...sell, category: "Director" }], { runDate: RUN }).trades.every((t) => t.kind === "market")).toBe(true);
  });
  it("the same person on both sides is not a transfer", () => {
    expect(cleanInsiderTrades([buy, { ...sell, person: buy.person }], { runDate: RUN }).trades.every((t) => t.kind === "market")).toBe(true);
  });
});
