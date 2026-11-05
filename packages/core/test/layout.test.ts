import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANK_TAGS, BS_BANK, BS_NBFC, BS_LINES_DIV3, BS_INSURANCE, BS_LINES_INS, BS_GENERAL_INSURANCE, BS_LINES_GI, BS_INDUSTRIAL, BS_LINES, CF_INDUSTRIAL, CF_LINES, CF_SUMMARY, GI_TAGS, LIFE_TAGS, PL_BANK, PL_GENERAL, PL_INDUSTRIAL, PL_LIFE, PL_NBFC, PL_TAGS, balanceAndCash, canonicalResult, chooseLayout, derivedPl, layoutStatement, parseXbrl, statementDetail, tagLabel, type LayoutNode } from "../src/index.js";

const keys = (t: LayoutNode[]): string[] => t.flatMap((nd) => [nd.key, ...(nd.children ? keys(nd.children) : [])]);
const inst = parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_INFY_IF_Q2FY27_cons_full.xml"), "utf8"));

describe("D157 statement layout (Schedule III Div II, industrial)", () => {
  it("every stored line has a place in its tree, once", () => {
    for (const [tree, stored] of [[BS_INDUSTRIAL, BS_LINES.map((t) => `x:${t}`)], [CF_INDUSTRIAL, CF_LINES.map((t) => `x:${t}`)]] as const) {
      const k = keys(tree);
      expect(new Set(k).size).toBe(k.length);
      expect(stored.filter((s) => !k.includes(s))).toEqual([]);
    }
    expect(keys(PL_INDUSTRIAL).filter((k) => !(k in PL_TAGS))).toEqual([]);
  });
  it("lays a real P&L out in Schedule III order, filed values only, with derived rows labelled", () => {
    const r = canonicalResult(inst);
    const rows = layoutStatement(PL_INDUSTRIAL, r.lines);
    expect(rows.slice(0, 4).map((x) => x.key)).toEqual(["revenue", "other_income", "total_income", "total_expenses"]);
    expect(rows.find((x) => x.key === "employee_cost")).toMatchObject({ level: 1, kind: "filed", value: r.lines.employee_cost });
    expect(rows.every((x) => x.kind === "filed" || x.kind === "head")).toBe(true);
    const d = derivedPl(r.lines);
    expect(d.map((x) => x.kind)).toEqual(["derived", "derived"]);
    const want = BigInt(r.lines.revenue!) - BigInt(r.lines.total_expenses!) + BigInt(r.lines.finance_cost!) + BigInt(r.lines.depreciation!);
    expect(BigInt(d[0]!.value!)).toBe(want);
  });
  it("a head that is not filed keeps its filed sub-rows and shows no value; empty branches are left out", () => {
    const detail = statementDetail(inst, "OneI", "FourD");
    const v = Object.fromEntries(Object.entries(detail.bs?.lines ?? {}).map(([k, val]) => [`x:${k}`, val]));
    expect(Object.keys(v).length).toBeGreaterThan(10);
    delete v["x:CurrentAssets"];
    const rows = layoutStatement(BS_INDUSTRIAL, v);
    expect(rows.find((x) => x.key === "x:CurrentAssets")).toMatchObject({ kind: "head", value: null });
    expect(rows.find((x) => x.key === "x:Inventories")?.level).toBe(2);
    expect(rows.some((x) => x.value === null && !rows.some((y) => y.level > x.level))).toBe(false);
  });
  it("marks deducted lines with sign −1 and keeps the filed value; hideZeros drops zero rows only", () => {
    const rows = layoutStatement(CF_INDUSTRIAL, { "x:CashFlowsFromUsedInInvestingActivities": "-40", "x:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities": "50",
      "x:InterestReceivedClassifiedAsInvestingActivities": "10", "x:PurchaseOfGoodwillClassifiedAsInvestingActivities": "0" }, { hideZeros: true });
    expect(rows.find((r) => r.key === "x:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities")).toMatchObject({ value: "50", sign: -1 });
    expect(rows.find((r) => r.key === "x:InterestReceivedClassifiedAsInvestingActivities")?.sign).toBeUndefined();
    expect(rows.some((r) => r.key === "x:PurchaseOfGoodwillClassifiedAsInvestingActivities")).toBe(false);
    expect(layoutStatement(CF_INDUSTRIAL, { "x:PurchaseOfGoodwillClassifiedAsInvestingActivities": "0" }).length).toBe(2);
  });
  it("every canonical line of each template has a row in its layout (nothing stored is left out)", () => {
    expect(Object.keys(BANK_TAGS).filter((k) => k !== "paid_up_capital" && !keys(PL_BANK).includes(k))).toEqual([]);
    expect(Object.keys(LIFE_TAGS).filter((k) => !keys(PL_LIFE).includes(k))).toEqual([]);
    expect(Object.keys(GI_TAGS).filter((k) => !keys(PL_GENERAL).includes(k))).toEqual([]);
    for (const t of [PL_BANK, PL_LIFE, PL_GENERAL, PL_NBFC, BS_BANK, CF_SUMMARY]) { const k = keys(t); expect(new Set(k).size).toBe(k.length); }
  });
  it("bank: a real filing (HDFCBANK Sep 2026) lays out in Third Schedule order; heads equal the filed sub-rows", () => {
    const bank = parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "xbrl_HDFCBANK_IF_Q2FY27_full.xml"), "utf8"));
    const r = canonicalResult(bank);
    const lay = chooseLayout("bank", r.lines);
    expect(lay.name).toBe("bank");
    const pl = layoutStatement(lay.pl, r.lines);
    expect(pl[0]).toMatchObject({ key: "interest_earned", level: 0, kind: "filed" });
    const kids = pl.filter((x) => ["interest_on_advances", "income_on_investments", "interest_on_rbi_interbank", "other_interest"].includes(x.key));
    expect(kids.reduce((a, x) => a + BigInt(x.value!), 0n)).toBe(BigInt(pl[0]!.value!));
    const b = balanceAndCash(bank).bs!;
    const bs = layoutStatement(lay.bs, b.lines);
    const sumUnder = (head: string) => { const i = bs.findIndex((x) => x.key === head); let t = 0n; for (const x of bs.slice(i + 1)) { if (x.level === 0) break; t += BigInt(x.value!); } return t; };
    expect(sumUnder("capital_and_liabilities")).toBe(BigInt(b.lines.capital_and_liabilities!));
    expect(sumUnder("total_assets")).toBe(BigInt(b.lines.total_assets!));
    expect(Object.keys(b.lines).filter((k) => !keys(BS_BANK).includes(k))).toEqual([]);
  });
  it("chooses NBFC by its Division III lines and never shows the industrial operating-profit row for it", () => {
    const pl = { revenue: "100", total_expenses: "60", finance_cost: "40", depreciation: "1", impairment_financial_instruments: "5" };
    expect(chooseLayout("industrial", pl).name).toBe("nbfc");
    expect(derivedPl(pl, "nbfc")).toEqual([]);
    expect(chooseLayout("industrial", { revenue: "1" }).name).toBe("industrial");
    expect(chooseLayout("insurance", { premium_earned: "1" }).name).toBe("general_insurance");
    expect(chooseLayout("insurance", { gross_premium: "1" }).name).toBe("life_insurance");
  });
  it("NBFC balance sheet (Div III): BAJFINANCE Sep 2026 filed values are read, checked against their totals, and laid out", () => {
    // real filed values (consolidated, OneI); the financial-liabilities lines are left out here (its check then cannot run)
    const v: Record<string, string> = {"CashAndCashEquivalents": "18151100000", "BankBalanceOtherThanCashAndCashEquivalents": "137628900000", "DerivativeFinancialInstrumentsFinancialAssets": "28316700000", "TradeReceivables": "21459000000", "OtherReceivables": "0", "Loans": "5741744400000", "Investments": "317440300000", "OtherFinancialAssets": "56057300000", "FinanicalAssets": "6320797700000", "Inventories": "0", "CurrentTaxAssetsNet": "2658500000", "DeferredTaxAssetsNet": "19289300000", "InvestmentProperty": "0", "BiologicalAssetsOtherThanBearerPlants": "0", "PropertyPlantAndEquipment": "32793100000", "CapitalWorkInProgress": "757400000", "IntangibleAssetsUnderDevelopment": "1724000000", "Goodwill": "32700000", "OtherIntangibleAssets": "9668800000", "OtherNonFinancialAssets": "6703700000", "NonFinancialAssets": "73627500000", "Assets": "6394425200000", "EquityShareCapital": "6223900000", "OtherEquity": "1225573600000", "EquityAttributableToOwnersOfParent": "1231797500000", "NonControllingInterest": "31855100000", "Equity": "1263652600000", "CurrentTaxLiabilities": "11232600000", "Provisions": "9612700000", "DeferredTaxLiabilitiesNet": "0", "OtherNonFinancialLiabilities": "7396200000", "NonFinancialLiabilities": "28241500000", "Liabilities": "5130772600000", "EquityAndLiabilities": "6394425200000"};
    const facts = Object.entries(v).map(([t, x]) => `<in-capmkt:${t} contextRef="OneI" unitRef="INR" decimals="-5">${x}</in-capmkt:${t}>`).join("");
    const xml = `<?xml version="1.0"?><xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:in-capmkt="x"><xbrli:context id="OneI"><xbrli:entity><xbrli:identifier scheme="s">1</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2026-09-30</xbrli:instant></xbrli:period></xbrli:context><in-capmkt:DateOfEndOfReportingPeriod contextRef="OneI">2026-09-30</in-capmkt:DateOfEndOfReportingPeriod>${facts}</xbrli:xbrl>`;
    const d = statementDetail(parseXbrl(xml), "OneI", null).bs!;
    expect(d.lines.Loans).toBe("5741744400000");
    expect(d.checks.map((c) => c.name).sort()).toEqual(["EquityAttributableToOwnersOfParent = its parts", "FinanicalAssets = its parts", "NonFinancialAssets = its parts", "NonFinancialLiabilities = its parts"]);
    expect(d.checks.every((c) => c.ok)).toBe(true);
    const rows = layoutStatement(BS_NBFC, Object.fromEntries(Object.entries(d.lines).map(([k, x]) => [`x:${k}`, x])), { hideZeros: true });
    expect(rows.find((r) => r.key === "x:Loans")).toMatchObject({ level: 2, value: "5741744400000" });
    expect(rows.find((r) => r.key === "x:FinanicalAssets")).toMatchObject({ level: 1, label: "Financial assets" });
    const k = keys(BS_NBFC); expect(BS_LINES_DIV3.filter((t) => !k.includes(`x:${t}`))).toEqual([]);
  });
  it("insurer balance sheet (IRDAI): HDFCLIFE Sep 2026 standalone filed values all add up, and are laid out", () => {
    const v: Record<string, string> = { ShareCapital: "21725900000", ReservesAndSurplus: "169233800000", ShareApplicationMoneyReceivedPendingAllotmentOfShares: "14500000",
      CreditDebitFairValueChangeAccount: "3003200000", ShareholdersFunds: "193977400000", Borrowings: "30990000000",
      CreditDebitFairValueChangeAccountPolicyholdersFunds: "53824900000", PolicyLiabilities: "2698325900000", InsuranceReserve: "0",
      ProvisionForLinkedLiabilities: "922069500000", ChangeInFairvalueAccount: "165946600000", DiscontinuedOnAccountOfNonPaymentOfPremium: "55942700000",
      OthersDiscontinuance: "138500000", LinkedLiabilities: "1144097300000", PolicyholdersFunds: "3896248100000", FundsForFutureAppropriations: "3647000000",
      SourcesOfFunds: "4124862500000", InvestmentsShareholders: "219010000000", InvestmentsPolicyholders: "2733618200000",
      AssetsHeldToCoverLinkLiabilities: "1144097300000", Loans: "30494800000", FixedAssets: "7783600000", DeferredTaxAsset: "0",
      CashAndBankBalances: "4938400000", AdvancesAndOtherAssets: "89398300000", CurrentAssets: "94336700000", CurrentLiabilities: "103090700000",
      Provisions: "1387400000", CurrentLiabilitiesAndProvisions: "104478100000", NetCurrentAssets: "-10141400000",
      MiscellaneousExpenditureToTheExtentNotWrittenOffOrAdjusted: "0", DebitBalanceInProfitAndLossAccountShareholdersAccount: "0",
      ApplicationOfFunds: "4124862500000", Investments: "4096725500000", Assets: "4124862500000" };
    const facts = Object.entries(v).map(([t, x]) => `<in-capmkt:${t} contextRef="OneI" unitRef="INR" decimals="-5">${x}</in-capmkt:${t}>`).join("");
    const xml = `<?xml version="1.0"?><xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:in-capmkt="x"><xbrli:context id="OneI"><xbrli:entity><xbrli:identifier scheme="s">1</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2026-09-30</xbrli:instant></xbrli:period></xbrli:context><in-capmkt:DateOfEndOfReportingPeriod contextRef="OneI">2026-09-30</in-capmkt:DateOfEndOfReportingPeriod>${facts}</xbrli:xbrl>`;
    const d = statementDetail(parseXbrl(xml), "OneI", null).bs!;
    expect(d.checks.map((c) => c.name).sort()).toEqual(["ApplicationOfFunds = its parts", "CurrentAssets = its parts", "CurrentLiabilitiesAndProvisions = its parts",
      "LinkedLiabilities = its parts", "NetCurrentAssets = its parts", "PolicyholdersFunds = its parts", "ShareholdersFunds = its parts", "SourcesOfFunds = its parts",
      "sources of funds = application of funds"]);
    expect(d.checks.filter((c) => !c.ok)).toEqual([]);
    // a wrong part fails its group
    const bad = statementDetail(parseXbrl(xml.replace(">169233800000<", ">169233000000<")), "OneI", null).bs!;
    expect(bad.checks.filter((c) => !c.ok).map((c) => c.name)).toEqual(["ShareholdersFunds = its parts"]);
    const rows = layoutStatement(BS_INSURANCE, Object.fromEntries(Object.entries(d.lines).map(([k, x]) => [`x:${k}`, x])), { hideZeros: true });
    expect(rows.find((r) => r.key === "x:PolicyLiabilities")).toMatchObject({ level: 2, value: "2698325900000" });
    expect(rows.find((r) => r.key === "x:CurrentLiabilitiesAndProvisions")).toMatchObject({ level: 2, label: "Less: Current liabilities and provisions" });
    expect(rows.some((r) => r.key === "x:InsuranceReserve")).toBe(false);
    const k = keys(BS_INSURANCE); expect(BS_LINES_INS.filter((t) => !k.includes(`x:${t}`))).toEqual([]);
    expect(chooseLayout("insurance", { gross_premium: "1" }).bs).toBe(BS_INSURANCE);
  });
  it("general insurer balance sheet (IRDAI B-BS): ICICIGI Sep 2026 adds up; its fair value change accounts are not read as funds", () => {
    const v: Record<string, string> = { ShareCapital: "4996100000", ReservesAndSurplus: "175056900000", ShareApplicationMoneyReceivedPendingAllotmentOfShares: "34300000",
      PolicyholdersFunds: "20681800000", ShareholdersFunds: "8146100000", Borrowings: "0", MinorityInterest: "0", SourcesOfFunds: "208915200000",
      InvestmentsShareholders: "169531700000", InvestmentsPolicyholders: "473785100000", Loans: "0", FixedAssets: "8624500000", DeferredTaxAsset: "1153700000",
      CashAndBankBalances: "5231100000", AdvancesAndOtherAssets: "184030000000", CurrentAssets: "189261100000", CurrentLiabilities: "507793300000",
      Provisions: "125647600000", CurrentLiabilitiesAndProvisions: "633440900000", NetCurrentAssets: "-444179800000",
      MiscellaneousExpenditureToTheExtentNotWrittenOffOrAdjusted: "0", DebitBalanceInProfitAndLossAccountShareholdersAccount: "0", ApplicationOfFunds: "208915200000",
      PaidUpEquityCapital: "4996100000", Investments: "643316800000", Assets: "208915200000" };
    const facts = Object.entries(v).map(([t, x]) => `<in-capmkt:${t} contextRef="OneI" unitRef="INR" decimals="-5">${x}</in-capmkt:${t}>`).join("");
    const xml = `<?xml version="1.0"?><xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:in-capmkt="x"><xbrli:context id="OneI"><xbrli:entity><xbrli:identifier scheme="s">1</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>2026-09-30</xbrli:instant></xbrli:period></xbrli:context><in-capmkt:DateOfEndOfReportingPeriod contextRef="OneI">2026-09-30</in-capmkt:DateOfEndOfReportingPeriod>${facts}</xbrli:xbrl>`;
    const d = statementDetail(parseXbrl(xml), "OneI", null).bs!;
    expect(d.checks.map((c) => c.name).sort()).toEqual(["ApplicationOfFunds = its parts", "CurrentAssets = its parts", "CurrentLiabilitiesAndProvisions = its parts",
      "NetCurrentAssets = its parts", "SourcesOfFunds = its parts", "sources of funds = application of funds"]);
    expect(d.checks.filter((c) => !c.ok)).toEqual([]);
    const rows = layoutStatement(BS_GENERAL_INSURANCE, Object.fromEntries(Object.entries(d.lines).map(([k, x]) => [`x:${k}`, x])), { hideZeros: true });
    expect(rows.find((r) => r.key === "x:ShareholdersFunds")).toMatchObject({ level: 1, label: "Fair value change account – shareholders' funds", value: "8146100000" });
    const k = keys(BS_GENERAL_INSURANCE); expect(BS_LINES_GI.filter((t) => !k.includes(`x:${t}`))).toEqual([]);
    expect(chooseLayout("insurance", { premium_earned: "1" }).bs).toBe(BS_GENERAL_INSURANCE);
  });
  it("labels unlabelled tags readably", () => {
    expect(tagLabel("x:TradeReceivablesCurrent")).toBe("Trade receivables current");
  });
});
