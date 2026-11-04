// D155 (owner #316) and the owner's universe lock (4 Nov): the focus companies are the current members of the focus
// indices (Nifty 50 + Next 50 + Midcap 150 = 250). New downloads, sweeps and loads are limited to their NSE symbols
// (every symbol a focus security has had, so renamed companies keep their history). "ALL" = no limit.
import type { Sql } from "./sql.js";

export const FOCUS_DEFAULT = "NIFTY 50,NIFTY NEXT 50,NIFTY MIDCAP 150";

/** NSE symbols of the focus companies, or undefined for "ALL" or when no index snapshot exists yet (never blocks). */
export async function focusSymbolsOf(market: Sql, spec = FOCUS_DEFAULT): Promise<string[] | undefined> {
  if (spec.trim().toUpperCase() === "ALL") return undefined;
  const names = spec.split(",").map((x) => x.trim()).filter(Boolean);
  const r = await market.all<{ value: string }>(`SELECT DISTINCT i.value FROM index_membership m JOIN security_identifier i ON i.security_id = m.security_id AND i.id_type = 'nse_symbol'
    WHERE m.valid_to IS NULL AND m.index_name IN (SELECT value FROM json_each(?))`, [JSON.stringify(names)]);
  const syms = r.map((x) => x.value);
  return syms.length ? syms : undefined;
}
