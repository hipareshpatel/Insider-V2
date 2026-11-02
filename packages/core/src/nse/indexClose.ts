// Index closes (D62): /content/indices/ind_close_all_{DDMMYYYY}.csv (~167 indices, OHLC, P/E, P/B, yield).
import { csvRecords } from "./csv.js";
import { nseDate } from "./dates.js";

export interface IndexCloseRow { indexName: string; tradeDate: string; open: string | null; high: string | null; low: string | null; close: string; pe: string | null; pb: string | null; divYield: string | null }

export const indexCloseUrl = (ddmmyyyy: string) => `https://nsearchives.nseindia.com/content/indices/ind_close_all_${ddmmyyyy}.csv`;

const v = (s: string | undefined) => (s === undefined || s === "" || s === "-" ? null : s.startsWith(".") ? `0${s}` : s.startsWith("-.") ? `-0${s.slice(1)}` : s);

export function parseIndexClose(text: string): IndexCloseRow[] {
  return csvRecords(text, ["Index Name", "Index Date", "Open Index Value", "High Index Value", "Low Index Value", "Closing Index Value", "P/E", "P/B", "Div Yield"]).map((r) => {
    const close = v(r["Closing Index Value"]);
    if (close === null) throw new Error(`index close: no close for ${r["Index Name"]}`);
    return {
      indexName: r["Index Name"]!, tradeDate: nseDate(r["Index Date"]!)!,
      open: v(r["Open Index Value"]), high: v(r["High Index Value"]), low: v(r["Low Index Value"]), close,
      pe: v(r["P/E"]), pb: v(r["P/B"]), divYield: v(r["Div Yield"]),
    };
  });
}
