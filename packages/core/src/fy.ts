// B3 normalisers: Indian fiscal periods (D51). FY is named by the calendar year it ends in (FY27 = Apr 2026–Mar 2027).

export type PeriodKind = "Q" | "H" | "9M" | "FY";

export interface FiscalPeriod {
  fy: number;           // e.g. 2027
  kind: PeriodKind;
  n: number;            // quarter 1-4, half 1-2, 1 for 9M/FY
  label: string;        // "Q2 FY27", "H1 FY27", "9M FY27", "FY27"
}

function monthsBetween(fyEndMonth: number, month: number): number {
  // months elapsed from the FY start (month after fyEndMonth) to `month`, inclusive -> 1..12
  return ((month - fyEndMonth + 11) % 12) + 1;
}

/** Fiscal period for a period ending on `periodEnd` (YYYY-MM-DD), given the company's FY end month (3 = March). */
export function fiscalPeriod(periodEnd: string, kind: PeriodKind, fyEndMonth = 3): FiscalPeriod {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodEnd);
  if (!m) throw new Error(`fiscalPeriod: bad date ${periodEnd}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const elapsed = monthsBetween(fyEndMonth, month);
  const fy = month > fyEndMonth ? year + 1 : year;
  const yy = String(fy % 100).padStart(2, "0");
  const allowed: Record<PeriodKind, number[]> = { Q: [3, 6, 9, 12], H: [6, 12], "9M": [9], FY: [12] };
  if (!allowed[kind].includes(elapsed)) {
    throw new Error(`fiscalPeriod: ${periodEnd} is not a ${kind} end for FY ending month ${fyEndMonth}`);
  }
  if (kind === "Q") return { fy, kind, n: elapsed / 3, label: `Q${elapsed / 3} FY${yy}` };
  if (kind === "H") return { fy, kind, n: elapsed / 6, label: `H${elapsed / 6} FY${yy}` };
  return { fy, kind, n: 1, label: kind === "FY" ? `FY${yy}` : `9M FY${yy}` };
}
