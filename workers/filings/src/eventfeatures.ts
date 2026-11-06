// Field catalogue §12 / §13 (log #382): results timing and filing timeliness from the stored results filings and
// board-meeting intimations, and the latest credit rating with its 12-month direction. Once per IST day, 50 companies a
// run; ≈ 4 indexed reads per company.
import { type Sql, batchAll, insertRows, ratingLinkVia } from "@disclo/core";

export const SQL_SYMBOLS_OF_SID = "SELECT DISTINCT value FROM security_identifier WHERE security_id = ?1 AND +id_type = 'nse_symbol'"; // +id_type: the planner would otherwise pick ix_sid_lookup (every NSE symbol)
export const SQL_RESULTS_FIRST = "SELECT period_end, min(disclosed_at) AS first_at FROM filing WHERE security_id = ?1 AND kind IN ('results_quarterly','results_annual','integrated_financials') AND period_end >= ?2 GROUP BY period_end";
export const SQL_MEETINGS_FROM = "SELECT meeting_d, purpose, description FROM board_meeting WHERE symbol IN (SELECT value FROM json_each(?1)) AND meeting_d >= ?2";
export const SQL_RATINGS_OF = "SELECT agency, rating, outlook, action, rated_on, isin, company FROM credit_rating WHERE symbol IN (SELECT value FROM json_each(?1)) AND rated_on IS NOT NULL ORDER BY rated_on";
/** G11: one security's listed name and ISINs, to label how its latest rating was linked (read only when it has one). */
export const SQL_LINK_OF_SID = "SELECT s.name AS name, i.value AS isin FROM security s LEFT JOIN security_identifier i ON i.security_id = s.security_id AND +i.id_type = 'isin' WHERE s.security_id = ?1";
const HEAD = "INSERT INTO event_feature (security_id, field, value, reason, as_of, computed_at)";
const TAIL = `ON CONFLICT (security_id, field) DO UPDATE SET value = excluded.value, reason = excluded.reason, as_of = excluded.as_of, computed_at = excluded.computed_at
  WHERE event_feature.value IS NOT excluded.value OR event_feature.reason IS NOT excluded.reason`;

const ist = (utc: string) => new Date(new Date(utc).getTime() + 330 * 60_000); // fields of the IST clock via getUTC*
const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
const dnumIso = (n: number) => `${String(n).slice(0, 4)}-${String(n).slice(4, 6)}-${String(n).slice(6, 8)}`;

export interface EventInputs {
  today: string; // IST date
  results: { periodEnd: string; firstAt: string }[]; // first disclosure (UTC) of each results period
  meetings: { d: number; purpose: string | null; description: string | null }[];
  ratings: { agency: string | null; rating: string | null; outlook: string | null; action: string | null; ratedOn: number; isin?: string | null; company?: string | null }[];
  /** The company's own ISINs and listed name (G11: how its latest rating was linked); absent → link not labelled. */
  company?: { isins: (string | null)[]; name: string | null };
}
export interface EventField { field: string; value: string | null; reason: string | null }

/** SEBI LODR Reg 33: quarterly results within 45 days of the quarter end; the year's audited results within 60 days. */
export function resultsDeadline(periodEnd: string): string { return addDays(periodEnd, periodEnd.slice(5, 7) === "03" ? 60 : 45); }
const isResultsMeeting = (m: { purpose: string | null; description: string | null }) =>
  /financial results/i.test(m.purpose ?? "") || /financial results/i.test(m.description ?? "");

export function eventFields(x: EventInputs): EventField[] {
  const out: EventField[] = [];
  const put = (field: string, value: string | null, reason: string) => out.push({ field, value, reason: value === null ? reason : null });
  const yearAgo = addDays(x.today, -365);
  // §13 results timing
  const rs = [...x.results].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  const last = rs[rs.length - 1];
  put("last_result_date", last ? isoOf(ist(last.firstAt)) : null, "no results filing stored");
  put("last_result_period", last ? last.periodEnd : null, "no results filing stored");
  const next = x.meetings.filter(isResultsMeeting).map((m) => dnumIso(m.d)).filter((d) => d >= x.today).sort()[0];
  put("next_result_date", next ?? null, "no board meeting for results intimated yet");
  put("days_to_next_result", next ? String(Math.round((Date.parse(next) - Date.parse(x.today)) / 86_400_000)) : null, "no board meeting for results intimated yet");
  // §12 timeliness: results first disclosed after the LODR deadline, over periods first disclosed in the last 12 months
  const recent = rs.filter((r) => isoOf(ist(r.firstAt)) > yearAgo);
  put("late_results_12m", rs.length ? String(recent.filter((r) => isoOf(ist(r.firstAt)) > resultsDeadline(r.periodEnd)).length) : null, "no results filing stored");
  if (last) { const t = ist(last.firstAt); put("results_filed_friday_late", t.getUTCDay() === 5 && t.getUTCHours() >= 17 ? "1" : "0", ""); }
  else put("results_filed_friday_late", null, "no results filing stored");
  // §12 credit rating: latest action stored, and the direction of actions in the last 12 months
  const rt = [...x.ratings].sort((a, b) => a.ratedOn - b.ratedOn);
  const lr = rt[rt.length - 1];
  put("credit_rating_latest", lr?.rating ? `${lr.rating}${lr.outlook ? ` (${lr.outlook})` : ""}, ${lr.agency ?? "agency not given"}, ${dnumIso(lr.ratedOn)}` : null,
    "no credit rating stored (many companies have no rated debt)");
  // G11: how the latest rating was matched to the company — isin_issuer (its ISIN's issuer code), name (exact reduced
  // company name: bonds under another issuer code or a placeholder ISIN) or nse_symbol (NSE's own symbol field)
  put("credit_rating_linked_by", lr?.rating && x.company ? ratingLinkVia({ isin: lr.isin ?? null, company: lr.company ?? null }, x.company) : null,
    !lr?.rating ? "no credit rating stored (many companies have no rated debt)" : "company identifiers not read");
  const yr = rt.filter((r) => dnumIso(r.ratedOn) > yearAgo), up = yr.some((r) => /upgrade/i.test(r.action ?? "")), down = yr.some((r) => /downgrade/i.test(r.action ?? ""));
  put("rating_action_12m", !rt.length ? null : !yr.length ? "none" : up && down ? "mixed" : down ? "down" : up ? "up" : "none",
    "no credit rating stored (many companies have no rated debt)");
  return out;
}

export async function eventStep(filings: Sql, market: Sql, sids: number[], now: Date, limit = 50, restart = false): Promise<{ day: string; companies: number; done: boolean }> {
  const day = isoOf(new Date(now.getTime() + 330 * 60_000));
  const [st] = restart ? [] : await filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='event_features'");
  const cur = st ? JSON.parse(st.detail) as { day: string; after: number; done: boolean } : null;
  if (cur?.day === day && cur.done) return { day, companies: 0, done: true };
  const after = cur?.day === day ? cur.after : 0;
  const todo = [...sids].sort((a, b) => a - b).filter((s) => s > after).slice(0, limit);
  const at = now.toISOString(), rows: unknown[][] = [], from = addDays(day, -400);
  for (const sid of todo) {
    const syms = JSON.stringify((await market.all<{ value: string }>(SQL_SYMBOLS_OF_SID, [sid])).map((r) => r.value));
    const results = (await filings.all<{ period_end: string; first_at: string }>(SQL_RESULTS_FIRST, [sid, from])).map((r) => ({ periodEnd: r.period_end, firstAt: r.first_at }));
    const meetings = (await filings.all<{ meeting_d: number; purpose: string | null; description: string | null }>(SQL_MEETINGS_FROM, [syms, Number(day.replace(/-/g, ""))])).map((m) => ({ d: m.meeting_d, purpose: m.purpose, description: m.description }));
    const ratings = (await filings.all<{ agency: string | null; rating: string | null; outlook: string | null; action: string | null; rated_on: number; isin: string | null; company: string | null }>(SQL_RATINGS_OF, [syms]))
      .map((r) => ({ agency: r.agency, rating: r.rating, outlook: r.outlook, action: r.action, ratedOn: r.rated_on, isin: r.isin, company: r.company }));
    const ids = ratings.length ? await market.all<{ name: string | null; isin: string | null }>(SQL_LINK_OF_SID, [sid]) : [];
    const company = ids.length ? { name: ids[0]!.name, isins: ids.map((r) => r.isin) } : undefined;
    for (const f of eventFields({ today: day, results, meetings, ratings, company })) rows.push([sid, f.field, f.value, f.reason, day, at]);
  }
  if (rows.length) await batchAll(filings, insertRows(HEAD, 6, rows, TAIL));
  const done = todo.length < limit;
  await filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','event_features',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [at, JSON.stringify({ day, after: todo.length ? todo[todo.length - 1] : after, done })]);
  return { day, companies: todo.length, done };
}
