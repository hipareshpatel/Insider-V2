// D154: every reported line item of the three statements (industrial / Ind AS Schedule III layout, results XBRL), not a
// hand-picked subset. Line lists and their signs come from the census of all 74,571 results files
// (docs/statement-line-items.md) and the filings' own arithmetic (checked on INFY Sep 2026 consolidated). Each statement's
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
    "AdjustmentsForFairValueGainsLosses"),
  ...minus("AdjustmentsForDividendIncome", "AdjustmentsForInterestIncome", "AdjustmentsForUndistributedProfitsOfAssociates",
    "ShareOfProfitAndLossFromPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships"),
};
/** Cash generated from operations → net cash from operating activities. */
export const CF_OPERATING: Signed = {
  ...plus("CashFlowsFromUsedInOperations", "DividendsReceivedClassifiedAsOperatingActivities", "InterestReceivedClassifiedAsOperatingActivities", "OtherInflowsOutflowsOfCashClassifiedAsOperatingActivities"),
  ...minus("InterestPaidClassifiedAsOperatingActivities", "IncomeTaxesPaidRefundClassifiedAsOperatingActivities"),
};
export const CF_INVESTING: Signed = {
  ...plus("CashFlowsFromLosingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities", "OtherCashReceiptsFromSalesOfEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities",
    "OtherCashReceiptsFromSalesOfInterestsInJointVenturesClassifiedAsInvestingActivities", "CashReceiptsFromShareOfProfitsOfPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships",
    "ProceedsFromSalesOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "ProceedsFromSalesOfInvestmentPropertyClassifiedAsInvestingActivities",
    "ProceedsFromSalesOfIntangibleAssetsClassifiedAsInvestingActivities", "ProceedsFromSalesOfIntangibleAssetsUnderDevelopment", "ProceedsFromSalesOfGoodwillClassifiedAsInvestingActivities",
    "ProceedsFromBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities", "ProceedsFromGovernmentGrantsClassifiedAsInvestingActivities",
    "ProceedsFromSalesOfOtherLongTermAssetsClassifiedAsInvestingActivities", "CashReceiptsFromRepaymentOfAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities",
    "CashReceiptsFromFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities", "DividendsReceivedClassifiedAsInvestingActivities",
    "InterestReceivedClassifiedAsInvestingActivities", "OtherInflowsOutflowsOfCashClassifiedAsInvestingActivities"),
  ...minus("CashFlowsUsedInObtainingControlOfSubsidiariesOrOtherBusinessesClassifiedAsInvestingActivities", "OtherCashPaymentsToAcquireEquityOrDebtInstrumentsOfOtherEntitiesClassifiedAsInvestingActivities",
    "OtherCashPaymentsToAcquireInterestsInJointVenturesClassifiedAsInvestingActivities", "CashPaymentForInvestmentInPartnershipFirmOrAssociationOfPersonsOrLimitedLiabilityPartnerships",
    "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "PurchaseOfInvestmentPropertyClassifiedAsInvestingActivities", "PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities",
    "PurchaseOfIntangibleAssetsUnderDevelopment", "PurchaseOfGoodwillClassifiedAsInvestingActivities", "PurchaseOfBiologicalAssetsOtherThanBearerPlantsClassifiedAsInvestingActivities",
    "PurchaseOfOtherLongTermAssetsClassifiedAsInvestingActivities", "CashAdvancesAndLoansMadeToOtherPartiesClassifiedAsInvestingActivities",
    "CashPaymentsForFutureContractsForwardContractsOptionContractsAndSwapContractsClassifiedAsInvestingActivities", "IncomeTaxesPaidRefundClassifiedAsInvestingActivities"),
};
export const CF_FINANCING: Signed = {
  ...plus("ProceedsFromChangesInOwnershipInterestsInSubsidiaries", "ProceedsFromIssuingSharesClassifiedAsFinancingActivities", "ProceedsFromIssuingOtherEquityInstruments",
    "ProceedsFromExerciseOfStockOptions", "ProceedsFromIssuingDebenturesNotesBondsEtc", "ProceedsFromBorrowingsClassifiedAsFinancingActivities", "OtherInflowsOutflowsOfCashClassifiedAsFinancingActivities"),
  ...minus("PaymentsFromChangesInOwnershipInterestsInSubsidiaries", "PaymentsToAcquireOrRedeemEntitysShares", "PaymentsOfOtherEquityInstruments", "RepaymentsOfBorrowingsClassifiedAsFinancingActivities",
    "PaymentsOfFinanceLeaseLiabilitiesClassifiedAsFinancingActivities", "PaymentsOfLeaseLiabilitiesClassifiedAsFinancingActivities", "DividendsPaidClassifiedAsFinancingActivities",
    "InterestPaidClassifiedAsFinancingActivities", "IncomeTaxesPaidRefundClassifiedAsFinancingActivities"),
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
  const signedSum = (l: Record<string, string>, s: Signed) => Object.entries(s).reduce((a, [k, sg]) => { const x = v(l, k); return x ? (sg > 0 ? add(a, x) : sub(a, x)) : a; }, zero);
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
    const lines = read(bsCtx, BS_LINES), checks: DetailStatement["checks"] = [];
    for (const [total, parts] of Object.entries(BS_GROUPS)) {
      const t = v(lines, total);
      if (!t || !parts.some((p) => lines[p] !== undefined)) continue;
      const s = parts.reduce((a, p) => add(a, v(lines, p) ?? zero), zero);
      checks.push({ name: `${total} = its parts`, ok: within(s, t), detail: `${toText(s)} vs ${toText(t)}` });
    }
    if (Object.keys(lines).length) bs = { lines, checks };
  }
  return { bs, cf };
}
