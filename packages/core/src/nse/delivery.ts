// Delivery data (D65): /products/content/sec_bhavdata_full_{DDMMYYYY}.csv
import { csvRecords } from "./csv.js";
import { nseDate } from "./dates.js";

export interface DeliveryRow { tradeDate: string; symbol: string; series: string; deliverableQty: number | null; deliveryPct: string | null }

export const deliveryUrl = (ddmmyyyy: string) => `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${ddmmyyyy}.csv`;

export function parseDelivery(text: string): DeliveryRow[] {
  return csvRecords(text, ["SYMBOL", "SERIES", "DATE1", "DELIV_QTY", "DELIV_PER"]).map((r) => {
    const q = r.DELIV_QTY!;
    const p = r.DELIV_PER!;
    if (q !== "-" && q !== "" && !/^\d+$/.test(q)) throw new Error(`delivery: bad DELIV_QTY "${q}" for ${r.SYMBOL}`);
    return {
      tradeDate: nseDate(r.DATE1!)!, symbol: r.SYMBOL!, series: r.SERIES!,
      deliverableQty: q === "-" || q === "" ? null : Number(q),
      deliveryPct: p === "-" || p === "" ? null : p,
    };
  });
}
