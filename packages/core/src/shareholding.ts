// Shareholding pattern XBRL (in-bse-shp) -> category totals, promoter encumbrance, named holders (§5.3, D28, D67).
// FMEA B3: only the three top-level categories make the total (sub-categories are read separately, never added).
// FMEA B4: a holder's name and shares are paired by the same typed-member value only.
import type { XbrlInstance } from "./xbrl.js";

const P = "in-bse-shp:";
const TOP = ["ShareholdingOfPromoterAndPromoterGroup", "PublicShareholding", "SharesHeldByNonPromoterNonPublicShareholders"] as const;
/** Sub-categories kept (read on their own; never summed into the total). */
const SUB: Record<string, string> = {
  MutualFundsOrUTI: "mutual_funds", InsuranceCompanies: "insurance", BanksMember: "banks", ProvidentFundsOrPensionFunds: "pension_funds",
  InstitutionsDomestic: "dii", InstitutionsForeign: "fii", InstitutionsForeignPortfolioInvestorCategoryOne: "fpi_cat1",
  InstitutionsForeignPortfolioInvestorCategoryTwo: "fpi_cat2", NonInstitutions: "non_institutions", EmployeeBenefitsTrusts: "employee_trusts",
  CustodianOrDRHolder: "custodian_dr", ResidentIndividualShareholdersHoldingNominalShareCapitalUpToRsTwoLakh: "retail_upto_2l",
  ResidentIndividualShareholdersHoldingNominalShareCapitalInExcessOfRsTwoLakh: "retail_above_2l", BodiesCorporate: "bodies_corporate",
  NonResidentIndians: "nri", ForeignCompanies: "foreign_companies", GovernmentsMember: "government",
};

/** filedPct = as filed, the market convention: % of shares per SCRR 1957, which excludes non-promoter-non-public holdings
 *  (ADR custodian, employee trusts) — so HDFCBANK's public = 1 (100%) is correct. Default for display.
 *  pct = shares ÷ all shares (ours), kept for checks and for comparing companies with large DR holdings. */
export interface CategoryHolding { category: string; shares: number; pct: string; filedPct: string | null }
export interface NamedHolder { group: string; name: string; shares: number; pct: string; filedPct: string | null }
export interface Shareholding {
  symbol: string | null;
  asOf: string;
  totalShares: number;
  categories: CategoryHolding[];      // promoter, public, non_promoter_non_public + sub-categories
  promoterEncumbrance: { encumbered: number | null; nonDisposal: number | null; other: number | null; pledged: number | null; pctOfPromoterHolding: string | null } ;
  namedHolders: NamedHolder[];
  checks: { name: string; ok: boolean; detail: string }[];
}

export function parseShareholding(inst: XbrlInstance): Shareholding {
  const fact = (tag: string, ctx: string) => inst.facts.find((f) => f.tag === P + tag && f.contextRef === ctx && !f.nil)?.value ?? null;
  const meta = (tag: string) => inst.facts.find((f) => f.tag === P + tag)?.value ?? null;
  const byMember = new Map<string, string>(); // category member -> instant context id
  for (const c of inst.contexts.values()) {
    const m = c.dims[P + "CategoryOfShareholdersAxis"];
    if (m && c.instant && Object.keys(c.dims).length === 1) byMember.set(m.replace(P, "").replace(/Member$/, ""), c.id);
  }
  const num = (tag: string, ctx: string | undefined) => { const v = ctx ? fact(tag, ctx) : null; return v === null ? null : Number(v); };
  const totalCtx = byMember.get("ShareholdingPattern");
  const totalShares = num("NumberOfShares", totalCtx);
  if (totalShares === null || totalShares <= 0) throw new Error("shareholding: total shares not found");
  const frac = (n: number) => (n / totalShares).toFixed(4);
  const asOf = (totalCtx && inst.contexts.get(totalCtx)?.instant) ?? meta("DateOfReport") ?? "";
  const categories: CategoryHolding[] = [];
  const names: Record<string, string> = { ShareholdingOfPromoterAndPromoterGroup: "promoter", PublicShareholding: "public", SharesHeldByNonPromoterNonPublicShareholders: "non_promoter_non_public" };
  for (const t of TOP) {
    const ctx = byMember.get(t);
    const shares = num("NumberOfShares", ctx);
    if (shares !== null) categories.push({ category: names[t]!, shares, pct: frac(shares), filedPct: ctx ? fact("ShareholdingAsAPercentageOfTotalNumberOfShares", ctx) : null });
  }
  for (const [member, key] of Object.entries(SUB)) {
    const ctx = byMember.get(member) ?? byMember.get(member.replace(/Member$/, ""));
    const shares = num("NumberOfShares", ctx);
    if (shares !== null) categories.push({ category: key, shares, pct: frac(shares), filedPct: ctx ? fact("ShareholdingAsAPercentageOfTotalNumberOfShares", ctx) : null });
  }
  const promoterCtx = byMember.get("ShareholdingOfPromoterAndPromoterGroup");
  const enc = num("NumberOfSharesEncumbered", promoterCtx), ndu = num("NumberOfSharesEncumberedUnderNonDisposalUndertaking", promoterCtx), oth = num("NumberOfSharesEncumberedUnderOtherEncumbrances", promoterCtx);
  const pledgedTag = num("NumberOfSharesPledged", promoterCtx) ?? num("NumberOfSharesEncumberedUnderPledge", promoterCtx);
  const pledged = pledgedTag ?? (enc !== null ? enc - (ndu ?? 0) - (oth ?? 0) : null);

  // Named holders: name in a duration context, shares in the instant context with the same typed member (B4).
  const namedHolders: NamedHolder[] = [];
  const key = (dims: Record<string, string>) => Object.entries(dims).map(([a, b]) => `${a}=${b}`).sort().join("|");
  const instantByKey = new Map<string, string>();
  for (const c of inst.contexts.values()) if (c.instant && Object.keys(c.dims).length && !c.dims[P + "CategoryOfShareholdersAxis"]) instantByKey.set(key(c.dims), c.id);
  for (const f of inst.facts) {
    if (f.tag !== P + "NameOfTheShareholder" || !f.value) continue;
    const c = inst.contexts.get(f.contextRef);
    if (!c) continue;
    const ic = instantByKey.get(key(c.dims));
    const shares = num("NumberOfShares", ic ?? undefined);
    if (shares === null) continue;
    const axis = Object.keys(c.dims)[0]!.replace(P, "").replace(/^Details(Of)?SharesHeldBy/, "").replace(/Axis$/, "");
    namedHolders.push({ group: axis, name: f.value, shares, pct: frac(shares), filedPct: ic ? fact("ShareholdingAsAPercentageOfTotalNumberOfShares", ic) : null });
  }

  const top = categories.filter((c) => names.ShareholdingOfPromoterAndPromoterGroup === c.category || c.category === "public" || c.category === "non_promoter_non_public");
  const sum = top.reduce((a, c) => a + c.shares, 0);
  const checks = [
    { name: "promoter + public + non-promoter-non-public = total shares", ok: sum === totalShares, detail: `${sum} vs ${totalShares}` },
    { name: "encumbered ≤ promoter shares", ok: enc === null || enc <= (top.find((c) => c.category === "promoter")?.shares ?? 0), detail: `${enc}` },
    { name: "named holders each ≤ total", ok: namedHolders.every((h) => h.shares <= totalShares), detail: `${namedHolders.length} holders` },
  ];
  return {
    symbol: meta("Symbol"), asOf, totalShares, categories,
    promoterEncumbrance: { encumbered: enc, nonDisposal: ndu, other: oth, pledged, pctOfPromoterHolding: promoterCtx ? fact("EncumberedSharesHeldAsPercentageOfTotalNumberOfShares", promoterCtx) : null },
    namedHolders, checks,
  };
}
