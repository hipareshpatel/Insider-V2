// NSE date formats seen in files: 2026-10-30, 16/06/2025, 13 JUN 2025, 06-OCT-2008, 30-Oct-2026.
const MON: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

/** Any NSE date text -> YYYY-MM-DD, or null for blank / '-'. Throws on anything else (never guessed). */
export function nseDate(text: string): string | null {
  const t = text.trim();
  if (t === "" || t === "-") return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return valid(`${m[1]}-${m[2]}-${m[3]}`, text);
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return valid(`${m[3]}-${m[2]}-${m[1]}`, text);
  m = /^(\d{1,2})[ -]([A-Za-z]{3})[ -](\d{4})$/.exec(t);
  if (m) {
    const mon = MON[m[2]!.toUpperCase()];
    if (mon) return valid(`${m[3]}-${mon}-${m[1]!.padStart(2, "0")}`, text);
  }
  throw new Error(`nseDate: unknown date format "${text}"`);
}

function valid(iso: string, raw: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) throw new Error(`nseDate: invalid date "${raw}"`);
  return iso;
}
