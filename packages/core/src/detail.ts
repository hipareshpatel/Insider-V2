// D154: every reported line item of the three statements (industrial / Ind AS Schedule III layout, results XBRL), not a
// hand-picked subset. Line lists and their signs come from the census of all 74,571 results files
// (docs/DISCLO.md Part 5 (statement line items)) and the filings' own arithmetic (checked on INFY Sep 2026 consolidated). Each statement's
// detail is checked against its own subtotals before it is used; values in rupees, exact decimals.
import { type Dec, add, cmp, dec, sub, toText } from "./decimal.js";
import type { XbrlInstance } from "./xbrl.js";

type Signed = Record<string, 1 | -1>;
const plus = (...t: string[]): Signed => Object.fromEntries(t.map((x) => [x, 1]));
const minus = (...t: string[]): Signed => Object.fromEntries(t.map((x) => [x, -1]));

/** Cash flow: operating adjustments (indirect method) → AdjustmentsForReconcileProfitLoss. */
export const CF_ADJUSTMENTS: Signed = {
  ...plus("AdjustmentsForFinanceCosts", "AdjustmentsForDecreaseIncreaseInInventories", "AdjustmentsForDecreaseIncreaseInTradeReceivablesCurrent",
    "AdjustmentsForDecreaseIncreaseInTradeReceivablesNoncurrent", "AdjustmentsForDecreaseIncreaseInOtherCurrentAssets", "AdjustmentsForDecreaseIncreaseInOtherNoncurrentAssets",
    "AdjustmentsForOtherFinancialAssetsNoncurrent", "AdjustmentsForOtherFinancialAssetsCurrent", "AdjustmentsForOtherBankBalances",
    "AdjustmentsForIncreaseDecreaseInTradePayablesCurrent", "AdjustmentsForIncreaseDecreaseInTradePayablesNoncurrent", "AdjustmentsForIncreaseDecreaseInOtherCurrentLiabilities",
    "AdjustmentsForIncreaseDecreaseInOtherNoncurrentLiabilities", "AdjustmentsForDepreciationAndAmortisationExpense", "AdjustmentsForImpairmentLossReversalOfImpairmentLossRecognisedInProfitOrLoss",
    "AdjustmentsForProvisionsCurrent", "AdjustmentsForProvisionsNoncurrent", "AdjustmentsForOtherFinancialLiabilitiesCurrent", "AdjustmentsForOtherFinancialLiabilitiesNoncurrent",
    "AdjustmentsForUnrealisedForeignExchangeLossesGains", "AdjustmentsForSharebasedPayments", "OtherAdjustmentsForWhichCashEffectsAreInvestingOrFinancingCashFlow",
    "OtherAdjustmentsToReconcileProfitLoss", "OtherAdjustmentsForNoncashItems",
    // reported already signed (a gain is negative): HUL Sep 2026 −810 m, MARUTI −18,686 m reproduce the filed totals only when added
    "AdjustmentsForFairValueGainsLosses",
    // older layout (D154 residual class A, 574 files): undivided working-capital lines; used only when the file has no
    // current/non-current split (FALLBACK below). Filing 1434505: 4,182.5 m + 437.7 m + 4,807.7 m = 9,427.9 m filed.
    "AdjustmentsForDecreaseIncreaseInTradeReceivables", "AdjustmentsForIncreaseDecreaseInTradePayables", "AdjustmentsForProvisions"),
  ...minus("AdjustmentsForDividendIncome", "AdjustmentsForInterestIncome", "AdjustmentsForUndistributedProfitsOfAssociates",
    "ShareOfProfitAndLossFromPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships"),
};
/** Cash generated from operations → net cash from operating activities. */
export const CF_OPERATING: Signed = {
  ...plus("CashFlowsFromUsedInOperations", "DividendsReceivedClassifiedAsOperatingActivities", "InterestReceivedClassifiedAsOperatingActivities", "OtherInflowsOutflowsOfCashClassifiedAsOperatingActivities",
    "ProceedsFromExtraordinaryItemsClassifiedAsOperatingActivities"),
  ...minus("InterestPaidClassifiedAsOperatingActivities", "IncomeTaxesPaidRefundClassifiedAsOperatingActivities", "PaymentForExtraordinaryItemsClassifiedAsOperatingActivities"),
};
export const CF_INVESTING: Signed = {
  ...plus("CashFlowsFromLosingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities", "OtherCashReceiptsFromSalesOfEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities",
    "OtherCashReceiptsFromSalesOfInterestsInJointVenturesClassifiedAsInvestingActivities", "CashReceiptsFromShareOfProfitsOfPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships",
    "ProceedsFromSalesOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "ProceedsFromSalesOfInvestmentPropertyClassifiedAsInvestingActivities",
    "ProceedsFromSalesOfIntangibleAssetsClassifiedAsInvestingActivities", "ProceedsFromSalesOfIntangibleAssetsUnderDevelopment", "ProceedsFromSalesOfGoodwillClassifiedAsInvestingActivities",
    "ProceedsFromBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities", "ProceedsFromGovernmentGrantsClassifiedAsInvestingActivities",
    "ProceedsFromSalesOfOtherLongTermAssetsClassifiedAsInvestingActivities", "CashReceiptsFromRepaymentOfAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities",
    "CashReceiptsFromFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities", "DividendsReceivedClassifiedAsInvestingActivities",
    "InterestReceivedClassifiedAsInvestingActivities", "OtherInflowsOutflowsOfCashClassifiedAsInvestingActivities",
    "ProceedsFromSalesOfTangibleAssetsClassifiedAsInvestingActivities", "ProceedsFromExtraordinaryItemsClassifiedAsInvestingActivities"),
  ...minus("CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities", "OtherCashPaymentsToAcquireEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities",
    "OtherCashPaymentsToAcquireInterestsInJointVenturesClassifiedAsInvestingActivities", "CashPaymentForInvestmentInPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships",
    "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "PurchaseOfInvestmentPropertyClassifiedAsInvestingActivities", "PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities",
    "PurchaseOfIntangibleAssetsUnderDevelopment", "PurchaseOfGoodwillClassifiedAsInvestingActivities", "PurchaseOfBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities",
    "PurchaseOfOtherLongTermAssetsClassifiedAsInvestingActivities", "CashAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities",
    "CashPaymentsForFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities", "IncomeTaxesPaidRefundClassifiedAsInvestingActivities",
    "PurchaseOfTangibleAssetsClassifiedAsInvestingActivities", "PaymentForExtraordinaryItemsClassifiedAsInvestingActivities"),
};
export const CF_FINANCING: Signed = {
  ...plus("ProceedsFromChangesInOwnershipInterestsInSubsidiaries", "ProceedsFromIssuingSharesClassifiedAsFinancingActivities", "ProceedsFromIssuingOtherEquityInstruments",
    "ProceedsFromExerciseOfStockOptions", "ProceedsFromIssuingDebenturesNotesBondsEtc", "ProceedsFromBorrowingsClassifiedAsFinancingActivities", "OtherInflowsOutflowsOfCashClassifiedAsFinancingActivities",
    "ProceedsFromIssuingShares", "ProceedsFromExtraordinaryItemsClassifiedAsFinancingActivities"),
  ...minus("PaymentsFromChangesInOwnershipInterestsInSubsidiaries", "PaymentsToAcquireOrRedeemEntitysShares", "PaymentsOfOtherEquityInstruments", "RepaymentsOfBorrowingsClassifiedAsFinancingActivities",
    "PaymentsOfFinanceLeaseLiabilitiesClassifiedAsFinancingActivities", "PaymentsOfLeaseLiabilitiesClassifiedAsFinancingActivities", "DividendsPaidClassifiedAsFinancingActivities",
    "InterestPaidClassifiedAsFinancingActivities", "IncomeTaxesPaidRefundClassifiedAsFinancingActivities", "PaymentForExtraordinaryItemsClassifiedAsFinancingActivities"),
};
/** Undivided / older spellings counted only when none of their split or newer forms is reported (never twice). */
export const FALLBACK: Record<string, string[]> = {
  AdjustmentsForDecreaseIncreaseInTradeReceivables: ["AdjustmentsForDecreaseIncreaseInTradeReceivablesCurrent", "AdjustmentsForDecreaseIncreaseInTradeReceivablesNoncurrent"],
  AdjustmentsForIncreaseDecreaseInTradePayables: ["AdjustmentsForIncreaseDecreaseInTradePayablesCurrent", "AdjustmentsForIncreaseDecreaseInTradePayablesNoncurrent"],
  AdjustmentsForProvisions: ["AdjustmentsForProvisionsCurrent", "AdjustmentsForProvisionsNoncurrent"],
  ProceedsFromSalesOfTangibleAssetsClassifiedAsInvestingActivities: ["ProceedsFromSalesOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
  PurchaseOfTangibleAssetsClassifiedAsInvestingActivities: ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
  ProceedsFromIssuingShares: ["ProceedsFromIssuingSharesClassifiedAsFinancingActivities"],
};
const CF_TOTALS = ["AdjustmentsForReconcileProfitLoss", "CashFlowsFromUsedInOperatingActivities", "CashFlowsFromUsedInInvestingActivities", "CashFlowsFromUsedInFinancingActivities",
  "IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges", "EffectOfExchangeRateChangesOnCashAndCashEquivalents", "IncreaseDecreaseInCashAndCashEquivalents"];

/** Balance sheet: each subtotal = its parts (all + ; parts a filing omits count as 0). */
export const BS_GROUPS: Record<string, string[]> = {
  CurrentFinancialAssets: ["CurrentInvestments", "TradeReceivablesCurrent", "CashAndCashEquivalents", "BankBalanceOtherThanCashAndCashEquivalents", "LoansCurrent", "OtherCurrentFinancialAssets"],
  CurrentAssets: ["Inventories", "CurrentFinancialAssets", "CurrentTaxAssets", "OtherCurrentAssets"],
  NoncurrentFinancialAssets: ["NoncurrentInvestments", "TradeReceivablesNoncurrent", "LoansNoncurrent", "OtherNoncurrentFinancialAssets"],
  NoncurrentAssets: ["PropertyPlantAndEquipment", "CapitalWorkInProgress", "InvestmentProperty", "Goodwill", "OtherIntangibleAssets", "IntangibleAssetsUnderDevelopment",
    "BiologicalAssetsOtherThanBearerPlants", "InvestmentsAccountedForUsingEquityMethod", "NoncurrentFinancialAssets", "DeferredTaxAssetsNet", "OtherNoncurrentAssets"],
  TradePayablesCurrent: ["TotalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseCurrent", "TotalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseCurrent"],
  CurrentFinancialLiabilities: ["BorrowingsCurrent", "TradePayablesCurrent", "OtherCurrentFinancialLiabilities"],
  CurrentLiabilities: ["CurrentFinancialLiabilities", "OtherCurrentLiabilities", "ProvisionsCurrent", "CurrentTaxLiabilities", "DeferredGovernmentGrantsCurrent"],
  TradePayablesNoncurrent: ["TotalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseNoncurrent", "TotalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseNoncurrent"],
  NoncurrentFinancialLiabilities: ["BorrowingsNoncurrent", "TradePayablesNoncurrent", "OtherNoncurrentFinancialLiabilities"],
  NoncurrentLiabilities: ["NoncurrentFinancialLiabilities", "ProvisionsNoncurrent", "DeferredTaxLiabilitiesNet", "DeferredGovernmentGrantsNoncurrent", "OtherNoncurrentLiabilities"],
  EquityAttributableToOwnersOfParent: ["EquityShareCapital", "OtherEquity"],
};
const BS_EXTRA = ["Assets", "EquityAndLiabilities", "Equity", "Liabilities", "NonControllingInterest", "NoncurrentAssetsClassifiedAsHeldForSale",
  "RegulatoryDeferralAccountDebitBalancesAndRelatedDeferredTaxAssets", "LiabilitiesDirectlyAssociatedWithAssetsInDisposalGroupClassifiedAsHeldForSale",
  "RegulatoryDeferralAccountCreditBalancesAndRelatedDeferredTaxLiability"];

/** NBFC balance sheet, Schedule III Division III (financial / non-financial, no current split). Tag names as filed in
 *  the NBFC Integrated Filing (BAJFINANCE Sep 2026 consolidated: every group adds to its filed total). NSE's taxonomy
 *  spells the financial-assets total "FinanicalAssets"; the correct spelling is accepted too. */
const DIV3_FIN_ASSETS = ["CashAndCashEquivalents", "BankBalanceOtherThanCashAndCashEquivalents", "DerivativeFinancialInstrumentsFinancialAssets",
  "TradeReceivables", "OtherReceivables", "Loans", "Investments", "OtherFinancialAssets"];
const DIV3_NONFIN_ASSETS = ["Inventories", "CurrentTaxAssetsNet", "DeferredTaxAssetsNet", "InvestmentProperty", "BiologicalAssetsOtherThanBearerPlants",
  "PropertyPlantAndEquipment", "CapitalWorkInProgress", "IntangibleAssetsUnderDevelopment", "Goodwill", "OtherIntangibleAssets", "OtherNonFinancialAssets"];
export const BS_GROUPS_DIV3: Record<string, string[]> = {
  FinanicalAssets: DIV3_FIN_ASSETS, FinancialAssets: DIV3_FIN_ASSETS,
  NonFinancialAssets: DIV3_NONFIN_ASSETS,
  FinancialLiabilities: ["DerivativeFinancialInstrumentsFinancialLiabilities",
    "TotalOutstandingDuesOfMicroEnterpriseAndSmallEnterprise", "TotalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterprise",
    "TotalOutstandingDuesOfMicroEnterpriseAndSmallEnterpriseOtherPayables", "TotalOutstandingDuesOfCreditorsOtherThanMicroEnterpriseAndSmallEnterpriseOtherPayables",
    "DebtSecurities", "Borrowings", "Deposits", "SubordinatedLiabilities", "OtherFinancialLiabilities"],
  NonFinancialLiabilities: ["CurrentTaxLiabilities", "Provisions", "DeferredTaxLiabilitiesNet", "OtherNonFinancialLiabilities"],
  EquityAttributableToOwnersOfParent: ["EquityShareCapital", "OtherEquity"],
};
export const BS_LINES_DIV3 = [...new Set([...Object.keys(BS_GROUPS_DIV3), ...Object.values(BS_GROUPS_DIV3).flat(),
  "Assets", "EquityAndLiabilities", "Equity", "Liabilities", "NonControllingInterest", "NoncurrentAssetsClassifiedAsHeldForSale",
  "LiabilitiesDirectlyAssociatedWithAssetsInDisposalGroupClassifiedAsHeldForSale"])];

/** Insurer balance sheet, IRDAI format (Form L-3 / B-BS: sources and application of funds). HDFCLIFE Sep 2026
 *  standalone: every group adds to its filed total. A part written "-Tag" is subtracted (net current assets). */
export const BS_GROUPS_INS: Record<string, string[]> = {
  ShareholdersFunds: ["ShareCapital", "ShareApplicationMoneyReceivedPendingAllotmentOfShares", "ReservesAndSurplus", "CreditDebitFairValueChangeAccount"],
  LinkedLiabilities: ["ProvisionForLinkedLiabilities", "ChangeInFairvalueAccount", "DiscontinuedOnAccountOfNonPaymentOfPremium",
    "CreditDebitFairValueChangeAccountFundsForDiscontinuedPolicies", "OthersDiscontinuance"],
  PolicyholdersFunds: ["CreditDebitFairValueChangeAccountPolicyholdersFunds", "RevaluationReserveInvestmentProperty", "PolicyLiabilities", "InsuranceReserve", "LinkedLiabilities"],
  SourcesOfFunds: ["ShareholdersFunds", "Borrowings", "PolicyholdersFunds", "FundsForFutureAppropriations"],
  CurrentAssets: ["CashAndBankBalances", "AdvancesAndOtherAssets"],
  CurrentLiabilitiesAndProvisions: ["CurrentLiabilities", "Provisions"],
  NetCurrentAssets: ["CurrentAssets", "-CurrentLiabilitiesAndProvisions"],
  ApplicationOfFunds: ["InvestmentsShareholders", "InvestmentsPolicyholders", "AssetsHeldToCoverLinkLiabilities", "Loans", "FixedAssets", "DeferredTaxAsset",
    "NetCurrentAssets", "MiscellaneousExpenditureToTheExtentNotWrittenOffOrAdjusted", "DebitBalanceInProfitAndLossAccountShareholdersAccount"],
};
const bare = (t: string) => t.replace(/^-/, "");
export const BS_LINES_INS = [...new Set([...Object.keys(BS_GROUPS_INS), ...Object.values(BS_GROUPS_INS).flat().map(bare)])];

export const CF_LINES = [...new Set([...Object.keys(CF_ADJUSTMENTS), ...Object.keys(CF_OPERATING), ...Object.keys(CF_INVESTING), ...Object.keys(CF_FINANCING), ...CF_TOTALS])];
export const BS_LINES = [...new Set([...Object.keys(BS_GROUPS), ...Object.values(BS_GROUPS).flat(), ...BS_EXTRA])];

export interface DetailStatement { lines: Record<string, string>; checks: { name: string; ok: boolean; detail: string }[] }
export interface Detail { bs: DetailStatement | null; cf: DetailStatement | null }

const TOL = dec("100000"); // ₹1 lakh, as everywhere (filings round to lakh/crore)
function within(l: Dec, r: Dec) { const d = sub(l, r); return cmp(d.units < 0n ? { units: -d.units, scale: d.scale } : d, TOL) <= 0; }

/** Every listed line with a value in the statement's context (zeros kept: reported 0 ≠ not reported), plus checks. */
export function statementDetail(inst: XbrlInstance, bsCtx: string | null, cfCtx: string | null): Detail {
  const pf = inst.facts.find((x) => /:DateOfEndOfReportingPeriod$/.test(x.tag))?.tag.split(":")[0] ?? "in-bse-fin";
  const read = (ctx: string, names: string[]) => {
    const want = new Set(names.map((n) => `${pf}:${n}`)), lines: Record<string, string> = {};
    for (const f of inst.facts) if (f.contextRef === ctx && !f.nil && f.value && want.has(f.tag) && /^-?\d/.test(f.value)) lines[f.tag.slice(pf.length + 1)] ??= toText(dec(f.value));
    return lines;
  };
  const v = (l: Record<string, string>, k: string) => (l[k] !== undefined ? dec(l[k]!) : null);
  const zero = dec("0");
  const counted = (l: Record<string, string>, k: string) => !(FALLBACK[k] ?? []).some((f) => l[f] !== undefined);
  const signedSum = (l: Record<string, string>, s: Signed) => Object.entries(s).reduce((a, [k, sg]) => { const x = counted(l, k) ? v(l, k) : null; return x ? (sg > 0 ? add(a, x) : sub(a, x)) : a; }, zero);
  let cf: DetailStatement | null = null;
  if (cfCtx) {
    const lines = read(cfCtx, CF_LINES), checks: DetailStatement["checks"] = [];
    const chk = (name: string, parts: Signed, total: string) => {
      const t = v(lines, total);
      if (!t || !Object.keys(parts).some((k) => lines[k] !== undefined)) return;
      const s = signedSum(lines, parts);
      checks.push({ name, ok: within(s, t), detail: `${toText(s)} vs ${toText(t)}` });
    };
    if (Object.keys(lines).length) {
      chk("operating adjustments = total adjustments", CF_ADJUSTMENTS, "AdjustmentsForReconcileProfitLoss");
      chk("cash from operations − interest − tax + receipts = operating cash flow", CF_OPERATING, "CashFlowsFromUsedInOperatingActivities");
      chk("investing lines = investing cash flow", CF_INVESTING, "CashFlowsFromUsedInInvestingActivities");
      chk("financing lines = financing cash flow", CF_FINANCING, "CashFlowsFromUsedInFinancingActivities");
      cf = { lines, checks };
    }
  }
  let bs: DetailStatement | null = null;
  if (bsCtx) {
    // Division III (NBFC) when the file carries its financial / non-financial totals; else Division II
    const div3 = inst.facts.some((f) => f.contextRef === bsCtx && /:(Finanical|Financial)Assets$|:NonFinancialAssets$/.test(f.tag));
    // insurers (IRDAI): sources and application of funds
    const ins = inst.facts.some((f) => f.contextRef === bsCtx && /:SourcesOfFunds$/.test(f.tag)) && inst.facts.some((f) => f.contextRef === bsCtx && /:ApplicationOfFunds$/.test(f.tag));
    const lines = read(bsCtx, ins ? BS_LINES_INS : div3 ? BS_LINES_DIV3 : BS_LINES), checks: DetailStatement["checks"] = [];
    for (const [total, parts] of Object.entries(ins ? BS_GROUPS_INS : div3 ? BS_GROUPS_DIV3 : BS_GROUPS)) {
      const t = v(lines, total);
      if (!t || !parts.some((p) => lines[bare(p)] !== undefined)) continue;
      const s = parts.reduce((a, p) => (p.startsWith("-") ? sub(a, v(lines, bare(p)) ?? zero) : add(a, v(lines, p) ?? zero)), zero);
      checks.push({ name: `${total} = its parts`, ok: within(s, t), detail: `${toText(s)} vs ${toText(t)}` });
    }
    if (ins) {
      const a = v(lines, "SourcesOfFunds"), b = v(lines, "ApplicationOfFunds");
      if (a && b) checks.push({ name: "sources of funds = application of funds", ok: within(a, b), detail: `${toText(a)} vs ${toText(b)}` });
    }
    if (Object.keys(lines).length) bs = { lines, checks };
  }
  return { bs, cf };
}
