// D157 (work list item 5): statements shown in the legal format — Schedule III Division II for Ind AS companies — as
// heads with sub-rows. A layout is a tree of stored line keys (P&L: canonical keys; balance sheet and cash flow: the
// filed XBRL tags, stored as `x:<Tag>`), in Schedule III order. Built from the public format and the filers' own
// taxonomy names; the owner's ProwessIQ dictionary (docs/) is used only to cross-check grouping, not copied.
// Values are only ever the filed figures. A head that is not filed shows its filed sub-rows and no total (never a sum
// — D170). Summary rows that no filing carries (operating profit, OPM %) are computed when shown, labelled `derived`,
// and never stored (owner #350, as for TTM).
import { CF_ADJUSTMENTS, CF_FINANCING, CF_INVESTING, CF_OPERATING, BS_GROUPS, BS_GROUPS_DIV3, BS_GROUPS_GI, BS_GROUPS_INS } from "./detail.js";
import { type Dec, add, dec, div, mul, sub, toText } from "./decimal.js";

/** `sign: -1` marks a line the filing deducts from its head (an outflow such as purchase of fixed assets, or interest
 *  income taken out of operating profit). The value stays exactly as filed (positive); the sign tells the page to show
 *  it in brackets, as the printed statement does. */
export interface LayoutNode { key: string; label: string; sign?: -1; children?: LayoutNode[] }
export interface LayoutRow { key: string; label: string; level: number; value: string | null; kind: "filed" | "head" | "derived"; sign?: -1 }

/** "TradeReceivablesCurrent" → "Trade receivables current" (label for a filed tag that has no curated label). */
export function tagLabel(tag: string): string {
  const s = tag.replace(/^x:/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z])([A-Z][a-z])/g, "$1 $2").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const n = (key: string, label?: string, children?: LayoutNode[]): LayoutNode => ({ key, label: label ?? tagLabel(key), ...(children ? { children } : {}) });
const x = (tag: string, label?: string, children?: LayoutNode[]) => n(`x:${tag}`, label ?? tagLabel(tag), children);

/** Profit and loss, Schedule III Div II (industrial template; canonical keys of PL_TAGS). */
export const PL_INDUSTRIAL: LayoutNode[] = [
  n("revenue", "Revenue from operations"),
  n("other_income", "Other income"),
  n("total_income", "Total income"),
  n("total_expenses", "Total expenses", [
    n("materials", "Cost of materials consumed"), n("purchases_stock_in_trade", "Purchases of stock-in-trade"),
    n("inventory_change", "Changes in inventories"), n("employee_cost", "Employee benefit expense"),
    n("finance_cost", "Finance costs"), n("depreciation", "Depreciation and amortisation"), n("other_expenses", "Other expenses"),
  ]),
  n("pbt_before_exceptional", "Profit before exceptional items and tax"),
  n("exceptional_items", "Exceptional items"),
  n("pbt", "Profit before tax"),
  n("tax", "Tax expense", [n("current_tax", "Current tax"), n("deferred_tax", "Deferred tax")]),
  n("pat_continuing", "Profit from continuing operations"),
  n("pat_discontinued", "Profit from discontinued operations"),
  n("share_of_associates", "Share of profit of associates and joint ventures"),
  n("pat", "Net profit", [n("pat_owners", "Attributable to owners"), n("pat_nci", "Attributable to non-controlling interests")]),
  n("oci", "Other comprehensive income"),
  n("total_comprehensive_income", "Total comprehensive income"),
  n("eps_basic", "EPS basic (₹)"), n("eps_diluted", "EPS diluted (₹)"),
];

const bsNode = (tag: string): LayoutNode => x(tag, undefined, BS_GROUPS[tag]?.map(bsNode));
/** Balance sheet, Schedule III Div II (filed tags; groups from BS_GROUPS, the same groups the loader checks). */
export const BS_INDUSTRIAL: LayoutNode[] = [
  x("Assets", "Total assets", [
    bsNode("NoncurrentAssets"), bsNode("CurrentAssets"),
    x("NoncurrentAssetsClassifiedAsHeldForSale"), x("RegulatoryDeferralAccountDebitBalancesAndRelatedDeferredTaxAssets"),
  ]),
  x("EquityAndLiabilities", "Total equity and liabilities", [
    x("Equity", "Total equity", [bsNode("EquityAttributableToOwnersOfParent"), x("NonControllingInterest")]),
    x("Liabilities", "Total liabilities", [bsNode("NoncurrentLiabilities"), bsNode("CurrentLiabilities"),
      x("LiabilitiesDirectlyAssociatedWithAssetsInDisposalGroupClassifiedAsHeldForSale"), x("RegulatoryDeferralAccountCreditBalancesAndRelatedDeferredTaxLiability")]),
  ]),
];

const lines = (s: Record<string, 1 | -1>) => Object.entries(s).map(([t, sg]) => (sg === -1 ? { ...x(t), sign: -1 as const } : x(t)));
/** Cash flow, indirect method (filed tags; sections as the loader checks them). */
export const CF_INDUSTRIAL: LayoutNode[] = [
  x("CashFlowsFromUsedInOperatingActivities", "Cash from operating activities", [
    x("AdjustmentsForReconcileProfitLoss", "Adjustments to profit", lines(CF_ADJUSTMENTS)),
    ...lines(CF_OPERATING),
  ]),
  x("CashFlowsFromUsedInInvestingActivities", "Cash from investing activities", lines(CF_INVESTING)),
  x("CashFlowsFromUsedInFinancingActivities", "Cash from financing activities", lines(CF_FINANCING)),
  x("IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges", "Net change before exchange-rate effect"),
  x("EffectOfExchangeRateChangesOnCashAndCashEquivalents", "Exchange-rate effect"),
  x("IncreaseDecreaseInCashAndCashEquivalents", "Net change in cash and cash equivalents"),
];

/** Bank P&L (results format under the Banking Regulation Act; canonical keys of BANK_TAGS). */
export const PL_BANK: LayoutNode[] = [
  n("interest_earned", "Interest earned", [
    n("interest_on_advances", "Interest / discount on advances / bills"), n("income_on_investments", "Income on investments"),
    n("interest_on_rbi_interbank", "Interest on balances with RBI and other inter-bank funds"), n("other_interest", "Others"),
  ]),
  n("other_income", "Other income"),
  n("total_income", "Total income"),
  n("interest_expended", "Interest expended"),
  n("operating_expenses", "Operating expenses", [n("employee_cost", "Employees cost"), n("other_operating_expenses", "Other operating expenses")]),
  n("expenditure_excl_provisions", "Total expenditure (excluding provisions and contingencies)"),
  n("operating_profit", "Operating profit before provisions and contingencies"),
  n("provisions", "Provisions (other than tax) and contingencies"),
  n("exceptional_items", "Exceptional items"),
  n("pbt", "Profit from ordinary activities before tax"),
  n("tax", "Tax expense"),
  n("pat_ordinary", "Net profit from ordinary activities after tax"),
  n("extraordinary_items", "Extraordinary items (net of tax)"),
  n("pat", "Net profit for the period"),
  n("pat_after_minority", "Net profit after minority interest and share of associates"),
  n("eps_basic", "EPS basic (₹)"), n("eps_diluted", "EPS diluted (₹)"),
  n("gross_npa", "Gross NPA"), n("net_npa", "Net NPA"), n("gnpa_pct", "Gross NPA %"), n("nnpa_pct", "Net NPA %"),
  n("cet1_ratio", "CET1 ratio"), n("roa", "Return on assets"),
];
/** Bank balance sheet (Third Schedule, Form A; the named lines the loader checks). */
export const BS_BANK: LayoutNode[] = [
  n("capital_and_liabilities", "Capital and liabilities", [
    n("capital", "Capital"), n("reserves", "Reserves and surplus"), n("deposits", "Deposits"), n("borrowings", "Borrowings"),
    n("other_liabilities", "Other liabilities and provisions"),
  ]),
  n("total_assets", "Assets", [
    n("cash_rbi", "Cash and balances with RBI"), n("balances_banks", "Balances with banks and money at call and short notice"),
    n("investments", "Investments"), n("advances", "Advances"), n("fixed_assets", "Fixed assets"), n("other_assets", "Other assets"),
  ]),
];
/** NBFC P&L (Schedule III Division III; the NBFC lines of PL_TAGS, then the shared lower half). Every revenue part is
 *  read (item 5 leftover 3), kept only when the parts add up to the filed revenue. */
export const PL_NBFC: LayoutNode[] = [
  n("revenue", "Revenue from operations", [n("interest_earned", "Interest income"), n("dividend_income", "Dividend income"), n("rental_income", "Rental income"),
    n("fees_commission_income", "Fees and commission income"), n("net_gain_fair_value", "Net gain on fair value changes"),
    n("net_gain_derecognition", "Net gain on derecognition of financial instruments at amortised cost"),
    n("sale_of_products", "Sale of products"), n("sale_of_services", "Sale of services"), n("other_operating_revenue", "Other revenue from operations")]),
  n("other_income", "Other income"),
  n("total_income", "Total income"),
  n("total_expenses", "Total expenses", [
    n("finance_cost", "Finance costs"), n("fees_commission_expense", "Fees and commission expense"),
    n("net_loss_fair_value", "Net loss on fair value changes"), n("net_loss_derecognition", "Net loss on derecognition of financial instruments at amortised cost"),
    n("impairment_financial_instruments", "Impairment on financial instruments"),
    n("materials", "Cost of materials consumed"), n("purchases_stock_in_trade", "Purchases of stock-in-trade"), n("inventory_change", "Changes in inventories"),
    n("employee_cost", "Employee benefit expense"), n("depreciation", "Depreciation and amortisation"), n("other_expenses", "Other expenses"),
  ]),
  ...PL_INDUSTRIAL.slice(4),
];
const div3 = (tag: string, label?: string): LayoutNode => x(tag, label, BS_GROUPS_DIV3[tag]?.map((t) => div3(t)));
/** NBFC balance sheet, Schedule III Division III (filed tags; groups from BS_GROUPS_DIV3, the same groups the loader
 *  checks). Both spellings of the financial-assets total are placed; a file carries one. */
export const BS_NBFC: LayoutNode[] = [
  x("Assets", "Total assets", [
    div3("FinanicalAssets", "Financial assets"), x("FinancialAssets", "Financial assets"),
    div3("NonFinancialAssets", "Non-financial assets"), x("NoncurrentAssetsClassifiedAsHeldForSale"),
  ]),
  x("EquityAndLiabilities", "Total liabilities and equity", [
    x("Liabilities", "Total liabilities", [div3("FinancialLiabilities", "Financial liabilities"), div3("NonFinancialLiabilities", "Non-financial liabilities"),
      x("LiabilitiesDirectlyAssociatedWithAssetsInDisposalGroupClassifiedAsHeldForSale")]),
    x("Equity", "Total equity", [div3("EquityAttributableToOwnersOfParent"), x("NonControllingInterest")]),
  ]),
];
const tree = (groups: Record<string, string[]>, labels: Record<string, string> = {}) => {
  const node = (tag: string): LayoutNode => {
    const t = tag.replace(/^-/, ""), l = labels[t] ?? tagLabel(t);
    return x(t, tag.startsWith("-") ? `Less: ${l}` : l, groups[t]?.map(node));
  };
  return node;
};
/** Life insurer balance sheet, IRDAI Form L-3 (sources and application of funds; groups from BS_GROUPS_INS, the same
 *  groups the loader checks). */
export const BS_INSURANCE: LayoutNode[] = (() => {
  const t = tree(BS_GROUPS_INS, { SourcesOfFunds: "Sources of funds", ApplicationOfFunds: "Application of funds", ShareholdersFunds: "Shareholders' funds",
    PolicyholdersFunds: "Policyholders' funds" });
  return [t("SourcesOfFunds"), t("ApplicationOfFunds")];
})();
/** General insurer balance sheet, IRDAI Form B-BS (groups from BS_GROUPS_GI). Here the filed "ShareholdersFunds" and
 *  "PolicyholdersFunds" tags carry the fair value change accounts only, and are labelled so. */
export const BS_GENERAL_INSURANCE: LayoutNode[] = (() => {
  const t = tree(BS_GROUPS_GI, { SourcesOfFunds: "Sources of funds", ApplicationOfFunds: "Application of funds",
    ShareholdersFunds: "Fair value change account – shareholders' funds", PolicyholdersFunds: "Fair value change account – policyholders' funds" });
  return [t("SourcesOfFunds"), t("ApplicationOfFunds")];
})();
/** Life insurer (IRDAI: policyholders' account, then shareholders'; canonical keys of LIFE_TAGS). */
export const PL_LIFE: LayoutNode[] = [
  n("gross_premium", "Gross premium income", [n("premium_first_year", "First-year premium"), n("premium_renewal", "Renewal premium"), n("premium_single", "Single premium")]),
  n("net_premium", "Net premium income"),
  n("investment_income_policyholders", "Income from investments (net)"),
  n("total_income_policyholders", "Total income (policyholders' account)"),
  n("commission", "Commission", [n("commission_first_year", "First-year premium"), n("commission_renewal", "Renewal premium"), n("commission_single", "Single premium")]),
  n("operating_expenses", "Operating expenses related to insurance business"),
  n("expenses_of_management", "Expenses of management"),
  n("benefits_paid", "Benefits paid (net)"),
  n("change_actuarial_liability", "Change in actuarial liability"),
  n("total_expenses_policyholders", "Total expenses (policyholders' account)"),
  n("surplus", "Net surplus / (deficit)"),
  n("transfer_to_shareholders", "Transferred to shareholders' account"),
  n("pbt", "Profit before tax"), n("tax", "Provision for tax"), n("pat", "Profit after tax"),
];
/** General insurer (IRDAI revenue account + profit and loss account; canonical keys of GI_TAGS). */
export const PL_GENERAL: LayoutNode[] = [
  n("gross_premium", "Gross premiums written"), n("net_premium", "Net premium written"), n("premium_earned", "Premium earned (net)"),
  n("investment_income_policyholders", "Income from investments (net)"), n("other_income", "Other income"),
  n("operating_income", "Total operating income"),
  n("claims_incurred", "Claims incurred (net)", [n("claims_paid", "Claims paid"), n("change_outstanding_claims", "Change in outstanding claims")]),
  n("commission", "Commission (net)"),
  n("operating_expenses", "Operating expenses related to insurance business", [n("employee_cost", "Employees' remuneration and welfare"), n("other_operating_expenses", "Other operating expenses")]),
  n("premium_deficiency", "Premium deficiency"),
  n("total_operating_expenses", "Total operating expenses"),
  n("underwriting_result", "Underwriting profit / (loss)"),
  n("operating_profit", "Operating profit / (loss)"),
  n("transfer_to_shareholders", "Transfer from policyholders' fund (shareholders' account)"),
  n("investment_income_shareholders", "Income from investments (shareholders' account)"),
  n("other_income_shareholders", "Other income (shareholders' account)"),
  n("total_income_shareholders", "Total income (shareholders' account)"),
  n("provision_doubtful_debts", "Provision for doubtful debts"), n("provision_diminution", "Provision for diminution in value of investments"),
  n("non_operating_expenses", "Other expenses (non-operating)"),
  n("pbt_before_extraordinary", "Profit before extraordinary items"), n("extraordinary_items", "Extraordinary items"),
  n("pbt", "Profit before tax"), n("tax", "Provision for tax"), n("pat", "Profit after tax"), n("eps_basic", "EPS basic and diluted (₹)"),
];

/** The layout for one company-period, chosen by what was stored (fin_value.template, then the lines themselves):
 *  NBFCs share the industrial template value but carry Division III lines. */
export type LayoutName = "industrial" | "nbfc" | "bank" | "life_insurance" | "general_insurance";
export function chooseLayout(template: string | null, pl: Record<string, unknown>): { name: LayoutName; label: string; pl: LayoutNode[]; bs: LayoutNode[]; cfDetail: boolean } {
  if (template === "bank") return { name: "bank", label: "bank (Third Schedule, Banking Regulation Act)", pl: PL_BANK, bs: BS_BANK, cfDetail: false };
  if (template === "insurance") return "premium_earned" in pl || "claims_incurred" in pl
    ? { name: "general_insurance", label: "general insurer (IRDAI)", pl: PL_GENERAL, bs: BS_GENERAL_INSURANCE, cfDetail: false }
    : { name: "life_insurance", label: "life insurer (IRDAI)", pl: PL_LIFE, bs: BS_INSURANCE, cfDetail: false };
  if (["interest_earned", "impairment_financial_instruments", "fees_commission_income", "fees_commission_expense", "net_loss_fair_value"].some((k) => k in pl))
    return { name: "nbfc", label: "NBFC (Schedule III Div III)", pl: PL_NBFC, bs: BS_NBFC, cfDetail: true };
  return { name: "industrial", label: "industrial (Schedule III Div II)", pl: PL_INDUSTRIAL, bs: BS_INDUSTRIAL, cfDetail: true };
}

/** Cash-flow totals (named lines; every template stores these, the line-by-line detail only where it is loaded). */
export const CF_SUMMARY: LayoutNode[] = [
  n("cash_begin", "Cash and cash equivalents at the beginning"),
  n("cfo", "Cash from operating activities"), n("cfi", "Cash from investing activities"), n("cff", "Cash from financing activities"),
  n("net_change_before_fx", "Net change before exchange-rate effect"), n("fx_effect", "Exchange-rate effect"),
  n("net_change", "Net change in cash and cash equivalents"), n("cash_end", "Cash and cash equivalents at the end"),
];

/** Lays stored figures out in a tree: depth first, filed values only; a head whose own total is not filed keeps its
 *  filed sub-rows and shows no value (kind 'head'); branches with nothing filed are left out. With `hideZeros`, a row
 *  filed as 0 with nothing non-zero under it is left out too (the XBRL forms carry every line, mostly as 0). */
export function layoutStatement(tree: LayoutNode[], values: Record<string, string | null | undefined>, opts: { hideZeros?: boolean } = {}): LayoutRow[] {
  const out: LayoutRow[] = [];
  const zero = (v: string | null) => v !== null && /^-?0*(\.0*)?$/.test(v);
  const walk = (nodes: LayoutNode[], level: number): boolean => {
    let any = false;
    for (const nd of nodes) {
      const at = out.length, v = values[nd.key] ?? null;
      out.push({ key: nd.key, label: nd.label, level, value: v, kind: v !== null ? "filed" : "head", ...(nd.sign ? { sign: nd.sign } : {}) });
      const kids = nd.children ? walk(nd.children, level + 1) : false;
      const empty = v === null || (opts.hideZeros === true && zero(v));
      if (empty && !kids) out.splice(at); else any = true;
    }
    return any;
  };
  walk(tree, 0);
  return out;
}

/** D157 summary rows no filing carries, computed when shown and never stored: operating profit (revenue − expenses
 *  other than finance costs and depreciation) and its margin. Only when every input is filed; otherwise left out. */
export function derivedPl(values: Record<string, string | null | undefined>, layout: LayoutName = "industrial"): LayoutRow[] {
  // Only for the industrial format: for a lender, finance cost is the cost of the product, and adding it back
  // (BAJFINANCE Sep 2026: "71 %") misleads. Banks and insurers file their own operating-profit lines.
  if (layout !== "industrial") return [];
  const v = (k: string): Dec | null => (values[k] != null && values[k] !== "" ? dec(values[k]!) : null);
  const rev = v("revenue"), exp = v("total_expenses"), fin = v("finance_cost"), dep = v("depreciation");
  if (!rev || !exp || !fin || !dep || rev.units === 0n) return [];
  // operating profit = revenue − (total expenses − finance costs − depreciation)
  const opAll = add(add(sub(rev, exp), fin), dep);
  const opm = div(mul(opAll, dec("100")), rev, 2);
  return [
    { key: "derived:operating_profit", label: "Operating profit (derived)", level: 0, value: toText(opAll), kind: "derived" },
    { key: "derived:opm_pct", label: "Operating profit margin % (derived)", level: 0, value: toText(opm), kind: "derived" },
  ];
}
