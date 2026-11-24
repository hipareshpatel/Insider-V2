// Field catalogue §12 / §13 (log #382): results timing and filing timeliness from the stored results filings and
// board-meeting intimations, and the latest credit rating with its 12-month direction. Once per IST day, 50 companies a
// run; ≈ 4 indexed reads per company. G8 phase 2: auditor and board fields from auditor_filing, governance_fact
// ('audit_opinion'), board_member and governance_filing (4 more indexed reads per company, ≈ 100 rows).
import { type Sql, activeAt, batchAll, insertRows, isIndependent, ratingLinkVia } from "@disclo/core";

export const SQL_AUDITORS_OF = `SELECT a.period_end, a.basis, a.firm, a.firm_key, f.disclosed_at FROM auditor_filing a JOIN filing f ON f.filing_id = a.filing_id
  WHERE a.security_id = ?1 AND a.period_end >= ?2`;
export const SQL_OPINIONS_OF = `SELECT f.period_end, f.basis, f.disclosed_at, g.value FROM filing f JOIN governance_fact g ON g.filing_id = f.filing_id AND g.key = 'audit_opinion'
  WHERE f.security_id = ?1 AND f.kind IN ('results_quarterly','results_annual','integrated_financials') AND f.period_end >= ?2`;
export const SQL_BOARD_OF = "SELECT period_end, name_key, category, status, appointed_on, ceased_on FROM board_member WHERE security_id = ?1 AND period_end >= ?2";
export const SQL_GOV_FILINGS_OF = "SELECT period_end, source_kind, directors, complaints_pending FROM governance_filing WHERE security_id = ?1 AND period_end >= ?2";

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
  /** G8 phase 2: stored auditor, opinion and board rows; absent → the governance fields are not computed. */
  governance?: GovernanceInputs;
}
export interface GovernanceInputs {
  auditors: { periodEnd: string; basis: string; firm: string; firmKey: string; disclosedAt: string }[];
  opinions: { periodEnd: string; basis: string; disclosedAt: string; value: string }[];
  board: { periodEnd: string; nameKey: string; category: string | null; status: string | null; appointedOn: string | null; ceasedOn: string | null }[];
  files: { periodEnd: string; sourceKind: string; directors: number; complaintsPending: number | null }[];
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
  if (x.governance) out.push(...governanceFields(x.governance, x.today));
  return out;
}

/** G8 phase 2: auditor fields (from the results filings' AuditorsFirmName, one basis: the one with the latest period,
 *  consolidated on a tie), the latest audit opinion, and board fields (from the governance XBRL). */
export function governanceFields(g: GovernanceInputs, today: string): EventField[] {
  const out: EventField[] = [];
  // keep: the reason is stored with the value too (a caveat, e.g. the start of the stored auditor history)
  const put = (field: string, value: string | null, reason: string | null, keep = false) => out.push({ field, value, reason: value === null || keep ? reason : null });
  const yearAgo = addDays(today, -365), day = (utc: string) => isoOf(ist(utc));
  // auditors: per period of the chosen basis, the firms named and the first disclosure naming them
  const NO_AUD = "no stored results filing names its auditors (Integrated Filing results, from 2024)";
  const latestOf = (b: string) => g.auditors.filter((a) => a.basis === b).reduce((m, a) => (a.periodEnd > m ? a.periodEnd : m), "");
  const bases = [...new Set(g.auditors.map((a) => a.basis))].sort((a, b) => latestOf(b).localeCompare(latestOf(a)) || (a === "consolidated" ? -1 : b === "consolidated" ? 1 : 0));
  const per = new Map<string, { firms: Map<string, string>; at: string }>();
  for (const a of g.auditors.filter((x) => x.basis === bases[0])) {
    const p = per.get(a.periodEnd) ?? per.set(a.periodEnd, { firms: new Map(), at: a.disclosedAt }).get(a.periodEnd)!;
    if (!p.firms.has(a.firmKey)) p.firms.set(a.firmKey, a.firm);
    if (a.disclosedAt < p.at) p.at = a.disclosedAt;
  }
  const seq = [...per].sort(([a], [b]) => a.localeCompare(b));
  const last = seq[seq.length - 1];
  put("auditor_latest", last ? [...last[1].firms.values()].join("; ") : null, NO_AUD);
  if (!last) { put("auditor_change_12m", null, NO_AUD); put("auditor_tenure_since", null, NO_AUD); }
  else {
    const same = (a: Map<string, string>, b: Map<string, string>) => a.size === b.size && [...a.keys()].every((k) => b.has(k));
    let change: { at: string; incoming: string[]; outgoing: string[] } | null = null;
    for (let i = 1; i < seq.length; i++) {
      const [, p] = seq[i - 1]!, [, c] = seq[i]!;
      if (!same(p.firms, c.firms)) change = { at: day(c.at), incoming: [...c.firms].filter(([k]) => !p.firms.has(k)).map(([, v]) => v), outgoing: [...p.firms].filter(([k]) => !c.firms.has(k)).map(([, v]) => v) };
    }
    if (seq.length < 2) put("auditor_change_12m", null, `only one stored filing names its auditors (period ${last[0]})`);
    else put("auditor_change_12m", change && change.at > yearAgo
      ? `yes, ${change.at}${change.incoming.length ? `: in ${change.incoming.join("; ")}` : ""}${change.outgoing.length ? `${change.incoming.length ? ";" : ":"} out ${change.outgoing.join("; ")}` : ""}`
      : "no", null);
    // tenure: the first period of the unbroken run of filings naming every current firm
    let i = seq.length - 1;
    while (i > 0 && [...last[1].firms.keys()].every((k) => seq[i - 1]![1].firms.has(k))) i--;
    put("auditor_tenure_since", seq[i]![0], `auditor names are stored from ${seq[0]![0]}`, true);
  }
  // audit opinion: the latest audited opinion (a quarter's "not applicable" for unaudited results does not hide it)
  const ops = [...g.opinions].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || a.disclosedAt.localeCompare(b.disclosedAt));
  const op = [...ops].reverse().find((o) => o.value !== "not_applicable") ?? ops[ops.length - 1];
  put("audit_opinion_latest", op ? op.value.replace("_", " ") : null, "no audit opinion stored (results files from 2024)");
  // board: the latest governance period with directors named
  const NO_BOARD = g.files.length ? "the stored governance files name no director" : "no governance filing stored (governance XBRL, from 2024)";
  const ends = [...new Set(g.board.map((b) => b.periodEnd))].sort();
  const lastEnd = ends[ends.length - 1];
  const onBoard = lastEnd ? g.board.filter((b) => b.periodEnd === lastEnd && activeAt(b, lastEnd)) : [];
  put("board_size_latest", lastEnd ? String(onBoard.length) : null, NO_BOARD);
  const withCat = onBoard.filter((b) => b.category);
  put("independent_director_share_latest", withCat.length ? (onBoard.filter((b) => isIndependent(b.category)).length / onBoard.length * 100).toFixed(1) : null,
    lastEnd ? "director category not filed" : NO_BOARD);
  // director changes: appointment / cessation dates filed within 12 months, and names joining or leaving between
  // consecutive stored periods ending within 12 months (each director counted once per kind)
  const inYear = (d: string | null) => !!d && d > yearAgo && d <= today;
  const appointed = new Set(g.board.filter((b) => inYear(b.appointedOn)).map((b) => b.nameKey));
  const ceased = new Set(g.board.filter((b) => inYear(b.ceasedOn)).map((b) => b.nameKey));
  for (let i = 1; i < ends.length; i++) {
    if (ends[i]! <= yearAgo) continue;
    const prev = new Set(g.board.filter((b) => b.periodEnd === ends[i - 1] && activeAt(b, ends[i - 1]!)).map((b) => b.nameKey));
    const cur = new Set(g.board.filter((b) => b.periodEnd === ends[i] && activeAt(b, ends[i]!)).map((b) => b.nameKey));
    for (const k of cur) if (!prev.has(k)) appointed.add(k);
    for (const k of prev) if (!cur.has(k)) ceased.add(k);
  }
  put("director_changes_12m", lastEnd ? `${appointed.size + ceased.size} (${appointed.size} appointed, ${ceased.size} ceased)` : null, NO_BOARD);
  const cp = [...g.files].filter((f) => f.complaintsPending !== null).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd)).pop();
  put("investor_complaints_pending_latest", cp ? String(cp.complaintsPending) : null,
    g.files.length ? "investor complaints pending not filed in the stored governance files" : "no governance filing stored (governance XBRL, from 2024)");
  return out;
}

/** G8 phase 2: one company's stored auditor rows (all: the tenure needs the first), opinions over ~2 years, board and
 *  governance files over ~16 months (the latest period and the 12-month changes). */
export async function governanceInputs(filings: Sql, sid: number, day: string): Promise<GovernanceInputs> {
  const auditors = (await filings.all<{ period_end: string; basis: string; firm: string; firm_key: string; disclosed_at: string }>(SQL_AUDITORS_OF, [sid, "2000-01-01"]))
    .map((r) => ({ periodEnd: r.period_end, basis: r.basis, firm: r.firm, firmKey: r.firm_key, disclosedAt: r.disclosed_at }));
  const opinions = (await filings.all<{ period_end: string; basis: string; disclosed_at: string; value: string }>(SQL_OPINIONS_OF, [sid, addDays(day, -800)]))
    .map((r) => ({ periodEnd: r.period_end, basis: r.basis, disclosedAt: r.disclosed_at, value: r.value }));
  const board = (await filings.all<{ period_end: string; name_key: string; category: string | null; status: string | null; appointed_on: string | null; ceased_on: string | null }>(SQL_BOARD_OF, [sid, addDays(day, -500)]))
    .map((r) => ({ periodEnd: r.period_end, nameKey: r.name_key, category: r.category, status: r.status, appointedOn: r.appointed_on, ceasedOn: r.ceased_on }));
  const files = (await filings.all<{ period_end: string; source_kind: string; directors: number; complaints_pending: number | null }>(SQL_GOV_FILINGS_OF, [sid, addDays(day, -500)]))
    .map((r) => ({ periodEnd: r.period_end, sourceKind: r.source_kind, directors: r.directors, complaintsPending: r.complaints_pending }));
  return { auditors, opinions, board, files };
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
    const governance = await governanceInputs(filings, sid, day);
    for (const f of eventFields({ today: day, results, meetings, ratings, company, governance })) rows.push([sid, f.field, f.value, f.reason, day, at]);
  }
  if (rows.length) await batchAll(filings, insertRows(HEAD, 6, rows, TAIL));
  const done = todo.length < limit;
  await filings.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','event_features',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [at, JSON.stringify({ day, after: todo.length ? todo[todo.length - 1] : after, done })]);
  return { day, companies: todo.length, done };
}
