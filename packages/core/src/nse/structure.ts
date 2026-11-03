// M1 market-structure readers (D76, D144): F&O participant OI, F&O ban list, price bands (archive CSVs); bulk/block
// deals and short selling (history API, capped at 70 rows per call, and the complete daily bulk/block files);
// ASM, GSM and FII/DII snapshots (API, no history at NSE). Formats checked on 2024–2026 samples.
import { parseCsv } from "./csv.js";

const MON: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
/** "30-OCT-2026" / "02-Nov-2026" → "2026-10-30". */
export function isoFromNseDate(s: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(s.trim());
  return m && MON[m[2]!.toUpperCase()] ? `${m[3]}-${MON[m[2]!.toUpperCase()]}-${m[1]!.padStart(2, "0")}` : null;
}
/** The history API returns at most 70 rows per call (bulk.csv 87 vs API 70 on 2 Nov 2026, FMEA C30). */
export const STRUCTURE_API_CAP = 70;

export interface ParticipantOi { clientType: string; values: Record<string, number> }
/** fao_participant_oi_DDMMYYYY.csv: a title line, a header (names carry stray tabs/spaces), one row per client type. */
export function parseParticipantOi(text: string): ParticipantOi[] {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim()));
  const hi = rows.findIndex((r) => r[0]?.trim() === "Client Type");
  if (hi < 0) throw new Error("participant OI: header not found");
  const head = rows[hi]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const out: ParticipantOi[] = [];
  for (const r of rows.slice(hi + 1)) {
    const ct = r[0]?.trim();
    if (!ct) continue;
    const values: Record<string, number> = {};
    head.slice(1).forEach((h, i) => { const v = Number(String(r[i + 1] ?? "").replace(/,/g, "").trim()); if (h && Number.isFinite(v)) values[h] = v; });
    out.push({ clientType: ct, values });
  }
  if (!out.length) throw new Error("participant OI: no rows");
  return out;
}

/** fo_secban_DDMMYYYY.csv: "Securities in Ban For Trade Date 02-JAN-2024:" then "1,SYMBOL" lines (none on some days). */
export function parseFoBan(text: string): { date: string | null; symbols: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const date = lines[0] ? isoFromNseDate((/Date\s+([0-9]{1,2}-[A-Za-z]{3}-[0-9]{4})/.exec(lines[0]) ?? [])[1] ?? "") : null;
  const symbols = lines.slice(1).map((l) => /^\d+\s*,\s*([A-Z0-9&\-.]+)/i.exec(l)?.[1]?.toUpperCase()).filter((x): x is string => !!x);
  return { date, symbols };
}

export interface PriceBand { symbol: string; series: string; band: string }
/** sec_list_DDMMYYYY.csv: Symbol,Series,Security Name,Band,Remarks. Band is a % ("2", "5", "20") or "No Band". */
export function parseSecList(text: string): PriceBand[] {
  const rows = parseCsv(text);
  const h = rows[0]?.map((x) => x.trim().toLowerCase()) ?? [];
  const [is, ir, ib] = [h.indexOf("symbol"), h.indexOf("series"), h.indexOf("band")];
  if (is < 0 || ib < 0) throw new Error("price bands: header not found");
  return rows.slice(1).filter((r) => r[is]?.trim()).map((r) => ({ symbol: r[is]!.trim(), series: (r[ir] ?? "").trim(), band: (r[ib] ?? "").trim() }));
}

export interface Deal { date: string; symbol: string; client: string; side: "B" | "S"; qty: number; price: string; remarks: string }
const side = (s: string): "B" | "S" => (/^s/i.test(s.trim()) ? "S" : "B");
/** History API rows (BD_*). */
export function parseDealsApi(json: string): Deal[] {
  const d = JSON.parse(json) as { data?: Record<string, unknown>[] } | Record<string, unknown>[];
  const rows = Array.isArray(d) ? d : d.data ?? [];
  return rows.map((r) => ({ date: isoFromNseDate(String(r.BD_DT_DATE ?? "")) ?? "", symbol: String(r.BD_SYMBOL ?? "").trim(), client: String(r.BD_CLIENT_NAME ?? "").trim(),
    side: side(String(r.BD_BUY_SELL ?? "")), qty: Number(r.BD_QTY_TRD ?? 0), price: String(r.BD_TP_WATP ?? ""), remarks: String(r.BD_REMARKS ?? "").trim() }))
    .filter((x) => x.date && x.symbol);
}
/** Complete daily file bulk.csv / block.csv: Date,Symbol,Security Name,Client Name,Buy/Sell,Quantity Traded,Trade Price / Wght. Avg. Price,Remarks. */
export function parseDealsCsv(text: string): Deal[] {
  const rows = parseCsv(text);
  const h = rows[0]?.map((x) => x.trim().toLowerCase()) ?? [];
  const col = (re: RegExp) => h.findIndex((x) => re.test(x));
  const [cd, cs, cc, cb, cq, cp, cr] = [col(/^date/), col(/^symbol/), col(/^client/), col(/buy\s*\/\s*sell/), col(/^quantity/), col(/price/), col(/^remarks/)];
  if (cd < 0 || cs < 0 || cq < 0) throw new Error("deals file: header not found");
  return rows.slice(1).filter((r) => r[cs]?.trim()).map((r) => ({ date: isoFromNseDate(r[cd] ?? "") ?? "", symbol: r[cs]!.trim(), client: (r[cc] ?? "").trim(),
    side: side(r[cb] ?? ""), qty: Number(String(r[cq] ?? "").replace(/,/g, "")), price: String(r[cp] ?? "").replace(/,/g, "").trim(), remarks: (r[cr] ?? "").trim() }))
    .filter((x) => x.date);
}
/** Short selling (SS_*). */
export function parseShortApi(json: string): { date: string; symbol: string; qty: number }[] {
  const d = JSON.parse(json) as { data?: Record<string, unknown>[] };
  return (d.data ?? []).map((r) => ({ date: isoFromNseDate(String(r.SS_DATE ?? "")) ?? "", symbol: String(r.SS_SYMBOL ?? "").trim(), qty: Number(r.SS_QTY ?? 0) })).filter((x) => x.date && x.symbol);
}
/** ASM (long-term / short-term) and GSM lists: (list, symbol, stage). */
export function parseSurveillance(asmJson: string | null, gsmJson: string | null): { list: string; symbol: string; stage: string }[] {
  const out: { list: string; symbol: string; stage: string }[] = [];
  if (asmJson) {
    const a = JSON.parse(asmJson) as Record<string, { data?: Record<string, unknown>[] }>;
    for (const [k, list] of [["longterm", "asm_lt"], ["shortterm", "asm_st"]] as const)
      for (const r of a[k]?.data ?? []) out.push({ list, symbol: String(r.symbol ?? "").trim(), stage: String(r.asmSurvIndicator ?? "").trim() });
  }
  if (gsmJson) for (const r of JSON.parse(gsmJson) as Record<string, unknown>[]) out.push({ list: "gsm", symbol: String(r.symbol ?? "").trim(), stage: String(r.gsmStage ?? "").trim() });
  return out.filter((x) => x.symbol);
}
/** FII/DII cash-market flows (₹ crore, as published). */
export function parseFiiDii(json: string): { date: string; category: string; buy: string; sell: string; net: string }[] {
  return (JSON.parse(json) as Record<string, unknown>[]).map((r) => ({ date: isoFromNseDate(String(r.date ?? "")) ?? "", category: String(r.category ?? "").trim(),
    buy: String(r.buyValue ?? ""), sell: String(r.sellValue ?? ""), net: String(r.netValue ?? "") })).filter((x) => x.date && x.category);
}
