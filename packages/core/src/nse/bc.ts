// PR bundle Bc file: corporate actions (§5.2, D6, D7). Purpose text varies, so parsing is tolerant;
// anything price-affecting that isn't fully understood goes to review. Nothing is guessed.
import { csvRecords } from "./csv.js";
import { nseDate } from "./dates.js";

export interface BcRow { series: string; symbol: string; name: string; recordDate: string | null; exDate: string; purpose: string }

export function parseBc(text: string): BcRow[] {
  return csvRecords(text, ["SERIES", "SYMBOL", "SECURITY", "RECORD_DT", "EX_DT", "PURPOSE"])
    .filter((r) => r.EX_DT && r.EX_DT !== "-")
    .map((r) => ({
      series: r.SERIES!, symbol: r.SYMBOL!, name: r.SECURITY!, recordDate: nseDate(r.RECORD_DT!), exDate: nseDate(r.EX_DT!)!, purpose: r.PURPOSE!.replace(/\s+/g, " ").trim(),
    }));
}

/** Bc rows repeat once per series: keep one per (symbol, ex-date, purpose) (§5.2). Equity series only. */
export function dedupeBc(rows: readonly BcRow[], series: ReadonlySet<string>): BcRow[] {
  const seen = new Map<string, BcRow>();
  for (const r of rows) {
    if (!series.has(r.series)) continue;
    const k = `${r.symbol}|${r.exDate}|${r.purpose.toUpperCase()}`;
    if (!seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

export type CaComponent =
  | { type: "split"; fromFv: string; toFv: string }          // shares × fromFv/toFv
  | { type: "consolidation"; fromFv: string; toFv: string }  // shares × fromFv/toFv (< 1)
  | { type: "bonus"; newShares: string; held: string }       // shares × (new+held)/held
  | { type: "rights"; newShares: string; held: string; premium: string }
  | { type: "dividend"; amount: string; kind: "interim" | "final" | "special" }
  | { type: "demerger" | "capital_reduction" | "merger" | "buyback" }
  | { type: "meeting" }
  | { type: "debt_service" }
  | { type: "call" };             // call money on partly paid shares: a payment, not a price adjustment     // bond/debenture interest or redemption: never price-adjusting for shares

export interface ParsedPurpose { components: CaComponent[]; unparsed: string[] }

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const SPLIT = new RegExp(String.raw`FV\s*SPLI?T\s*(?:FRM|FROM)?\s*R[SE]\.?\s*${NUM}\s*(?:\/-)?\s*TO\s*R[SE]\.?\s*${NUM}`, "i");
const CONS = new RegExp(String.raw`(?:FV\s*)?CONSOL\w*\s*(?:FRM|FROM)?\s*R[SE]\.?\s*${NUM}\s*TO\s*R[SE]\.?\s*${NUM}`, "i");
const BONUS = new RegExp(String.raw`^BONUS\s*${NUM}\s*:\s*${NUM}`, "i");
const RIGHTS = new RegExp(String.raw`RI?GHTS\s*${NUM}\s*:\s*${NUM}\s*@?\s*PRE?M\s*R[SE]\.?\s*${NUM}`, "i");
const DIV = new RegExp(String.raw`^(INT\s*DIV|INTDIV|SPL\s*DIV|SPLDIV|SPDV|SP\s*DIV|DIV|DI|DV)\s*-?\s*R[SE]\.?\s*-?\s*${NUM}`, "i");

/** Parse one Bc purpose into components, e.g. "AGM/DIV - RS 5 PER SH" -> meeting + final dividend 5. */
export function parsePurpose(purpose: string): ParsedPurpose {
  const components: CaComponent[] = [];
  const unparsed: string[] = [];
  const text = purpose.toUpperCase().replace(/\s+/g, " ").trim();

  // Whole-string patterns first: these contain '/' that must not split the text.
  let m = SPLIT.exec(text);
  if (m) {
    const [from, to] = [m[1]!, m[2]!];
    components.push(Number(from) >= Number(to) ? { type: "split", fromFv: from, toFv: to } : { type: "consolidation", fromFv: from, toFv: to });
    return { components, unparsed };
  }
  m = CONS.exec(text);
  if (m) return { components: [{ type: "consolidation", fromFv: m[1]!, toFv: m[2]! }], unparsed };
  m = RIGHTS.exec(text);
  if (m) return { components: [{ type: "rights", newShares: m[1]!, held: m[2]!, premium: m[3]! }], unparsed };
  // REIT/InvIT: "DIV/DISTRIB - RS 2", "DIV//DISTRIBU-RS 2", "DIV/DISTRBUTN - RS 2", "DIV/DISTRIB RS 2 PR UT"
  m = /^DIV\s*\/+\s*DISTR\w*\s*-?\s*R[SE]\.?\s*-?\s*(\d+(?:\.\d+)?)/.exec(text);
  if (m) return { components: [{ type: "dividend", amount: m[1]!, kind: "final" }], unparsed };
  // "DVSPDV - RS 5/RS 3", "DV/SPDV RS 5/RS 3": final + special
  m = new RegExp(String.raw`^DV\s*\/?\s*SPDV\s*-?\s*R[SE]\s*${NUM}\s*\/\s*R[SE]\s*${NUM}`).exec(text);
  if (m) return { components: [{ type: "dividend", amount: m[1]!, kind: "final" }, { type: "dividend", amount: m[2]!, kind: "special" }], unparsed };

  // Dividend-only text in any spelling ("DIV/SPDIV RS 3.5 & 1.5", "SPDV/DIVRS-5/2 PR SH", "AGM/DIV/SPDV RS5/3"):
  // only dividend words, meeting words and amounts -> dividends (never price-adjusting, D7).
  if (/(DIV|DV)/.test(text) && !/(BONUS|SPLT|SPLIT|RIGHTS|RGHTS|DEMERGER|CAPITAL|CONSOL|REDEMP|INTEREST|BUY ?BACK|MERGER|SCH|CALL|FINCAL)/.test(text)
      && /^[A-Z0-9 /&\-.,]*$/.test(text)) {
    const amounts = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => m[1]!);
    const special = /SP/.test(text), interim = /INT/.test(text);
    if (/AGM/.test(text)) components.push({ type: "meeting" });
    amounts.forEach((a, i) => components.push({ type: "dividend", amount: a, kind: special && i === amounts.length - 1 && amounts.length > 1 ? "special" : special && amounts.length === 1 ? "special" : interim ? "interim" : "final" }));
    if (amounts.length) return { components, unparsed };
    components.length = 0;
  }
  for (const raw of text.split("/").map((p) => p.trim()).filter(Boolean)) {
    const part = raw.replace(/\s*PER\s*SH(ARE)?\s*$/, "").trim();
    if (/^(AGM|EGM|ANNUAL GENERAL MEETING|EXTRAORDNRY GENRL MEETNG|EXTRA ?ORDINARY GENERAL MEETING)$/.test(part)) { components.push({ type: "meeting" }); continue; }
    if ((m = BONUS.exec(part))) { components.push({ type: "bonus", newShares: m[1]!, held: m[2]! }); continue; }
    if ((m = DIV.exec(part))) {
      const head = m[1]!.replace(/\s/g, "");
      const kind = head.startsWith("INT") ? "interim" : head.startsWith("SP") ? "special" : "final";
      components.push({ type: "dividend", amount: m[2]!, kind });
      continue;
    }
    if (/^(INTEREST PAYMENT|INTEREST|INT PAYMENT|INT PAYMN?T|INT PAY|PART REDEMPTI?O?N|REDEMPTI?O?N|PART REDEMPTN|REDEMPTN|FULL REDEMPTION|MATURITY)$/.test(part)) { components.push({ type: "debt_service" }); continue; }
    if (/^(FIRST|FST|SECOND|SECND|SCND|THIRD|FINAL|FNL)?\s*(AND\s*FINAL\s*)?(FIN)?\s*CALL?\w*\s*(MONEY)?\s*(-\s*)?(R[SE]\.?\s*[0-9.]+)?(\s*P(ER|R)\s*SH\w*)?$/.test(part) || /FINCAL|FSTFIN|SECNDFIN|FIRSTCAL|CALL MONEY/.test(part)) { components.push({ type: "call" }); continue; }
    // REIT/InvIT unit distributions (any spelling): payouts, not price-adjusting (like dividends, D7)
    if ((m = /^(?:DIV\s*\/*\s*)?DISTR?I?B?U?T?I?O?N?\w*\s*-?\s*(?:R[SE]\.?)?\s*(\d+(?:\.\d+)?)/.exec(part))) { components.push({ type: "dividend", amount: m[1]!, kind: "final" }); continue; }
    if (/^DEMERGER$/.test(part)) { components.push({ type: "demerger" }); continue; }
    if (/^MERGER$/.test(part)) { components.push({ type: "merger" }); continue; }
    if (/^BUY ?BACK$/.test(part)) { components.push({ type: "buyback" }); continue; }
    if (/^CAPITAL REDUCTION$|^CAP RED/.test(part)) { components.push({ type: "capital_reduction" }); continue; }
    unparsed.push(raw);
  }
  return { components, unparsed };
}

/** Does this purpose change the share count or price basis (so it needs an adjustment factor or review)? */
export function affectsPrice(p: ParsedPurpose): boolean {
  return p.components.some((c) => ["split", "consolidation", "bonus", "rights", "demerger", "capital_reduction"].includes(c.type));
}
