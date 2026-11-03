// Owner #271 follow-up (D134): read the prefetched per-company NSE corporate-action lists from R2 (no NSE calls), as
// compact rows for a whole-population comparison with the Bc-derived actions. Read-only; paged by job_id.
import type { Sql } from "@disclo/core";

export async function caLists(db: Sql, getText: (k: string) => Promise<string | null>, after: number, limit: number, since = "2024-01-01") {
  const jobs = await db.all<{ job_id: number; symbol: string | null; r2_key: string }>(
    "SELECT job_id, symbol, r2_key FROM fetch_job WHERE kind='corp_actions' AND status='done' AND job_id > ? ORDER BY job_id LIMIT ?", [after, limit]);
  const M: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const iso = (s: unknown) => { const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(String(s ?? "")); return m ? `${m[3]}-${M[m[2]!]}-${m[1]}` : null; };
  const rows: [string, string, string, string, string][] = [];
  await Promise.all(jobs.map(async (j) => {
    const t = await getText(j.r2_key);
    if (!t) return;
    let d: unknown;
    try { d = JSON.parse(t); } catch { return; }
    for (const r of (Array.isArray(d) ? d : []) as Record<string, unknown>[]) {
      const ex = iso(r.exDate);
      if (ex && ex >= since) rows.push([String(r.symbol ?? j.symbol), ex, String(r.subject ?? ""), String(r.series ?? ""), String(r.isin ?? "")]);
    }
  }));
  return { rows, next: jobs.length === limit ? jobs[jobs.length - 1]!.job_id : null };
}
