// Time rules (D114): store UTC, show IST. NSE trading dates are IST calendar dates.

export const IST_OFFSET_MINUTES = 330;

/** IST calendar date (YYYY-MM-DD) for a UTC instant. */
export function istDate(instant: Date): string {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** UTC ISO string for an IST wall-clock time, e.g. ("2026-11-02", "23:31:58"). */
export function istToUtc(date: string, time = "00:00:00"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    throw new Error(`istToUtc: bad input ${date} ${time}`);
  }
  const t = time.length === 5 ? `${time}:00` : time;
  const ms = Date.parse(`${date}T${t}Z`) - IST_OFFSET_MINUTES * 60_000;
  if (Number.isNaN(ms)) throw new Error(`istToUtc: invalid date ${date} ${time}`);
  return new Date(ms).toISOString();
}
