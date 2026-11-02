// Date helpers for file names and the session rules (D10: files at ~22:00 IST; 404 on both = no session).
export const ymd = (d: string) => d.replace(/-/g, "");
export const ddmmyy = (d: string) => `${d.slice(8, 10)}${d.slice(5, 7)}${d.slice(2, 4)}`;
export const ddmmyyyy = (d: string) => `${d.slice(8, 10)}${d.slice(5, 7)}${d.slice(0, 4)}`;

export function addDays(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** IST wall-clock "now" as YYYY-MM-DD and minutes since midnight. */
export function istNow(now: Date): { date: string; minutes: number } {
  const t = new Date(now.getTime() + 330 * 60_000);
  return { date: t.toISOString().slice(0, 10), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

/** A date's files can be expected from 22:00 IST that day (D10). */
export function eligible(date: string, now: Date): boolean {
  const n = istNow(now);
  return date < n.date || (date === n.date && n.minutes >= 22 * 60);
}

/** Two 404s are "no session" only once it's past 06:00 IST the next day (late publishing otherwise). */
export function settledNoSession(date: string, now: Date): boolean {
  const n = istNow(now);
  const next = addDays(date, 1);
  return n.date > next || (n.date === next && n.minutes >= 6 * 60);
}
