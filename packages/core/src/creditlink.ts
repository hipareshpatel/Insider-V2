// Credit ratings → focus companies (work list 2.10, G11). NSE's credit-rating feed gives the rated instrument's ISIN and
// the rated company's name, but no usable symbol (blank, or placeholders "NOTLISTED", "NA", "000000", "222333"). A
// rating is linked, in this order (unchanged from c5d36be):
//   1. isin_issuer — the ISIN's issuer part (first 7 characters, INE062A… for SBI's shares) is that of one of a focus
//      company's own ISINs;
//   2. nse_symbol  — NSE's own Symbol field, when it is one of the focus symbols;
//   3. name        — the rated company's name equals one focus company's listed name exactly after nameKey (G11: SBI
//      bonds under INE649A / INE651A, placeholder ISINs ZZZ000Z00000 / FFF000F00000 of Hindustan Zinc and TVS Motor).
// An issuer code or a name key shared by more than one focus symbol links nothing at that step (ambiguous, with reason).
// Pure functions: the loader, the relink pass, the coverage page and the event features use the same rule.

export type RatingVia = "isin_issuer" | "name" | "nse_symbol";
export interface RatingLink { symbol: string; via: RatingVia | null; reason: string | null }
/** The focus companies' issuer codes, reduced names and symbols. */
export interface FocusIssuers { issuer: Map<string, Set<string>>; names: Map<string, Set<string>>; symbols: Set<string> }

/** An Indian ISIN's issuer part (INE040A for INE040A01034 and INE040A08…); null for a placeholder or blank ISIN. */
export const issuerOf = (isin: string | null | undefined) => (isin && /^IN[A-Z][0-9A-Z]{4}/.test(isin) ? isin.slice(0, 7) : null);

/** Company name reduced for an exact match: upper case, "&" → AND, punctuation dropped and whitespace collapsed, a
 *  leading THE dropped, LIMITED → LTD, COMPANY → CO, CORPORATION → CORP, and the trailing legal suffix (LTD, PVT,
 *  PRIVATE) dropped ("The Tata Power Company Limited" = "TATA POWER CO LTD"; "TVS Motor Company Ltd." = "TVS MOTOR CO").
 *  Equality of keys is the only test: nothing fuzzy. */
export function nameKey(name: string | null | undefined): string {
  const w = String(name ?? "").toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean)
    .map((x) => (x === "COMPANY" ? "CO" : x === "CORPORATION" ? "CORP" : x === "LIMITED" ? "LTD" : x));
  if (w[0] === "THE") w.shift();
  while (w.length && (w[w.length - 1] === "LTD" || w[w.length - 1] === "PVT" || w[w.length - 1] === "PRIVATE")) w.pop();
  return w.join(" ");
}
/** A key this short ("ITC" after reduction is 3) is too weak to link on by name alone. */
const NAME_MIN = 4;

/** From the focus companies' (symbol, ISIN, listed name) rows (SQL_FOCUS_ISSUERS). */
export function buildFocusIssuers(rows: { symbol: string; isin: string | null; name: string | null }[]): FocusIssuers {
  const fi: FocusIssuers = { issuer: new Map(), names: new Map(), symbols: new Set() };
  const add = (m: Map<string, Set<string>>, k: string, s: string) => { const x = m.get(k) ?? new Set<string>(); x.add(s); m.set(k, x); };
  for (const r of rows) {
    fi.symbols.add(r.symbol);
    const k = issuerOf(r.isin); if (k) add(fi.issuer, k, r.symbol);
    const nk = nameKey(r.name); if (nk.length >= NAME_MIN) add(fi.names, nk, r.symbol);
  }
  return fi;
}
const ambiguous = (what: string, k: string, s: Set<string>) => `ambiguous ${what}: "${k}" is shared by ${[...s].sort().join(", ")}`;

/** The focus company a rating belongs to, how the link was made, or why there is none. An issuer code or a reduced name
 *  shared by two focus symbols links nothing by that step. Without the focus map: NSE's Symbol field as given. */
export function ratingLink(c: { symbol: string; isin: string | null; company?: string | null }, fi?: FocusIssuers): RatingLink {
  if (!fi) return { symbol: c.symbol, via: null, reason: null };
  const ik = issuerOf(c.isin), byIssuer = ik ? fi.issuer.get(ik) : undefined;
  if (byIssuer?.size === 1) return { symbol: [...byIssuer][0]!, via: "isin_issuer", reason: null };
  if (fi.symbols.has(c.symbol)) return { symbol: c.symbol, via: "nse_symbol", reason: null };
  const nk = nameKey(c.company), byName = nk.length >= NAME_MIN ? fi.names.get(nk) : undefined;
  if (byName?.size === 1) return { symbol: [...byName][0]!, via: "name", reason: null };
  if (byIssuer && byIssuer.size > 1) return { symbol: "", via: null, reason: ambiguous("issuer code", ik!, byIssuer) };
  if (byName && byName.size > 1) return { symbol: "", via: null, reason: ambiguous("name", nk, byName) };
  return { symbol: "", via: null, reason: "no focus company has this ISIN's issuer code, NSE's symbol or this name" };
}

/** How a stored rating (credit_rating.isin, .company) of one company was linked, from that company's own ISINs and listed
 *  name, so a row can be labelled without a stored column. NSE's raw Symbol field is not stored (the loader writes the
 *  match into credit_rating.symbol), so a row that matched on both NSE's symbol and the name reads "name"; "nse_symbol"
 *  is left for rows matched on neither the issuer code nor the name. */
export function ratingLinkVia(r: { isin: string | null; company: string | null }, co: { isins: (string | null)[]; name: string | null }): RatingVia {
  const k = issuerOf(r.isin);
  if (k && co.isins.some((i) => issuerOf(i) === k)) return "isin_issuer";
  const nk = nameKey(r.company);
  if (nk.length >= NAME_MIN && nk === nameKey(co.name)) return "name";
  return "nse_symbol";
}
