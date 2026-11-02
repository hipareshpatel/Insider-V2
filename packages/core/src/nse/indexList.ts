// Index constituent CSVs (D9) — Industry column is the sector source (D121).
import { csvRecords } from "./csv.js";

export interface IndexMemberRow { name: string; sector: string; symbol: string; series: string; isin: string }

export const indexListUrl = (file: string) => `https://nsearchives.nseindia.com/content/indices/${file}.csv`;

export function parseIndexList(text: string): IndexMemberRow[] {
  return csvRecords(text, ["Company Name", "Industry", "Symbol", "Series", "ISIN Code"]).map((r) => ({
    name: r["Company Name"]!, sector: r.Industry!, symbol: r.Symbol!, series: r.Series!, isin: r["ISIN Code"]!,
  }));
}
