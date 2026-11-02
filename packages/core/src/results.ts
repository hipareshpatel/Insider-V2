// Results XBRL (in-bse-fin, Ind AS) -> canonical P&L lines (D47 layer 2, industrial template) + identity checks (B8).
// Values in these filings are full rupees whatever "LevelOfRoundingUsedInFinancialStatements" says (verified on INFY Q3 FY25).
import { type Dec, add, cmp, dec, sub, toText } from "./decimal.js";
import { type PeriodKind, fiscalPeriod } from "./fy.js";
import type { XbrlInstance } from "./xbrl.js";

/** Taxonomy prefix: in-bse-fin (results up to 2024) or in-capmkt (SEBI Integrated Filing, 2025+); same element names. */
function prefixOf(inst: XbrlInstance): string {
  const f = inst.facts.find((x) => /:DateOfEndOfReportingPeriod$/.test(x.tag));
  return f ? f.tag.slice(0, f.tag.indexOf(":") + 1) : "in-bse-fin:";
}
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
  // NBFC (Ind AS Division III) lines
  interest_earned: "InterestEarned",
  fees_commission_income: "FeesAndCommissionIncome",
  fees_commission_expense: "FeesAndCommissionExpense",
  impairment_financial_instruments: "ImpairmentOnFinancialInstruments",
  net_loss_fair_value: "NetLossOnFairValueChanges",
  net_loss_derecognition: "NetLossOnDerecognitionOfFinancialInstrumentsUnderAmortisedCostCategory",
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

/** Bank template (Banking Regulation Act format). */
export const BANK_TAGS: Record<string, string> = {
  interest_earned: "InterestEarned",
  interest_on_advances: "InterestOrDiscountOnAdvancesOrBills",
  income_on_investments: "RevenueOnInvestments",
  interest_on_rbi_interbank: "InterestOnBalancesWithReserveBankOfIndiaAndOtherInterBankFunds",
  other_interest: "OtherInterest",
  other_income: "OtherIncome",
  total_income: "Income",
  interest_expended: "InterestExpended",
  employee_cost: "EmployeesCost",
  other_operating_expenses: "OtherOperatingExpenses",
  operating_expenses: "OperatingExpenses",
  expenditure_excl_provisions: "ExpenditureExcludingProvisionsAndContingencies",
  operating_profit: "OperatingProfitBeforeProvisionAndContingencies",
  provisions: "ProvisionsOtherThanTaxAndContingencies",
  exceptional_items: "ExceptionalItems",
  pbt: "ProfitLossFromOrdinaryActivitiesBeforeTax",
  tax: "TaxExpense",
  pat_ordinary: "ProfitLossFromOrdinaryActivitiesAfterTax",
  extraordinary_items: "ExtraordinaryItems",
  pat: "ProfitLossForThePeriod",
  pat_after_minority: "ProfitLossAfterTaxesMinorityInterestAndShareOfProfitLossOfAssociates",
  paid_up_capital: "PaidUpValueOfEquityShareCapital",
  eps_basic: "BasicEarningsPerShareAfterExtraordinaryItems",
  eps_diluted: "DilutedEarningsPerShareAfterExtraordinaryItems",
  gross_npa: "GrossNonPerformingAssets",
  net_npa: "NonPerformingAssets",
  gnpa_pct: "PercentageOfGrossNpa",
  nnpa_pct: "PercentageOfNpa",
  cet1_ratio: "CET1Ratio",
  roa: "ReturnOnAssets",
};

/** Life-insurance template (IRDAI format: policyholders' + shareholders' accounts). */
export const LIFE_TAGS: Record<string, string> = {
  premium_first_year: "IncomeFirstYearPremium",
  premium_renewal: "IncomeRenewalPremium",
  premium_single: "IncomeSinglePremium",
  gross_premium: "GrossPremiumIncome",
  net_premium: "NetPremiumIncome",
  investment_income_policyholders: "IncomeFromInvestmentsNet",
  total_income_policyholders: "Income",
  commission: "Commission",
  commission_first_year: "CommissionFirstYearPremium",
  commission_renewal: "CommissionRenewalPremium",
  commission_single: "CommissionSinglePremium",
  operating_expenses: "OperatingExpensesRelatedToInsuranceBusiness",
  expenses_of_management: "ExpensesOfManagement",
  benefits_paid: "BenefitsPaidNet",
  change_actuarial_liability: "ChangeInActuarialLiability",
  total_expenses_policyholders: "Expenses",
  surplus: "NetSurplusDeficit",
  transfer_to_shareholders: "TransferredToShareholdersAccount",
  pbt: "ProfitLossBeforeTax",
  tax: "ProvisionsForTaxes",
  pat: "ProfitLossAfterTaxAndExtraordinaryItems",
};

export interface CanonicalResult {
  symbol: string | null;
  periodStart: string;
  periodEnd: string;
  periodKind: PeriodKind;
  label: string;
  basis: "standalone" | "consolidated";
  template: "industrial" | "bank" | "life_insurance";
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
  const P = prefixOf(inst);
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
  // Template by content: banks report InterestExpended; industrial and NBFC (Ind AS Div II/III) share the other layout.
  const has = (t: string) => inst.facts.some((f) => f.tag === P + t);
  const template: CanonicalResult["template"] = has("InterestExpended") ? "bank" : has("IncomeFirstYearPremium") ? "life_insurance" : "industrial";
  const tags = template === "bank" ? BANK_TAGS : template === "life_insurance" ? LIFE_TAGS : PL_TAGS;
  for (const [line, tag] of Object.entries(tags)) {
    const f = inst.facts.find((x) => x.tag === P + tag && x.contextRef === ctx.id && !x.nil);
    if (f?.value !== undefined && f.value !== null && f.value !== "") lines[line] = toText(dec(f.value));
    else missing.push(line);
  }
  return {
    symbol: meta("Symbol"), periodStart: start, periodEnd: end, periodKind: kind,
    label: fiscalPeriod(end, kind, fyEndMonth).label,
    basis: nature.startsWith("consol") ? "consolidated" : "standalone",
    template,
    audited: meta("WhetherResultsAreAuditedOrUnaudited"),
    lines, missing, checks: template === "bank" ? bankChecks(lines) : template === "life_insurance" ? lifeChecks(lines) : identityChecks(lines),
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
  const sum = (...ks: string[]) => (ks.length && ks.every((k) => v(k)) ? ks.map((k) => v(k)!).reduce((a, b) => add(a, b)) : null);
  near("revenue + other income = total income", sum("revenue", "other_income"), v("total_income"));
  const expenseKeys = ["materials", "purchases_stock_in_trade", "inventory_change", "employee_cost", "finance_cost", "depreciation", "other_expenses",
    "fees_commission_expense", "impairment_financial_instruments", "net_loss_fair_value", "net_loss_derecognition"].filter((k) => l[k] !== undefined);
  near("expense lines = total expenses", expenseKeys.length ? sum(...expenseKeys) : null, v("total_expenses"));
  near("total income − total expenses = PBT before exceptional", v("total_income") && v("total_expenses") ? sub(v("total_income")!, v("total_expenses")!) : null, v("pbt_before_exceptional"));
  near("PBT before exceptional + exceptional = PBT", sum("pbt_before_exceptional", "exceptional_items"), v("pbt"));
  near("current + deferred tax = tax", sum("current_tax", "deferred_tax"), v("tax"));
  return out;
}

/** Bank identities (B8), tolerance ₹1 lakh. */
export function bankChecks(l: Record<string, string>): { name: string; ok: boolean; detail: string }[] {
  const tol = dec("100000");
  const v = (k: string): Dec | null => (l[k] !== undefined ? dec(l[k]!) : null);
  const out: { name: string; ok: boolean; detail: string }[] = [];
  const near = (name: string, lhs: Dec | null, rhs: Dec | null) => {
    if (!lhs || !rhs) return;
    const d = sub(lhs, rhs);
    const abs = d.units < 0n ? { units: -d.units, scale: d.scale } : d;
    out.push({ name, ok: cmp(abs, tol) <= 0, detail: `${toText(lhs)} vs ${toText(rhs)}` });
  };
  const sum = (...ks: string[]) => (ks.every((k) => v(k)) ? ks.map((k) => v(k)!).reduce((a, b) => add(a, b)) : null);
  const diff = (a: string, b: string) => (v(a) && v(b) ? sub(v(a)!, v(b)!) : null);
  near("interest components = interest earned", sum("interest_on_advances", "income_on_investments", "interest_on_rbi_interbank", "other_interest"), v("interest_earned"));
  near("interest earned + other income = total income", sum("interest_earned", "other_income"), v("total_income"));
  near("employee + other opex = operating expenses", sum("employee_cost", "other_operating_expenses"), v("operating_expenses"));
  near("interest expended + opex = expenditure", sum("interest_expended", "operating_expenses"), v("expenditure_excl_provisions"));
  near("total income − expenditure = operating profit", diff("total_income", "expenditure_excl_provisions"), v("operating_profit"));
  near("operating profit − provisions + exceptional = PBT", v("operating_profit") && v("provisions") && v("exceptional_items") ? add(sub(v("operating_profit")!, v("provisions")!), v("exceptional_items")!) : null, v("pbt"));
  near("PBT − tax = PAT (ordinary)", diff("pbt", "tax"), v("pat_ordinary"));
  return out;
}

/** Life-insurer identities (B8), tolerance ₹1 lakh. */
export function lifeChecks(l: Record<string, string>): { name: string; ok: boolean; detail: string }[] {
  const tol = dec("100000");
  const v = (k: string): Dec | null => (l[k] !== undefined ? dec(l[k]!) : null);
  const out: { name: string; ok: boolean; detail: string }[] = [];
  const near = (name: string, lhs: Dec | null, rhs: Dec | null) => {
    if (!lhs || !rhs) return;
    const d = sub(lhs, rhs);
    const abs = d.units < 0n ? { units: -d.units, scale: d.scale } : d;
    out.push({ name, ok: cmp(abs, tol) <= 0, detail: `${toText(lhs)} vs ${toText(rhs)}` });
  };
  const sum = (...ks: string[]) => (ks.every((k) => v(k)) ? ks.map((k) => v(k)!).reduce((a, b) => add(a, b)) : null);
  near("first-year + renewal + single = gross premium", sum("premium_first_year", "premium_renewal", "premium_single"), v("gross_premium"));
  near("commission parts = commission", sum("commission_first_year", "commission_renewal", "commission_single"), v("commission"));
  near("policyholders' income − expenses = surplus", v("total_income_policyholders") && v("total_expenses_policyholders") ? sub(v("total_income_policyholders")!, v("total_expenses_policyholders")!) : null, v("surplus"));
  near("PBT − tax = PAT", v("pbt") && v("tax") ? sub(v("pbt")!, v("tax")!) : null, v("pat"));
  return out;
}
