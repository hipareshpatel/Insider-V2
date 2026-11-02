// Exact decimal arithmetic for money, prices and adjustment factors (no floating point in stored values).
// A Dec is an integer `units` scaled by 10^scale.

export interface Dec {
  readonly units: bigint;
  readonly scale: number;
}

export function dec(text: string | number | bigint): Dec {
  if (typeof text === "bigint") return { units: text, scale: 0 };
  const s = String(text).trim().replace(/,/g, "");
  const m = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) throw new Error(`dec: not a decimal: "${text}"`);
  const frac = m[3] ?? "";
  const units = BigInt((m[1] === "-" ? "-" : "") + ((m[2] || "0") + frac));
  return normalise({ units, scale: frac.length });
}

function normalise(d: Dec): Dec {
  let { units, scale } = d;
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale--;
  }
  return { units, scale };
}

function align(a: Dec, b: Dec): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [a.units * 10n ** BigInt(scale - a.scale), b.units * 10n ** BigInt(scale - b.scale), scale];
}

export const add = (a: Dec, b: Dec): Dec => {
  const [x, y, s] = align(a, b);
  return normalise({ units: x + y, scale: s });
};
export const sub = (a: Dec, b: Dec): Dec => {
  const [x, y, s] = align(a, b);
  return normalise({ units: x - y, scale: s });
};
export const mul = (a: Dec, b: Dec): Dec => normalise({ units: a.units * b.units, scale: a.scale + b.scale });

/** a / b rounded half-away-from-zero to `places` decimals. */
export function div(a: Dec, b: Dec, places = 12): Dec {
  if (b.units === 0n) throw new Error("dec: division by zero");
  const num = a.units * 10n ** BigInt(b.scale + places + 1);
  const den = b.units * 10n ** BigInt(a.scale);
  let q = num / den; // one extra digit
  const sign = q < 0n ? -1n : 1n;
  q = (q + sign * 5n) / 10n;
  return normalise({ units: q, scale: places });
}

export function cmp(a: Dec, b: Dec): number {
  const [x, y] = align(a, b);
  return x === y ? 0 : x < y ? -1 : 1;
}

export function round(a: Dec, places: number): Dec {
  if (a.scale <= places) return a;
  const drop = 10n ** BigInt(a.scale - places);
  const sign = a.units < 0n ? -1n : 1n;
  const q = (a.units + (sign * drop) / 2n) / drop;
  return normalise({ units: q, scale: places });
}

export function toText(a: Dec): string {
  const neg = a.units < 0n;
  const digits = (neg ? -a.units : a.units).toString().padStart(a.scale + 1, "0");
  const int = digits.slice(0, digits.length - a.scale);
  const frac = digits.slice(digits.length - a.scale);
  return (neg ? "-" : "") + int + (a.scale ? "." + frac : "");
}

/** |a/b - 1| <= tol (e.g. 0.001 for 0.1%). */
export function withinRatio(a: Dec, b: Dec, tol: Dec): boolean {
  const r = sub(div(a, b, 12), dec(1));
  const abs = r.units < 0n ? { units: -r.units, scale: r.scale } : r;
  return cmp(abs, tol) <= 0;
}
