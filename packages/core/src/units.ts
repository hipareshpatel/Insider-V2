// B3 units: stored exact in rupees; shown in ₹ crore (D5). 1 crore = 10^7, 1 lakh = 10^5.
import { type Dec, dec, div, mul, round, toText } from "./decimal.js";

const SCALE: Record<string, string> = { rupees: "1", thousands: "1000", lakhs: "100000", crores: "10000000", millions: "1000000" };

export function toRupees(value: Dec, unit: keyof typeof SCALE): Dec {
  const f = SCALE[unit];
  if (!f) throw new Error(`units: unknown unit ${unit}`);
  return mul(value, dec(f));
}

/** ₹ crore, no decimals, Indian digit grouping (e.g. 1,23,456). */
export function formatCrore(rupees: Dec): string {
  const cr = toText(round(div(rupees, dec("10000000"), 6), 0));
  const neg = cr.startsWith("-");
  const d = neg ? cr.slice(1) : cr;
  const grouped = d.length <= 3 ? d : d.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + d.slice(-3);
  return (neg ? "-" : "") + grouped;
}
