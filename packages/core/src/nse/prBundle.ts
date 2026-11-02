// PR bundle: /archives/equities/bhavcopy/pr/PR{DDMMYY}.zip -> MCAP + Bc files (names vary in case/date format).
import { type BcRow, parseBc } from "./bc.js";
import { type McapRow, parseMcap } from "./mcap.js";
import { findEntry, readZip } from "./zip.js";

export const prBundleUrl = (ddmmyy: string) => `https://nsearchives.nseindia.com/archives/equities/bhavcopy/pr/PR${ddmmyy}.zip`;

export interface PrBundle { mcap: McapRow[] | null; bc: BcRow[]; entryNames: string[] }

export async function parsePrBundle(bytes: Uint8Array): Promise<PrBundle> {
  const entries = readZip(bytes);
  const m = findEntry(entries, /^mcap\d{6,8}\.csv$/i);
  const b = findEntry(entries, /^bc\d{6,8}\.csv$/i);
  if (!b) throw new Error("pr bundle: Bc file not found");
  const dec = (x: Uint8Array) => new TextDecoder().decode(x);
  return { mcap: m ? parseMcap(dec(await m.read())) : null, bc: parseBc(dec(await b.read())), entryNames: entries.map((e) => e.name) };
}

/** NSE sometimes serves a bundle under the wrong date (seen: PR060424.zip held 04-Jun-2024 files).
 *  True when the Bc file name (Bc/bcDDMMYY or bcDDMMYYYY) and every MCAP trade date match `date` (YYYY-MM-DD). */
export function prBundleMatchesDate(b: PrBundle, date: string): boolean {
  const ddmmyy = `${date.slice(8, 10)}${date.slice(5, 7)}${date.slice(2, 4)}`;
  const ddmmyyyy = `${date.slice(8, 10)}${date.slice(5, 7)}${date.slice(0, 4)}`;
  const bcName = b.entryNames.map((n) => n.split("/").pop() ?? n).find((n) => /^bc\d{6,8}\.csv$/i.test(n));
  if (!bcName) return false;
  const d = bcName.slice(2, -4);
  if (d !== ddmmyy && d !== ddmmyyyy) return false;
  return !b.mcap || b.mcap.every((r) => r.tradeDate === date);
}
