// D157 (work list item 5): statements shown in the legal format — Schedule III Division II for Ind AS companies — as
// heads with sub-rows. A layout is a tree of stored line keys (P&L: canonical keys; balance sheet and cash flow: the
// filed XBRL tags, stored as `x:<Tag>`), in Schedule III order. Built from the public format and the filers' own
// taxonomy names; the owner's ProwessIQ dictionary (docs/) is used only to cross-check grouping, not copied.
// Values are only ever the filed figures. A head that is not filed shows its filed sub-rows and no total (never a sum
// — D170). Summary rows that no filing carries (operating profit, OPM %) are computed when shown, labelled `derived`,
// and never stored (owner #350, as for TTM).
import { CF_ADJUSTMENTS, CF_FINANCING, CF_INVESTING, CF_OPERATING, BS_GROUPS } from "./detail.js";
import { type Dec, add, dec, div, mul, sub, toText } from "./decimal.js";

export interface LayoutNode { key: string; label: string; children?: LayoutNode[] }
export interface LayoutRow { key: string; label: string; level: number; value: string | null; kind: "filed" | "head" | "derived" }

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

const lines = (s: Record<string, 1 | -1>) => Object.keys(s).map((t) => x(t));
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

/** Lays stored figures out in a tree: depth first, filed values only; a head whose own total is not filed keeps its
 *  filed sub-rows and shows no value (kind 'head'); branches with nothing filed are left out. */
export function layoutStatement(tree: LayoutNode[], values: Record<string, string | null | undefined>): LayoutRow[] {
  const out: LayoutRow[] = [];
  const walk = (nodes: LayoutNode[], level: number): boolean => {
    let any = false;
    for (const nd of nodes) {
      const at = out.length, v = values[nd.key] ?? null;
      out.push({ key: nd.key, label: nd.label, level, value: v, kind: v !== null ? "filed" : "head" });
      const kids = nd.children ? walk(nd.children, level + 1) : false;
      if (v === null && !kids) out.splice(at); else any = true;
    }
    return any;
  };
  walk(tree, 0);
  return out;
}

/** D157 summary rows no filing carries, computed when shown and never stored: operating profit (revenue − expenses
 *  other than finance costs and depreciation) and its margin. Only when every input is filed; otherwise left out. */
export function derivedPl(values: Record<string, string | null | undefined>): LayoutRow[] {
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
