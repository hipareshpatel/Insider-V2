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
  // D154 (census of 74,571 files): the rest of the reported P&L, so the statement is complete
  pbt_discontinued: "ProfitLossFromDiscontinuedOperationsBeforeTax",
  tax_discontinued: "TaxExpenseOfDiscontinuedOperations",
  regulatory_deferral_movement: "NetMovementInRegulatoryDeferralAccountBalancesRelatedToProfitOrLossAndTheRelatedDeferredTaxMovement",
  oci_items_not_reclassified: "AmountOfItemThatWillNotBeReclassifiedToProfitAndLoss",
  oci_tax_not_reclassified: "IncomeTaxRelatingToItemsThatWillNotBeReclassifiedToProfitOrLoss",
  oci_items_reclassified: "AmountOfItemThatWillBeReclassifiedToProfitAndLoss",
  oci_tax_reclassified: "IncomeTaxRelatingToItemsThatWillBeReclassifiedToProfitOrLoss",
  oci_reported: "OtherComprehensiveIncome",
  tci_owners: "ComprehensiveIncomeForThePeriodAttributableToOwnersOfParent",
  tci_nci: "ComprehensiveIncomeForThePeriodAttributableToOwnersOfParentNonControllingInterests",
  eps_basic_continuing: "BasicEarningsLossPerShareFromContinuingOperations",
  eps_diluted_continuing: "DilutedEarningsLossPerShareFromContinuingOperations",
  eps_basic_discontinued: "BasicEarningsLossPerShareFromDiscontinuedOperations",
  eps_diluted_discontinued: "DilutedEarningsLossPerShareFromDiscontinuedOperations",
  debt_equity_ratio: "DebtEquityRatio",
  debt_service_coverage_ratio: "DebtServiceCoverageRatio",
  interest_service_coverage_ratio: "InterestServiceCoverageRatio",
};
/** Spelling variants of the same tag in older taxonomies (not different concepts): always tried after the main tag. */
export const PL_SPELLINGS: Record<string, string[]> = {
  IncomeTaxRelatingToItemsThatWillNotBeReclassifiedToProfitOrLoss: ["IncomeTaxRelatingToItmesThatWillNotBeReclassifiedToProfitOrLoss"],
  IncomeTaxRelatingToItemsThatWillBeReclassifiedToProfitOrLoss: ["IncomeTaxRelatingToItmesThatWillBeReclassifiedToProfitOrLoss"],
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

/** General-insurance template (IRDAI format, Integrated Filing "IFGI": revenue account + profit and loss account).
 *  Checked on ICICIGI Sep 2026; the filing's own sums are the B8 checks (giChecks). */
export const GI_TAGS: Record<string, string> = {
  gross_premium: "GrossPremiumsWritten",
  net_premium: "NetPremiumWritten",
  premium_earned: "PremiumEarned",
  investment_income_policyholders: "IncomeFromInvestmentsNet",
  other_income: "OtherIncome",
  operating_income: "OperatingIncome",
  commission: "NetCommission",
  employee_cost: "EmployeesRemunerationAndWelfareExpenses",
  other_operating_expenses: "OtherOperatingExpenses",
  operating_expenses: "OperatingExpensesRelatedToInsuranceBusiness",
  premium_deficiency: "PremiumDeficiency",
  claims_paid: "ClaimsPaid",
  change_outstanding_claims: "ChangeInOutstandingClaims",
  claims_incurred: "IncurredClaims",
  total_operating_expenses: "OperatingExpenses",
  underwriting_result: "UnderwritingProfitOrLoss",
  provision_doubtful_debts: "ProvisionsForDoubtfulDebtsIncludingBadDebtsWrittenOff",
  provision_diminution: "ProvisionsForDiminutionInValueOfInvestments",
  operating_profit: "OperatingProfitOrLoss",
  transfer_to_shareholders: "ShareholdersAccountTransferFromPolicyholdersFund",
  investment_income_shareholders: "ShareholdersAccountIncomeFromInvestments",
  other_income_shareholders: "ShareholdersAccountOtherIncome",
  total_income_shareholders: "IncomeInShareholdersAccount",
  non_operating_expenses: "NonOperatingExpense",
  pbt_before_extraordinary: "ProfitOrLossBeforeExtraordinaryItems",
  extraordinary_items: "ExtraordinaryItems",
  pbt: "ProfitOrLossBeforeTax",
  tax: "ProvisionForTax",
  pat: "ProfitLossAfterTax",
  eps_basic: "BasicAndDilutedEPSAfterExtraordinaryItemsNetOfTaxExpenseForThePeriodNotToBeAnnualized",
};

/** Old Indian GAAP (non-Ind AS) results file: its schema is not an Ind AS entry point and it isn't an Integrated Filing.
 *  Seen: "other_than_banks_entry_point_2019-09-30.xsd" (old GAAP) vs "Ind-AS_entry_point_2020-03-31.xsd". */
export function isOldGaap(inst: XbrlInstance): boolean {
  if (prefixOf(inst) !== "in-bse-fin:") return false;
  // Only the entry points seen on old-GAAP filings (census of 56,382 files, 2026-11-03): "other_than_banks" (29 SME
  // files) and "banking" (banks still report under Indian GAAP; they use the bank template, aliases never apply).
  return /other_than_banks|banking_entry_point/i.test(inst.schemaRef ?? "");
}

/** Alternative tags (old Indian GAAP "NONINDAS" filings, SME companies), tried in order after the main tag. */
export const PL_ALIASES: Record<string, string[]> = {
  total_income: ["Revenue"],
  depreciation: ["DepreciationAndAmortisationExpense"],
  pbt_before_exceptional: ["ProfitBeforeExceptionalAndExtraordinaryItemsAndTax"],
  exceptional_items: ["ExceptionalItems"],
  pat_continuing: ["ProfitLossForThePeriodFromContinuingOperations"],
  pat_discontinued: ["ProfitLossFromDiscontinuingOperationAfterTax"],
  pat: ["ProfitLossForThePeriod"],
};

export interface CanonicalResult {
  aliasProven?: boolean;           // alternative tag names accepted because every identity check passed
  symbol: string | null;
  periodStart: string;
  periodEnd: string;
  periodKind: PeriodKind;
  label: string;
  basis: "standalone" | "consolidated";
  template: "industrial" | "bank" | "life_insurance" | "general_insurance";
  audited: string | null;
  lines: Record<string, string>;      // exact rupee text (EPS in rupees per share)
  missing: string[];                  // canonical lines not reported (null with reason, D52)
  checks: { name: string; ok: boolean; detail: string }[];
}

function months(a: string, b: string): number {
  const [y1, m1] = a.split("-").map(Number), [y2, m2] = b.split("-").map(Number);
  return (y2! - y1!) * 12 + (m2! - m1!) + 1;
}

/** Aliases: "auto" (default) = only old-GAAP files; "all"/"none" exist for the whole-population census (D134). */
/** span "ytd": read the year-to-date context instead of the quarter (Q4 files → full-year figures, D90). NSE convention
 *  (checked on INFY Mar 2024 in-bse-fin and Mar 2026 Integrated Filing): FourD is FY start → period end even when it
 *  carries the quarter's own dates (C29); without FourD, the context from FY start to period end. */
/** periodStart (D169): read the dimension-free context from this date to the period end instead of the file's own
 *  reporting period (the quarter inside a half-year file). */
export interface CanonicalOptions { aliases?: "auto" | "all" | "none"; span?: "period" | "ytd"; undefinedYtd?: boolean; periodStart?: string }

export function canonicalResult(inst: XbrlInstance, opts: CanonicalOptions = {}): CanonicalResult {
  const P = prefixOf(inst);
  const meta = (tag: string) => inst.facts.find((f) => f.tag === P + tag)?.value ?? null;
  const pStart = meta("DateOfStartOfReportingPeriod"), end = meta("DateOfEndOfReportingPeriod");
  if (!pStart || !end) throw new Error("results: reporting period not found");
  const ytd = opts.span === "ytd";
  const fyStartMeta = meta("DateOfStartOfFinancialYear");
  let start = ytd ? (fyStartMeta ?? (() => { throw new Error("results: financial-year start not found"); })()) : (opts.periodStart ?? pStart);
  // Current-period context: entity level (no dimensions) spanning exactly the reporting period.
  // V1 hint (C29): the year-to-date context (FourD) can carry the quarter's own dates; prefer the quarter (OneD)
  // explicitly instead of relying on document order (20,437 files had both).
  const spans = [...inst.contexts.values()].filter((c) => c.start === start && c.end === end && Object.keys(c.dims).length === 0);
  let ctx = ytd ? (inst.contexts.get("FourD") ?? spans[0]
      // C4 for the year (switch, D134 census first): FY22 in-bse-fin files reference "FourD" without defining it (2,812 March-quarter files)
      ?? (opts.undefinedYtd && inst.facts.some((f) => f.contextRef === "FourD") ? { id: "FourD", entity: meta("Symbol"), start, end, instant: null, dims: {} } : undefined))
    : spans.find((c) => c.id === "OneD") ?? spans.find((c) => !/^four/i.test(c.id)) ?? spans[0];
  if (ytd && !ctx) throw new Error(`results: no year-to-date context for ${start}..${end}`);
  // C64: the filer typed the start date wrong (HDFCLIFE / ICICILIFE Q3 FY26: DateOfStartOfReportingPeriod 2025-01-10 for
  // 2025-10-01). The current-period context's own dates rule — only when that context (OneD, no dimensions) ends on the
  // reporting end date, so a file whose content is another period (SIEMENS "Q3 FY26" holding Apr–Jun 2025) still fails.
  if (!ctx && !ytd && !opts.periodStart) {
    const one = inst.contexts.get("OneD");
    if (one && one.start && one.end === end && Object.keys(one.dims).length === 0) { ctx = one; start = one.start; }
  }
  if (!ctx && !opts.periodStart) {
    // Some filings (seen: 2021 in-bse-fin files) reference a context id they never define. The filing's own
    // DateOfStart/EndOfReportingPeriod facts sit in that same context id, so they define its period (FMEA C4).
    const ref = inst.facts.find((f) => f.tag === P + "DateOfEndOfReportingPeriod")?.contextRef;
    if (ref && !inst.contexts.has(ref)) ctx = { id: ref, entity: meta("Symbol"), start, end, instant: null, dims: {} };
  }
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
  const template: CanonicalResult["template"] = has("InterestExpended") ? "bank" : has("IncomeFirstYearPremium") ? "life_insurance"
    : has("PremiumEarned") && has("IncurredClaims") ? "general_insurance" : "industrial";
  const mode = opts.aliases ?? "auto";
  const useAliases = mode === "all" || (mode === "auto" && isOldGaap(inst));
  const tags = template === "bank" ? BANK_TAGS : template === "life_insurance" ? LIFE_TAGS : template === "general_insurance" ? GI_TAGS : PL_TAGS;
  for (const [line, tag] of Object.entries(tags)) {
    const candidates = [tag, ...(PL_SPELLINGS[tag] ?? []), ...(template === "industrial" && useAliases ? PL_ALIASES[line] ?? [] : [])];
    const f = candidates.map((t) => inst.facts.find((x) => x.tag === P + t && x.contextRef === ctx!.id && !x.nil)).find((x) => x);
    if (f?.value !== undefined && f.value !== null && f.value !== "") lines[line] = toText(dec(f.value));
    else missing.push(line);
  }
  // V1 hint (#276): alternative line names (e.g. ProfitLossForThePeriod in Integrated Filings) are the same concept
  // only if the file's own arithmetic proves it: retry with aliases and accept only when every check passes.
  if (mode === "auto" && !useAliases && template === "industrial" && missing.some((m) => ["revenue", "total_income", "pat"].includes(m))) {
    const alt = canonicalResult(inst, { aliases: "all", span: opts.span, undefinedYtd: opts.undefinedYtd, periodStart: opts.periodStart });
    const filled = ["revenue", "total_income", "pat"].every((k) => alt.lines[k] !== undefined);
    if (filled && alt.checks.length >= 3 && alt.checks.every((c) => c.ok)) return { ...alt, aliasProven: true };
  }
  return {
    symbol: meta("Symbol"), periodStart: start, periodEnd: end, periodKind: kind,
    label: fiscalPeriod(end, kind, fyEndMonth).label,
    basis: nature.startsWith("consol") ? "consolidated" : "standalone",
    template,
    audited: meta("WhetherResultsAreAuditedOrUnaudited"),
    lines, missing, checks: template === "bank" ? bankChecks(lines) : template === "life_insurance" ? lifeChecks(lines) : template === "general_insurance" ? giChecks(lines) : identityChecks(lines),
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

/** General-insurer identities (B8, IRDAI revenue account + P&L), tolerance ₹1 lakh. Optional lines count as 0. */
export function giChecks(l: Record<string, string>): { name: string; ok: boolean; detail: string }[] {
  const tol = dec("100000");
  const v = (k: string): Dec | null => (l[k] !== undefined ? dec(l[k]!) : null);
  const z = (k: string): Dec => v(k) ?? dec("0");
  const out: { name: string; ok: boolean; detail: string }[] = [];
  const near = (name: string, lhs: Dec | null, rhs: Dec | null) => {
    if (!lhs || !rhs) return;
    const d = sub(lhs, rhs);
    const abs = d.units < 0n ? { units: -d.units, scale: d.scale } : d;
    out.push({ name, ok: cmp(abs, tol) <= 0, detail: `${toText(lhs)} vs ${toText(rhs)}` });
  };
  const sum = (...ks: string[]) => (ks.every((k) => v(k)) ? ks.map((k) => v(k)!).reduce((a, b) => add(a, b)) : null);
  near("premium earned + investment income + other income = operating income", sum("premium_earned", "investment_income_policyholders") && add(sum("premium_earned", "investment_income_policyholders")!, z("other_income")), v("operating_income"));
  near("claims paid + change in outstanding = claims incurred", sum("claims_paid", "change_outstanding_claims"), v("claims_incurred"));
  near("employee + other expenses = operating expenses", sum("employee_cost", "other_operating_expenses"), v("operating_expenses"));
  near("commission + expenses + premium deficiency + claims = total operating expenses", sum("commission", "operating_expenses", "claims_incurred") && add(sum("commission", "operating_expenses", "claims_incurred")!, z("premium_deficiency")), v("total_operating_expenses"));
  near("premium earned − total operating expenses = underwriting result", v("premium_earned") && v("total_operating_expenses") ? sub(v("premium_earned")!, v("total_operating_expenses")!) : null, v("underwriting_result"));
  // Filers differ on whether the two provision lines sit inside operating profit (NIACL: filed but outside; ICICIGI Mar
  // 2026 files 39,247 m "doubtful debts" outside it): either form holds, and the detail says which.
  if (v("operating_income") && v("total_operating_expenses") && v("operating_profit")) {
    const gross = sub(v("operating_income")!, v("total_operating_expenses")!);
    const net = sub(sub(gross, z("provision_doubtful_debts")), z("provision_diminution"));
    const within = (x: Dec) => { const d = sub(x, v("operating_profit")!); return cmp(d.units < 0n ? { units: -d.units, scale: d.scale } : d, tol) <= 0; };
    const ok = within(net) || within(gross);
    out.push({ name: "operating income − total operating expenses (− provisions) = operating profit", ok,
      detail: `${toText(within(net) ? net : gross)} vs ${toText(v("operating_profit")!)}${!within(net) && within(gross) ? " (provisions outside operating profit)" : ""}` });
  }
  near("transfer + shareholders' investment and other income = shareholders' income", sum("transfer_to_shareholders", "investment_income_shareholders") && add(sum("transfer_to_shareholders", "investment_income_shareholders")!, z("other_income_shareholders")), v("total_income_shareholders"));
  near("shareholders' income − non-operating expenses = profit before extraordinary items", v("total_income_shareholders") && v("non_operating_expenses") ? sub(v("total_income_shareholders")!, v("non_operating_expenses")!) : null, v("pbt_before_extraordinary"));
  near("PBT − tax = PAT", v("pbt") && v("tax") ? sub(v("pbt")!, v("tax")!) : null, v("pat"));
  return out;
}
