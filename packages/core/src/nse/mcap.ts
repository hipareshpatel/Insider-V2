// PR bundle MCAP file (D5): issue size + full market cap per security. Present from 2024-02-01.
import { csvRecords } from "./csv.js";
import { nseDate } from "./dates.js";

export interface McapRow {
  tradeDate: string;
  symbol: string;
  series: string;
  name: string;
  category: string;
  faceValue: string;
  issueSize: number;
  close: string;
  mcapRs: string;
}

export function parseMcap(text: string): McapRow[] {
  const recs = csvRecords(text, ["Trade Date", "Symbol", "Series", "Security Name", "Category", "Face Value(Rs.)", "Issue Size", "Close Price/Paid up value(Rs.)", "Market Cap(Rs.)"]);
  return recs.map((r) => {
    const issue = r["Issue Size"]!;
    if (!/^\d+$/.test(issue)) throw new Error(`mcap: bad issue size "${issue}" for ${r.Symbol}`);
    return {
      tradeDate: nseDate(r["Trade Date"]!)!,
      symbol: r.Symbol!,
      series: r.Series!,
      name: r["Security Name"]!,
      category: r.Category!,
      faceValue: r["Face Value(Rs.)"]!,
      issueSize: Number(issue),
      close: r["Close Price/Paid up value(Rs.)"]!,
      mcapRs: r["Market Cap(Rs.)"]!,
    };
  });
}
