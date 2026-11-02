// UDiFF CM bhavcopy (D3): /content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip, from 2024-01-01.
import { csvRecords } from "./csv.js";
import { nseDate } from "./dates.js";
import { findEntry, readZip } from "./zip.js";

export interface BhavRow {
  tradeDate: string;
  symbol: string;
  series: string;
  isin: string;
  name: string;
  open: string; high: string; low: string; close: string; last: string; prevClose: string;
  volume: number;
  turnoverRs: string;
  trades: number | null;
}

export const udiffUrl = (yyyymmdd: string) =>
  `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${yyyymmdd}_F_0000.csv.zip`;

const REQUIRED = ["TradDt", "Sgmt", "FinInstrmTp", "ISIN", "TckrSymb", "SctySrs", "FinInstrmNm", "OpnPric", "HghPric", "LwPric", "ClsPric", "LastPric", "PrvsClsgPric", "TtlTradgVol", "TtlTrfVal", "TtlNbOfTxsExctd"];

export function parseUdiffCsv(text: string): BhavRow[] {
  return csvRecords(text, REQUIRED)
    .filter((r) => r.Sgmt === "CM" && r.FinInstrmTp === "STK")
    .map((r) => ({
      tradeDate: nseDate(r.TradDt!)!,
      symbol: r.TckrSymb!,
      series: r.SctySrs!,
      isin: r.ISIN!,
      name: r.FinInstrmNm!,
      open: r.OpnPric!, high: r.HghPric!, low: r.LwPric!, close: r.ClsPric!, last: r.LastPric!, prevClose: r.PrvsClsgPric!,
      volume: int(r.TtlTradgVol!, "TtlTradgVol"),
      turnoverRs: r.TtlTrfVal!,
      trades: r.TtlNbOfTxsExctd ? int(r.TtlNbOfTxsExctd, "TtlNbOfTxsExctd") : null,
    }));
}

export async function parseUdiffZip(bytes: Uint8Array): Promise<BhavRow[]> {
  const e = findEntry(readZip(bytes), /^BhavCopy_NSE_CM_.*\.csv$/i);
  if (!e) throw new Error("udiff: csv not found in zip");
  return parseUdiffCsv(new TextDecoder().decode(await e.read()));
}

function int(t: string, col: string): number {
  if (!/^\d+$/.test(t)) throw new Error(`udiff: ${col} not an integer: "${t}"`);
  return Number(t);
}

/** Equity series in the coverage universe (D111). */
export const EQUITY_SERIES = new Set(["EQ", "BE", "BZ"]);
