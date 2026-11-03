// D130 compact storage helpers: exact text decimals <-> integer paise; ISO dates <-> YYYYMMDD integers.
import { dec, round, toText } from "./decimal.js";

/** "1185.05" -> 118505 (exact; values with more than 2 decimals are rounded half away from zero). Blank/'-' -> null. */
export function toPaise(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const t = text.trim();
  if (t === "" || t === "-") return null;
  const d = round(dec(t), 2);
  const units = d.units * 10n ** BigInt(2 - d.scale);
  if (units > BigInt(Number.MAX_SAFE_INTEGER) || units < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`toPaise: out of range ${t}`);
  return Number(units);
}

/** 118505 -> "1185.05" (exact decimal text, trailing zeros trimmed). */
export function fromPaise(p: number | null): string | null {
  return p === null ? null : toText({ units: BigInt(p), scale: 2 }).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export const dnum = (iso: string): number => Number(iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10));
export const diso = (n: number): string => { const s = String(n); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };
