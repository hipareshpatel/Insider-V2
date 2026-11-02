// EQUITY_L.csv: main-board equity master (symbol, name, series, listing date, ISIN, face value).
import { csvRecords } from "./csv.js";
import { nseDate } from "./dates.js";

export interface EquityListRow { symbol: string; name: string; series: string; listedOn: string | null; isin: string; faceValue: string }

export function parseEquityList(text: string): EquityListRow[] {
  return csvRecords(text, ["SYMBOL", "NAME OF COMPANY", "SERIES", "DATE OF LISTING", "ISIN NUMBER", "FACE VALUE"]).map((r) => ({
    symbol: r.SYMBOL!, name: r["NAME OF COMPANY"]!, series: r.SERIES!, listedOn: nseDate(r["DATE OF LISTING"]!), isin: r["ISIN NUMBER"]!, faceValue: r["FACE VALUE"]!,
  }));
}
