// Results XBRL (in-bse-fin, Ind AS) -> canonical P&L lines (D47 layer 2, industrial template) + identity checks (B8).
// Values in these filings are full rupees whatever "LevelOfRoundingUsedInFinancialStatements" says (verified on INFY Q3 FY25).
import { type Dec, add, cmp, dec, sub, toText } from "./decimal.js";
import { type PeriodKind, fiscalPeriod } from "./fy.js";
import type { XbrlInstance } from "./xbrl.js";

const P = "in-bse-fin:";
/** canonical line -> in-bse-fin tag (industrial template). */
export const PL_TAGS: Record<string, string> = {
  revenue: "RevenueFromOperations",
  other_income: "OtherIncome",
  total_income: "Income",
  materials: "CostOfMaterialsConsumed",
  purchases_stock_in_trade: "PurchasesOfStockInTrade",
  inventory_change: "ChangesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade",
  employee_cost: "EmployeeBenefitExpense",
  finance_cost: "FinanceCosts",
  depreciation: "DepreciationDepletionAndAmortisationExpense",
  other_expenses: "OtherExpenses",
  total_expenses: "Expenses",
  pbt_before_exceptional: "ProfitBeforeExceptionalItemsAndTax",
  exceptional_items: "ExceptionalItemsBeforeTax",
  pbt: "ProfitBeforeTax",
  current_tax: "CurrentTax",
  deferred_tax: "DeferredTax",
  tax: "TaxExpense",
  pat_continuing: "ProfitLossForPeriodFromContinuingOperations",
  pat_discontinued: "ProfitLossFromDiscontinuedOperationsAfterTax",
  share_of_associates: "ShareOfProfitLossOfAssociatesAndJointVenturesAccountedForUsingEquityMethod",
  pat: "ProfitLossForPeriod",
  pat_owners: "ProfitOrLossAttributableToOwnersOfParent",
  pat_nci: "ProfitOrLossAttributableToNonControllingInterests",
  oci: "OtherComprehensiveIncomeNetOfTaxes",
  total_comprehensive_income: "ComprehensiveIncomeForThePeriod",
  paid_up_capital: "PaidUpValueOfEquityShareCapital",
  eps_basic: "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
  eps_diluted: "DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
};

export interface CanonicalResult {
  symbol: string | null;
  periodStart: string;
  periodEnd: string;
  periodKind: PeriodKind;
  label: string;
  basis: "standalone" | "consolidated";
  audited: string | null;
  lines: Record<string, string>;      // exact rupee text (EPS in rupees per share)
  missing: string[];                  // canonical lines not reported (null with reason, D52)
  checks: { name: string; ok: boolean; detail: string }[];
}

function months(a: string, b: string): number {
  const [y1, m1] = a.split("-").map(Number), [y2, m2] = b.split("-").map(Number);
  return (y2! - y1!) * 12 + (m2! - m1!) + 1;
}

export function canonicalResult(inst: XbrlInstance): CanonicalResult {
  const meta = (tag: string) => inst.facts.find((f) => f.tag === P + tag)?.value ?? null;
  const start = meta("DateOfStartOfReportingPeriod"), end = meta("DateOfEndOfReportingPeriod");
  if (!start || !end) throw new Error("results: reporting period not found");
  // Current-period context: entity level (no dimensions) spanning exactly the reporting period.
  const ctx = [...inst.contexts.values()].find((c) => c.start === start && c.end === end && Object.keys(c.dims).length === 0);
  if (!ctx) throw new Error(`results: no context for ${start}..${end}`);
  const n = months(start, end);
  const kind: PeriodKind = n === 3 ? "Q" : n === 6 ? "H" : n === 9 ? "9M" : n === 12 ? "FY" : (() => { throw new Error(`results: ${n}-month period`); })();
  const fyEnd = meta("DateOfEndOfFinancialYear");
  const fyEndMonth = fyEnd ? Number(fyEnd.slice(5, 7)) : 3;
  const nature = (meta("NatureOfReportStandaloneConsolidated") ?? "").toLowerCase();
  const lines: Record<string, string> = {};
  const missing: string[] = [];
  for (const [line, tag] of Object.entries(PL_TAGS)) {
    const f = inst.facts.find((x) => x.tag === P + tag && x.contextRef === ctx.id && !x.nil);
    if (f?.value !== undefined && f.value !== null && f.value !== "") lines[line] = toText(dec(f.value));
    else missing.push(line);
  }
  return {
    symbol: meta("Symbol"), periodStart: start, periodEnd: end, periodKind: kind,
    label: fiscalPeriod(end, kind, fyEndMonth).label,
    basis: nature.startsWith("consol") ? "consolidated" : "standalone",
    audited: meta("WhetherResultsAreAuditedOrUnaudited"),
    lines, missing, checks: identityChecks(lines),
  };
}

/** B8 accounting identities, tolerance ₹1 lakh (rounding in filings). */
export function identityChecks(l: Record<string, string>): { name: string; ok: boolean; detail: string }[] {
  const tol = dec("100000");
  const v = (k: string): Dec | null => (l[k] !== undefined ? dec(l[k]!) : null);
  const out: { name: string; ok: boolean; detail: string }[] = [];
  const near = (name: string, lhs: Dec | null, rhs: Dec | null) => {
    if (!lhs || !rhs) return;
    const d = sub(lhs, rhs);
    const abs = d.units < 0n ? { units: -d.units, scale: d.scale } : d;
    out.push({ name, ok: cmp(abs, tol) <= 0, detail: `${toText(lhs)} vs ${toText(rhs)}` });
  };
  const sum = (...ks: string[]) => ks.every((k) => v(k)) ? ks.map((k) => v(k)!).reduce((a, b) => add(a, b)) : null;
  near("revenue + other income = total income", sum("revenue", "other_income"), v("total_income"));
  near("expense lines = total expenses", sum("materials", "purchases_stock_in_trade", "inventory_change", "employee_cost", "finance_cost", "depreciation", "other_expenses"), v("total_expenses"));
  near("total income − total expenses = PBT before exceptional", v("total_income") && v("total_expenses") ? sub(v("total_income")!, v("total_expenses")!) : null, v("pbt_before_exceptional"));
  near("PBT before exceptional + exceptional = PBT", sum("pbt_before_exceptional", "exceptional_items"), v("pbt"));
  near("current + deferred tax = tax", sum("current_tax", "deferred_tax"), v("tax"));
  return out;
}
