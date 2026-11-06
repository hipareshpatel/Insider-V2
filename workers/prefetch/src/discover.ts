// D128: find archive-hosted XBRL attachments inside downloaded API lists.
const ARCHIVE = /https:\/\/nsearchives\.nseindia\.com\/corporate\/[^"\s\\]+?\.xml/gi;
const MON: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

function isoOf(d: unknown): string | null {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})/.exec(String(d ?? ""));
  return m ? `${m[3]}-${MON[m[2]!.toUpperCase()]}-${m[1]}` : null;
}

/** XML attachment URLs from one list. Results are limited to periods ending on/after `since` (D90: 5 years). */
export function attachments(kind: string, json: string, since: string): string[] {
  if (isResultsKind(kind)) return resultAttachments(json, since).map(([, u]) => u);
  return [...new Set(json.match(ARCHIVE) ?? [])];
}
export const isResultsKind = (kind: string) => kind === "results_quarterly" || kind === "results_annual";

/** G19: (row symbol, XML URL) pairs of a results list, same period filter as attachments(). An all-company list
 *  (symbol NULL in the ledger) names the company on each row (`symbol`, as every NSE list row does). First row wins. */
export function resultAttachments(json: string, since: string): [string, string][] {
  let rows: Record<string, unknown>[] = [];
  try { const d = JSON.parse(json); rows = Array.isArray(d) ? d : (d.data ?? []); } catch { return []; }
  const out = new Map<string, string>();
  for (const r of rows) {
    const to = isoOf(r.toDate);
    if (!to || to < since) continue;
    for (const u of JSON.stringify(r).match(ARCHIVE) ?? []) if (!out.has(u)) out.set(u, String(r.symbol ?? "").trim());
  }
  return [...out].map(([u, s]) => [s, u]);
}

/** R2 key for an attachment: att/<path after /corporate/>. */
export const attachmentKey = (url: string) => `att/${new URL(url).pathname.replace(/^\/corporate\//, "")}`;
