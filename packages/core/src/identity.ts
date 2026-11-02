// B1 identity & lifecycle (§5.1): symbols and ISINs are attributes with history, never keys.

export type IdType = "nse_symbol" | "isin" | "bse_code" | "name";

export interface IdentifierRow {
  securityId: number;
  idType: IdType;
  value: string;
  validFrom: string;      // YYYY-MM-DD
  validTo: string | null; // null = current
}

/** security_id that held `value` on `date`, or null. Throws if two securities claim it (data error). */
export function resolveAsOf(rows: readonly IdentifierRow[], idType: IdType, value: string, date: string): number | null {
  const hits = rows.filter(
    (r) => r.idType === idType && r.value === value && r.validFrom <= date && (r.validTo === null || date <= r.validTo),
  );
  const ids = [...new Set(hits.map((r) => r.securityId))];
  if (ids.length > 1) throw new Error(`identity: ${idType} ${value} maps to ${ids.join(",")} on ${date}`);
  return ids[0] ?? null;
}

export interface ObservedListing {
  symbol: string;
  isin: string;
  date: string;
}

export type IdentityChange =
  | { kind: "new_security"; symbol: string; isin: string; date: string }
  | { kind: "isin_change"; securityId: number; from: string; to: string; date: string }
  | { kind: "symbol_change"; securityId: number; from: string; to: string; date: string }
  | { kind: "extend_back"; securityId: number; symbol: string; isin: string; date: string }
  | { kind: "conflict"; symbol: string; isin: string; date: string; reason: string };

/** The security whose earliest record for `value` starts after `date` (seen first on a later date), or null. */
function firstSeenLater(rows: readonly IdentifierRow[], idType: IdType, value: string, date: string): number | null {
  const later = rows.filter((r) => r.idType === idType && r.value === value && r.validFrom > date).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const earlier = rows.some((r) => r.idType === idType && r.value === value && r.validFrom <= date);
  return !earlier && later[0] ? later[0].securityId : null;
}

/**
 * Compare a day's (symbol, ISIN) pairs with current identifiers and say what changed.
 * Rules: same ISIN, new symbol -> rename; same symbol, new ISIN -> ISIN change (e.g. split, seen on BAJFINANCE);
 * both new -> new security; both known but on different securities -> conflict (review, never guessed).
 */
export function diffIdentities(rows: readonly IdentifierRow[], observed: readonly ObservedListing[]): IdentityChange[] {
  const out: IdentityChange[] = [];
  for (const o of observed) {
    let bySym: number | null, byIsin: number | null;
    try {
      bySym = resolveAsOf(rows, "nse_symbol", o.symbol, o.date);
      byIsin = resolveAsOf(rows, "isin", o.isin, o.date);
    } catch (e) {
      // Our own history already has two securities on one identifier: never guess, send to review, keep the day loading.
      out.push({ kind: "conflict", symbol: o.symbol, isin: o.isin, date: o.date, reason: String(e instanceof Error ? e.message : e) });
      continue;
    }
    if (bySym === null && byIsin === null) {
      // Loading an earlier date than this security's first record (backfill / retry): same security, start earlier.
      const ls = firstSeenLater(rows, "nse_symbol", o.symbol, o.date);
      const li = firstSeenLater(rows, "isin", o.isin, o.date);
      if (ls !== null && li !== null && ls === li) out.push({ kind: "extend_back", securityId: ls, symbol: o.symbol, isin: o.isin, date: o.date });
      else if (ls !== null || li !== null) out.push({ kind: "conflict", symbol: o.symbol, isin: o.isin, date: o.date, reason: `seen later with a different pairing (symbol→${ls}, isin→${li})` });
      else out.push({ kind: "new_security", symbol: o.symbol, isin: o.isin, date: o.date });
    }
    else if (bySym !== null && byIsin !== null && bySym !== byIsin)
      out.push({ kind: "conflict", symbol: o.symbol, isin: o.isin, date: o.date, reason: `symbol→${bySym}, isin→${byIsin}` });
    else if (bySym !== null && byIsin === null) {
      const cur = currentValue(rows, bySym, "isin", o.date);
      out.push({ kind: "isin_change", securityId: bySym, from: cur ?? "", to: o.isin, date: o.date });
    } else if (byIsin !== null && bySym === null) {
      const cur = currentValue(rows, byIsin, "nse_symbol", o.date);
      out.push({ kind: "symbol_change", securityId: byIsin, from: cur ?? "", to: o.symbol, date: o.date });
    }
  }
  return out;
}

function currentValue(rows: readonly IdentifierRow[], securityId: number, idType: IdType, date: string): string | null {
  const r = rows
    .filter((x) => x.securityId === securityId && x.idType === idType && x.validFrom <= date)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  return r?.value ?? null;
}
