// security.listed_on from NSE's equity master (log #402). Nothing else writes it: securities are born from the UDiFF
// bhavcopy, which carries no listing date, so /gap-census late_start fell back to the first stored daily price (clamped
// at the 2024-01-01 floor). EQUITY_L.csv ("DATE OF LISTING") is stored in R2 by the GitHub archive prefetch (set
// "market", refreshed on every first run) at cache/content/equities/EQUITY_L.csv; this pass reads that copy, never NSE.
// One-off and repeatable (POST /maint/listed_on): rows are matched by ISIN first, else by the current NSE symbol, and
// only rows whose stored date is NULL or different are written, so a re-run writes nothing. ≈ 2,000 EQUITY_L rows:
// identifier lookups by ix_sid_lookup, current dates by primary key, updates by primary key, CHUNK rows per statement.
import { type Sql, type Stmt, batchAll, parseEquityList } from "@disclo/core";
import { r2Text } from "./structure.js";

export const EQUITY_L_KEY = "cache/content/equities/EQUITY_L.csv";
const CHUNK = 400;

/** Identifiers of the listed values of one type (ix_sid_lookup per value). ISINs: any row (an ISIN names one security
 *  for good); symbols: current rows only (a symbol can pass to another company after a delisting or a rename). */
export const SQL_IDS_BY_ISIN = "SELECT security_id, value FROM security_identifier WHERE id_type = 'isin' AND value IN (SELECT value FROM json_each(?1))";
export const SQL_IDS_BY_SYMBOL = "SELECT security_id, value FROM security_identifier WHERE id_type = 'nse_symbol' AND valid_to IS NULL AND value IN (SELECT value FROM json_each(?1))";
/** Stored listing dates of the matched securities (primary key). */
export const SQL_LISTED_CUR = "SELECT security_id, listed_on FROM security WHERE security_id IN (SELECT value FROM json_each(?1))";
/** Set the date of changed rows only (?1 = [[security_id, date], …]); the IS NOT guard keeps a re-sent row a no-op. */
export const SQL_SET_LISTED = `UPDATE security SET listed_on = (SELECT json_extract(value, '$[1]') FROM json_each(?1) WHERE json_extract(value, '$[0]') = security.security_id)
  WHERE security_id IN (SELECT json_extract(value, '$[0]') FROM json_each(?1))
    AND listed_on IS NOT (SELECT json_extract(value, '$[1]') FROM json_each(?1) WHERE json_extract(value, '$[0]') = security.security_id)`;

export type ListedOnResult = { file: string; rows: number; dated: number; matched: number; by_isin: number; by_symbol: number; unmatched: number;
  ambiguous: number; unchanged: number; changed: number; filled: number; corrected: number; unmatched_sample: string[]; done: boolean; missing?: true };

function chunks<T>(xs: T[], n = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

async function idsOf(m: Sql, sql: string, values: string[]): Promise<Map<string, Set<number>>> {
  const out = new Map<string, Set<number>>();
  for (const c of chunks(values)) {
    for (const r of await m.all<{ security_id: number; value: string }>(sql, [JSON.stringify(c)])) {
      const s = out.get(r.value) ?? new Set<number>();
      s.add(r.security_id);
      out.set(r.value, s);
    }
  }
  return out;
}

/** Fill security.listed_on from an EQUITY_L text (exported for tests; the worker passes the R2 copy). */
export async function fillListedOn(m: Sql, text: string, file = EQUITY_L_KEY): Promise<ListedOnResult> {
  const all = parseEquityList(text);
  const rows = all.filter((r) => r.listedOn);
  const isins = await idsOf(m, SQL_IDS_BY_ISIN, [...new Set(rows.map((r) => r.isin).filter(Boolean))]);
  const syms = await idsOf(m, SQL_IDS_BY_SYMBOL, [...new Set(rows.map((r) => r.symbol))]);
  // security -> date; a security named by two EQUITY_L rows with different dates is left as it is (ambiguous)
  const want = new Map<number, string>();
  const clash = new Set<number>();
  let byIsin = 0, bySymbol = 0, ambiguous = 0;
  const unmatched: string[] = [];
  for (const r of rows) {
    const a = isins.get(r.isin), b = syms.get(r.symbol);
    let sid: number | undefined;
    if (a?.size === 1) { sid = [...a][0]; byIsin++; }
    else if (!a && b?.size === 1) { sid = [...b][0]; bySymbol++; }
    else if (a || b) { ambiguous++; continue; } // one value naming several securities: never guessed
    else { unmatched.push(r.symbol); continue; }
    const prev = want.get(sid!);
    if (prev !== undefined && prev !== r.listedOn) clash.add(sid!);
    want.set(sid!, r.listedOn!);
  }
  for (const sid of clash) { want.delete(sid); ambiguous++; }
  const cur = new Map<number, string | null>();
  for (const c of chunks([...want.keys()])) {
    for (const r of await m.all<{ security_id: number; listed_on: string | null }>(SQL_LISTED_CUR, [JSON.stringify(c)])) cur.set(r.security_id, r.listed_on);
  }
  const changed = [...want].filter(([sid, d]) => cur.has(sid) && cur.get(sid) !== d);
  const filled = changed.filter(([sid]) => cur.get(sid) == null).length;
  const stmts: Stmt[] = chunks(changed).map((c) => ({ sql: SQL_SET_LISTED, params: [JSON.stringify(c)] }));
  await batchAll(m, stmts);
  return { file, rows: all.length, dated: rows.length, matched: want.size, by_isin: byIsin, by_symbol: bySymbol, unmatched: unmatched.length,
    ambiguous, unchanged: want.size - changed.length, changed: changed.length, filled, corrected: changed.length - filled,
    unmatched_sample: unmatched.slice(0, 15), done: true };
}

/** POST /maint/listed_on: the latest stored EQUITY_L from R2. */
export async function listedOnPass(m: Sql, raw: R2Bucket): Promise<ListedOnResult | { file: string; missing: true; done: false }> {
  const text = await r2Text(raw, EQUITY_L_KEY);
  if (!text) return { file: EQUITY_L_KEY, missing: true, done: false };
  return fillListedOn(m, text);
}
