// M2 balance sheet + cash flow from results XBRL (in-bse-fin and Integrated Filing in-capmkt). Contexts (checked on
// INFY Sep 2024 / Sep 2026 and HDFCBANK Sep 2026): balance sheet = OneI (instant at the period end); cash flow =
// FourD, which is ALWAYS year-to-date (FY start → period end) even when it carries the quarter's dates (old
// in-bse-fin files; V1 hint #276); opening cash = PY_I (previous year end). A statement loads only if its own
// arithmetic checks pass. Values in rupees, exact decimals.
import { type Dec, add, cmp, dec, sub, toText } from "./decimal.js";
import type { XbrlInstance } from "./xbrl.js";

export type BsTemplate = "indas" | "oldgaap" | "bank";
export interface Statement { lines: Record<string, string>; checks: { name: string; ok: boolean; detail: string }[]; missing: string[] }
export interface BalanceAndCash {
  template: BsTemplate;
  bs: (Statement & { date: string }) | null;
  cf: (Statement & { start: string; end: string }) | null;
}

const BS_INDAS: Record<string, string> = {
  total_assets: "Assets", noncurrent_assets: "NoncurrentAssets", current_assets: "CurrentAssets",
  ppe: "PropertyPlantAndEquipment", cwip: "CapitalWorkInProgress", goodwill: "Goodwill", other_intangibles: "OtherIntangibleAssets",
  noncurrent_investments: "NoncurrentInvestments", current_investments: "CurrentInvestments", inventories: "Inventories",
  trade_receivables: "TradeReceivablesCurrent", cash: "CashAndCashEquivalents", bank_balances: "BankBalanceOtherThanCashAndCashEquivalents",
  total_equity: "Equity", equity_owners: "EquityAttributableToOwnersOfParent", share_capital: "EquityShareCapital", other_equity: "OtherEquity",
  minority_interest: "NonControllingInterest", total_liabilities: "Liabilities", noncurrent_liabilities: "NoncurrentLiabilities",
  current_liabilities: "CurrentLiabilities", borrowings_noncurrent: "BorrowingsNoncurrent", borrowings_current: "BorrowingsCurrent",
  trade_payables: "TradePayablesCurrent", equity_and_liabilities: "EquityAndLiabilities",
  // Ind AS Schedule III shows these outside current / non-current (census: 3,862 + 996 files failed without them)
  assets_held_for_sale: "NoncurrentAssetsClassifiedAsHeldForSale", regulatory_debit: "RegulatoryDeferralAccountDebitBalancesAndRelatedDeferredTaxAssets",
  liabilities_held_for_sale: "LiabilitiesDirectlyAssociatedWithAssetsInDisposalGroupClassifiedAsHeldForSale", regulatory_credit: "RegulatoryDeferralAccountCreditBalancesAndRelatedDeferredTaxLiability",
};
const BS_OLDGAAP: Record<string, string> = {
  total_assets: "Assets", noncurrent_assets: "NoncurrentAssets", current_assets: "CurrentAssets", fixed_assets: "FixedAssets",
  noncurrent_investments: "NoncurrentInvestments", current_investments: "CurrentInvestments", inventories: "Inventories",
  trade_receivables: "TradeReceivables", cash: "CashAndCashEquivalents", shareholders_funds: "ShareholdersFunds", share_capital: "ShareCapital",
  reserves: "ReservesAndSurplus", noncurrent_liabilities: "NoncurrentLiabilities", current_liabilities: "CurrentLiabilities",
  borrowings_noncurrent: "LongTermBorrowings", borrowings_current: "ShortTermBorrowings", equity_and_liabilities: "EquityAndLiabilities",
};
const BS_BANK: Record<string, string> = {
  capital: "Capital", reserves: "ReservesAndSurplus", deposits: "Deposits", borrowings: "Borrowings", other_liabilities: "OtherLiabilitiesAndProvisions",
  capital_and_liabilities: "CapitalAndLiabilities", cash_rbi: "CashAndBalancesWithReserveBankOfIndia", balances_banks: "BalancesWithBanksAndMoneyAtCallAndShortNotice",
  investments: "Investments", advances: "Advances", fixed_assets: "FixedAssets", other_assets: "OtherAssets", total_assets: "Assets",
};
const CF: Record<string, string> = {
  cfo: "CashFlowsFromUsedInOperatingActivities", cfi: "CashFlowsFromUsedInInvestingActivities", cff: "CashFlowsFromUsedInFinancingActivities",
  net_change_before_fx: "IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges", fx_effect: "EffectOfExchangeRateChangesOnCashAndCashEquivalents",
  net_change: "IncreaseDecreaseInCashAndCashEquivalents",
};

const TOL = dec("100000"); // ₹1 lakh, as for the P&L identities (filings round to lakh/crore)
function near(name: string, l: Dec | null, r: Dec | null, out: Statement["checks"]) {
  if (!l || !r) return;
  const d = sub(l, r), abs = d.units < 0n ? { units: -d.units, scale: d.scale } : d;
  out.push({ name, ok: cmp(abs, TOL) <= 0, detail: `${toText(l)} vs ${toText(r)}` });
}
const sum = (v: (k: string) => Dec | null, ...ks: string[]): Dec | null => (ks.every((k) => v(k)) ? ks.map((k) => v(k)!).reduce((a, b) => add(a, b)) : null);

/** opts.prior: read the PRIOR year-end balance sheet the filing also carries (context PY_I, the comparative column) —
 *  used to detect balance-sheet restatements against what was stored when that year-end was first reported. */
export function balanceAndCash(inst: XbrlInstance, opts: { prior?: boolean } = {}): BalanceAndCash {
  const pf = inst.facts.find((x) => /:DateOfEndOfReportingPeriod$/.test(x.tag))?.tag.split(":")[0] ?? "in-bse-fin";
  const P = pf + ":";
  const has = (t: string) => inst.facts.some((f) => f.tag === P + t);
  const meta = (t: string) => inst.facts.find((f) => f.tag === P + t)?.value ?? null;
  const end = meta("DateOfEndOfReportingPeriod");
  const fyStart = meta("DateOfStartOfFinancialYear") ?? (end ? `${Number(end.slice(5, 7)) >= 4 ? end.slice(0, 4) : Number(end.slice(0, 4)) - 1}-04-01` : null);
  const template: BsTemplate = has("Deposits") && has("Advances") ? "bank" : has("ShareholdersFunds") ? "oldgaap" : "indas";
  const read = (map: Record<string, string>, ctx: string): Statement => {
    const lines: Record<string, string> = {}, missing: string[] = [];
    for (const [k, t] of Object.entries(map)) {
      const f = inst.facts.find((x) => x.tag === P + t && x.contextRef === ctx && !x.nil);
      if (f?.value) lines[k] = toText(dec(f.value)); else missing.push(k);
    }
    return { lines, missing, checks: [] };
  };
  // Balance sheet: the instant context at the period end without dimensions (OneI).
  const prior = opts.prior ? inst.contexts.get("PY_I") ?? null : null;
  const bsCtx = opts.prior ? (prior && !Object.keys(prior.dims).length ? prior : undefined)
    : [...inst.contexts.values()].find((c) => c.instant === end && !Object.keys(c.dims).length && c.id === "OneI")
      ?? [...inst.contexts.values()].find((c) => c.instant === end && !Object.keys(c.dims).length);
  let bs: BalanceAndCash["bs"] = null;
  if (bsCtx && end) {
    const st = read(template === "bank" ? BS_BANK : template === "oldgaap" ? BS_OLDGAAP : BS_INDAS, bsCtx.id);
    const v = (k: string) => (st.lines[k] !== undefined ? dec(st.lines[k]!) : null);
    if (Object.keys(st.lines).length >= 3) {
      if (template === "bank") {
        near("assets = capital and liabilities", v("total_assets"), v("capital_and_liabilities"), st.checks);
        near("liability lines = capital and liabilities", sum(v, "capital", "reserves", "deposits", "borrowings", "other_liabilities"), v("capital_and_liabilities"), st.checks);
        near("asset lines = assets", sum(v, "cash_rbi", "balances_banks", "investments", "advances", "fixed_assets", "other_assets"), v("total_assets"), st.checks);
      } else {
        near("assets = equity and liabilities", v("total_assets"), v("equity_and_liabilities"), st.checks);
        // optional components count as 0 when the filing omits them
        const z = (k: string) => v(k) ?? dec("0");
        const opt = (base: Dec | null, ...ks: string[]) => (base ? ks.reduce((a, k) => add(a, z(k)), base) : null);
        near("current + non-current assets = assets", opt(sum(v, "current_assets", "noncurrent_assets"), "assets_held_for_sale", "regulatory_debit"), v("total_assets"), st.checks);
        if (template === "indas") {
          near("equity + liabilities = total", sum(v, "total_equity", "total_liabilities"), v("equity_and_liabilities"), st.checks);
          near("current + non-current liabilities = liabilities", opt(sum(v, "current_liabilities", "noncurrent_liabilities"), "liabilities_held_for_sale", "regulatory_credit"), v("total_liabilities"), st.checks);
        }
      }
      bs = { ...st, date: opts.prior ? (bsCtx.instant ?? end) : end };
    }
  }
  // Cash flow: FourD is year-to-date by NSE convention, whatever dates it carries; else the FY-start → end context.
  const cfCtx = inst.contexts.get("FourD") ?? [...inst.contexts.values()].find((c) => c.start === fyStart && c.end === end && !Object.keys(c.dims).length);
  let cf: BalanceAndCash["cf"] = null;
  if (cfCtx && end && fyStart) {
    const st = read(CF, cfCtx.id);
    const cashAt = (id: string) => inst.facts.find((x) => x.tag === P + "CashAndCashEquivalentsCashFlowStatement" && x.contextRef === id && !x.nil)?.value;
    const open = cashAt("PY_I"), close = cashAt(bsCtx?.id ?? "OneI");
    if (open) st.lines.cash_begin = toText(dec(open));
    if (close) st.lines.cash_end = toText(dec(close));
    const v = (k: string) => (st.lines[k] !== undefined ? dec(st.lines[k]!) : null);
    if (st.lines.cfo !== undefined) {
      near("operating + investing + financing = change before FX", sum(v, "cfo", "cfi", "cff"), v("net_change_before_fx"), st.checks);
      near("change before FX + FX effect = change", sum(v, "net_change_before_fx", "fx_effect"), v("net_change"), st.checks);
      near("opening cash + change = closing cash", sum(v, "cash_begin", "net_change"), v("cash_end"), st.checks);
      cf = { ...st, start: fyStart, end };
    }
  }
  return { template, bs, cf };
}
