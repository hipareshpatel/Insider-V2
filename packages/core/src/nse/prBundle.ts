// PR bundle: /archives/equities/bhavcopy/pr/PR{DDMMYY}.zip -> MCAP + Bc files (names vary in case/date format).
import { type BcRow, parseBc } from "./bc.js";
import { type McapRow, parseMcap } from "./mcap.js";
import { findEntry, readZip } from "./zip.js";

export const prBundleUrl = (ddmmyy: string) => `https://nsearchives.nseindia.com/archives/equities/bhavcopy/pr/PR${ddmmyy}.zip`;

export interface PrBundle { mcap: McapRow[] | null; bc: BcRow[] }

export async function parsePrBundle(bytes: Uint8Array): Promise<PrBundle> {
  const entries = readZip(bytes);
  const m = findEntry(entries, /^mcap\d{6,8}\.csv$/i);
  const b = findEntry(entries, /^bc\d{6,8}\.csv$/i);
  if (!b) throw new Error("pr bundle: Bc file not found");
  const dec = (x: Uint8Array) => new TextDecoder().decode(x);
  return { mcap: m ? parseMcap(dec(await m.read())) : null, bc: parseBc(dec(await b.read())) };
}
