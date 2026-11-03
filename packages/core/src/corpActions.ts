// Corporate-action factors (D6) and adjusted prices (§5.2). Factor = multiply prices BEFORE ex_date by this.
// Split/bonus: share-count ratio from MCAP, must match the Bc text within 0.1%. Before 2024-02-01: Bc ratio only.
// Rights: TERP. Demerger / capital reduction: price-ratio estimate, always reviewed. Dividends: not adjusted (D7).
import { type Dec, cmp, dec, div, mul, add, toText, withinRatio } from "./decimal.js";
import type { CaComponent } from "./nse/bc.js";

export type FactorMethod = "share_ratio" | "bc_ratio" | "terp" | "price_ratio";

export interface FactorDecision {
  factor: string | null;             // text decimal, null when nothing can be computed
  method: FactorMethod | null;
  status: "auto" | "review";
  reason: string;
}

/** Share multiplier implied by the Bc text (split × bonus), or null if the components don't determine one. */
export function bcShareMultiplier(components: readonly CaComponent[]): Dec | null {
  let m: Dec = dec(1);
  let any = false;
  for (const c of components) {
    if (c.type === "split" || c.type === "consolidation") { m = mul(m, div(dec(c.fromFv), dec(c.toFv), 12)); any = true; }
    else if (c.type === "bonus") { m = mul(m, div(add(dec(c.newShares), dec(c.held)), dec(c.held), 12)); any = true; }
  }
  return any ? m : null;
}

export interface FactorInputs {
  exDate: string;
  components: CaComponent[];        // all price-affecting components for this security on this ex-date
  sharesBefore: number | null;       // issue size on the previous session
  sharesOnEx: number | null;         // issue size on the ex-date
  prevClose: string | null;          // unadjusted close on the previous session
  faceValue: string | null;          // face value before the action (for rights issue price)
  openOnEx?: string | null;          // for price-ratio estimates
}

export function decideFactor(i: FactorInputs): FactorDecision {
  const types = new Set(i.components.map((c) => c.type));
  if (types.has("demerger") || types.has("capital_reduction")) {
    const est = i.prevClose && i.openOnEx ? toText(div(dec(i.openOnEx), dec(i.prevClose), 8)) : null;
    return { factor: est, method: est ? "price_ratio" : null, status: "review", reason: "demerger/capital reduction: price-ratio estimate, always reviewed (D6)" };
  }
  const rights = i.components.find((c) => c.type === "rights");
  if (rights && rights.type === "rights") {
    if (types.size > 1) return { factor: null, method: null, status: "review", reason: "rights combined with another action" };
    if (!i.prevClose || !i.faceValue) return { factor: null, method: null, status: "review", reason: "rights: previous close or face value missing" };
    const p = dec(i.prevClose);
    const issue = add(dec(i.faceValue), dec(rights.premium));
    const held = dec(rights.held);
    const nw = dec(rights.newShares);
    if (cmp(issue, p) >= 0) return { factor: "1", method: "terp", status: "auto", reason: "rights priced at or above market: no adjustment" };
    const terp = div(add(mul(p, held), mul(issue, nw)), add(held, nw), 12);
    return { factor: toText(div(terp, p, 10)), method: "terp", status: "auto", reason: "TERP" };
  }
  const bc = bcShareMultiplier(i.components);
  if (!bc) return { factor: null, method: null, status: "review", reason: "no share multiplier in Bc text" };
  if (i.exDate >= "2024-02-01" && (i.sharesBefore === null || i.sharesOnEx === null) && i.prevClose && i.openOnEx) {
    // No share counts (e.g. first day in MCAP): accept the Bc ratio only if the price move agrees within 5%.
    const priceRatio = div(dec(i.prevClose), dec(i.openOnEx), 8);
    if (withinRatio(priceRatio, bc, dec("0.05"))) return { factor: toText(div(dec(1), bc, 10)), method: "bc_ratio", status: "auto", reason: `share counts missing; Bc ${toText(bc)} matches price move ${toText(priceRatio)} within 5%` };
  }
  if (i.exDate < "2024-02-01" || i.sharesBefore === null || i.sharesOnEx === null) {
    return { factor: toText(div(dec(1), bc, 10)), method: "bc_ratio", status: i.exDate < "2024-02-01" ? "auto" : "review", reason: i.exDate < "2024-02-01" ? "before MCAP history: Bc ratio (D6)" : "share counts missing: Bc ratio, review" };
  }
  const shareRatio = div(dec(i.sharesOnEx), dec(i.sharesBefore), 12);
  if (withinRatio(shareRatio, bc, dec("0.001"))) {
    return { factor: toText(div(dec(1), shareRatio, 10)), method: "share_ratio", status: "auto", reason: `share ratio ${toText(shareRatio)} matches Bc ${toText(bc)}` };
  }
  return { factor: toText(div(dec(1), bc, 10)), method: "bc_ratio", status: "review", reason: `share ratio ${toText(shareRatio)} differs from Bc ${toText(bc)} by > 0.1%` };
}

export interface FactorRow { exDate: string; factor: string }

/** Adjusted price on `date` = raw × product of factors with ex_date after `date` (computed, never stored).
 *  Callers pass only factors with status 'auto' or 'confirmed'; 'review' factors are proposals, never applied. */
export function adjustPrice(raw: string, date: string, factors: readonly FactorRow[], places = 2): string {
  let p = dec(raw);
  for (const f of factors) if (f.exDate > date) p = mul(p, dec(f.factor));
  return toText(roundTo(p, places));
}

function roundTo(d: Dec, places: number): Dec {
  return div(d, dec(1), places);
}
