// Daily freshness (plan item 2; D135, D138). Once per IST slot (evening 20:30, morning 07:30):
//  1. corporate actions, all companies, ex-dates today−7 … today+90 (date-range feed; verified complete: Sep 2026,
//     485 = 485 with the per-company lists) → market.corp_action_extra (second source, D138);
//  2. shareholding, all companies, today−3 … today (date-range feed, not capped) → XBRL attachments queued;
//  3. Integrated Filing (the date-range feed is capped at 20 rows): companies with a board-meeting outcome or results
//     announcement today−1 … today get a dated per-company list refresh; discover() then queues their XBRL;
//  4. Sundays (evening): the same refresh for every company (safety net; attachments first found by the sweep are
//     the trigger's misses, shown in /status).
// Every response is kept in R2 and recorded in the ledger (fetch_job: one row per URL, never fetched twice).
import { type Sql, batchAll, insertRows, sha256Hex } from "@disclo/core";
import { attachmentKey } from "./discover.js";
import { API, PER_COMPANY, companyJobs } from "./jobs.js";

const ARCHIVE = /https:\/\/nsearchives\.nseindia\.com\/corporate\/[^"\s\\]+?\.xml/gi;
const MON: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

export const istDay = (now: Date) => new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
const istMinutes = (now: Date) => { const t = new Date(now.getTime() + 330 * 60_000); return t.getUTCHours() * 60 + t.getUTCMinutes(); };
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
export const dmy = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
export const isoFromNse = (s: unknown) => { const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})/.exec(String(s ?? "")); return m && MON[m[2]!] ? `${m[3]}-${MON[m[2]!]}-${m[1]}` : null; };

const rowsOf = (text: string): Record<string, unknown>[] => { try { const d = JSON.parse(text); return Array.isArray(d) ? d : (d.data ?? []); } catch { return []; } };

/** (symbol, XBRL URL) pairs from a bulk list. */
export function rowAttachments(text: string): [string, string][] {
  const out = new Map<string, string>();
  for (const r of rowsOf(text)) for (const u of JSON.stringify(r).match(ARCHIVE) ?? []) if (!out.has(u)) out.set(u, String(r.symbol ?? ""));
  return [...out].map(([u, s]) => [s, u]);
}
/** Companies whose announcements today suggest new results (board-meeting outcome, results, Integrated Filing). */
export function resultsTriggers(text: string): string[] {
  return [...new Set(rowsOf(text).filter((r) => /outcome of board meeting|financial result|integrated filing/i.test(String(r.desc ?? ""))).map((r) => String(r.symbol ?? "")).filter(Boolean))];
}

export type Get = (url: string) => Promise<{ status: number; bytes: Uint8Array }>;
/** `focus`: NSE symbols of the 250 focus companies (owner's universe lock, 4 Nov) — new per-company calls and XBRL
 *  downloads are limited to them; undefined = everyone (no index snapshot yet, or FOCUS_INDICES=ALL). */
interface Deps { db: Sql; market: Sql; raw: R2Bucket; get: Get; gzip: (b: Uint8Array) => Promise<Uint8Array>; now: Date; focus?: string[] }
const inFocus = (d: Deps) => { const f = d.focus ? new Set(d.focus) : null; return (s: string | null | undefined) => !f || (!!s && f.has(s)); };

/** Slot due now (each runs once per IST day), or null. */
export async function dueSlot(db: Sql, now: Date): Promise<"evening" | "morning" | null> {
  const day = istDay(now), m = istMinutes(now);
  const slot = m >= 20 * 60 + 30 ? "evening" : m >= 7 * 60 + 30 ? "morning" : null;
  if (!slot) return null;
  if ((await db.all("SELECT 1 FROM daily_refresh WHERE day=? AND slot=?", [day, slot])).length) return null;
  // A slot whose API fetches failed is retried (3 Nov evening: "fetch failed" was recorded as done and never retried):
  // every 10 minutes, at most SLOT_TRIES times; the tries stay visible on /status as '<slot>:retry'.
  const [t] = await db.all<{ detail: string; at: string }>("SELECT detail, at FROM daily_refresh WHERE day=? AND slot=?", [day, `${slot}:retry`]);
  if (t) {
    const tries = Number((JSON.parse(t.detail) as { tries?: number }).tries ?? 0);
    if (tries >= SLOT_TRIES || now.getTime() - Date.parse(t.at) < 10 * 60_000) return null;
  }
  return slot;
}
export const SLOT_TRIES = 6;

/** Fetch one URL once, keep it in R2, record it in the ledger; returns the text (null if not 200). */
async function fetchKept(d: Deps, kind: string, url: string, key: string): Promise<{ text: string | null; jobId: number | null }> {
  await d.db.run("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key, discovered) VALUES (?, NULL, ?, ?, 1)", [kind, url, key]);
  const [j] = await d.db.all<{ job_id: number; status: string }>("SELECT job_id, status FROM fetch_job WHERE url=?", [url]);
  if (j?.status === "done") { const o = await d.raw.get(key); return { text: o ? await new Response(o.body.pipeThrough(new DecompressionStream("gzip"))).text() : null, jobId: j.job_id }; }
  const r = await d.get(url);
  const ok = r.status === 200 && /^\s*[[{]/.test(new TextDecoder().decode(r.bytes.subarray(0, 64))); // JSON only (V1 lesson #280)
  if (ok) await d.raw.put(key, await d.gzip(r.bytes), { httpMetadata: { contentType: "application/json" }, customMetadata: { url, fetched_at: d.now.toISOString(), enc: "gzip" } });
  await d.db.run("UPDATE fetch_job SET status=?, attempts=attempts+1, http_status=?, bytes=?, sha256=?, fetched_at=? WHERE url=?",
    [ok ? "done" : "failed", r.status, r.bytes.length, ok ? await sha256Hex(r.bytes) : null, d.now.toISOString(), url]);
  return { text: ok ? new TextDecoder().decode(r.bytes) : null, jobId: j?.job_id ?? null };
}

/** D144: queue the market-structure API history once (bulk / block / short selling, one call per weekday from 2024;
 *  the API caps at 70 rows per call). Marker by primary key (C18: no unindexed scans every minute). */
export async function seedStructureHistory(db: Sql, now: Date): Promise<number> {
  if ((await db.all("SELECT 1 FROM daily_refresh WHERE day='once' AND slot='structure_history'")).length) return 0;
  const day = istDay(now), rows: unknown[][] = [];
  for (let t = "2024-01-01"; t <= day; t = addDays(t, 1)) {
    const wd = new Date(Date.parse(t + "T00:00:00Z")).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (const k of ["bulk_deals", "block_deals", "short_selling"])
      rows.push([`hist_${k}`, null, `${API}historicalOR/bulk-block-short-deals?optionType=${k}&from=${dmy(t)}&to=${dmy(t)}`, `api/market_structure/${k}/${t}.json`, 1]);
  }
  await batchAll(db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key, discovered)", 5, rows));
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once', 'structure_history', ?, ?)", [now.toISOString(), JSON.stringify({ queued: rows.length })]);
  return rows.length;
}

/** Item 7 (data-readiness map, 5 Nov): NSE's dated per-company PIT list answers only about a year from its start date —
 *  TCS and PERSISTENT asked 2021-01-01 → 2026-11-03 both stop in early 2022 (74 and 70 rows) while the new system (C53)
 *  starts 3 May 2026, so trades between look missing for many companies. Queued once: one call per focus company per
 *  calendar quarter, 2022-Q1 → the quarter of 2 May 2026 (≈ 18 calls each). Same kind ('pit'), so the event loader
 *  reads them; rows are keyed, a trade already stored is not added twice. */
export const PIT_WINDOW_FROM = "2022-01-01", PIT_WINDOW_TO = "2026-05-02";
export function pitWindows(from = PIT_WINDOW_FROM, to = PIT_WINDOW_TO): [string, string][] {
  const out: [string, string][] = [];
  for (let y = Number(from.slice(0, 4)), q = Math.floor((Number(from.slice(5, 7)) - 1) / 3); ; q === 3 ? (y++, (q = 0)) : q++) {
    const a = `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`;
    if (a > to) break;
    const endM = q * 3 + 3, last = new Date(Date.UTC(y, endM, 0)).getUTCDate();
    const b = `${y}-${String(endM).padStart(2, "0")}-${last}`;
    out.push([a, b > to ? to : b]);
  }
  return out;
}
export async function seedPitWindows(db: Sql, now: Date, focus: string[]): Promise<number> {
  if ((await db.all("SELECT 1 FROM daily_refresh WHERE day='once' AND slot='pit_windows'")).length) return 0;
  const rows: unknown[][] = [];
  for (const s of focus) for (const [a, b] of pitWindows())
    rows.push(["pit", s, `${API}corporates-pit?index=equities&symbol=${encodeURIComponent(s)}&from_date=${dmy(a)}&to_date=${dmy(b)}`, `api/pit/${s}/${a}_${b}.json`]);
  await batchAll(db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key)", 4, rows));
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once', 'pit_windows', ?, ?)", [now.toISOString(), JSON.stringify({ queued: rows.length })]);
  return rows.length;
}

/** MCX / ABBOTINDIA (data-readiness map, 5 Nov: nothing stored at all). The per-company lists are queued once, from
 *  EQUITY_L at the very first run (seed), and their outcome is final: 'empty' is never fetched again, 'failed' only
 *  while attempts < 4, and a symbol missing from that first EQUITY_L copy was never queued. The seed queues a company's
 *  12 lists one after another, so one bad minute at NSE (a refusal streak, or a 200 with an empty body) loses the whole
 *  company. Started explicitly (POST /maint/company_lists?symbols=…), named focus companies only (≤ 12): queues every
 *  per-company list not yet in the ledger and puts the company's empty or failed ones back on the queue (same URLs;
 *  a list already fetched is never touched); runBatch fetches them, discover() then queues their XBRL. */
export const SQL_REQUEUE_LISTS = `UPDATE fetch_job SET status='todo', attempts=0, error=NULL, discovered=0
  WHERE url IN (SELECT value FROM json_each(?1)) AND +status IN ('empty','failed')`;
export async function requeueCompanyLists(db: Sql, now: Date, symbols: string[], focus: string[] | undefined): Promise<{ symbols: string[]; skipped: string[]; queued: number; requeued: number }> {
  const f = focus ? new Set(focus) : null;
  const asked = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))].slice(0, 12);
  const take = asked.filter((s) => !f || f.has(s)), skipped = asked.filter((s) => f && !f.has(s));
  const jobs = companyJobs(take, istDay(now));
  const queued = await batchAll(db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key)", 4, jobs.map((j) => [j.kind, j.symbol, j.url, j.key])));
  const r = jobs.length ? await db.run(SQL_REQUEUE_LISTS, [JSON.stringify(jobs.map((j) => j.url))]) : { changes: 0 };
  return { symbols: take, skipped, queued, requeued: r.changes };
}

/** Owner #289 / C40: several per-company lists return only the latest 20 rows (PIT, SAST, board meetings, corporate
 *  actions, governance; BRSR only 1). Queue the full history once: all-company monthly feeds where NSE supports them
 *  (SAST, board meetings, corporate actions, credit ratings; checked uncapped), and one dated call per company for PIT,
 *  governance and BRSR. Same ledger (unique URLs: nothing held is fetched again); discover() queues their XBRL. */
export async function seedFullHistory(db: Sql, now: Date): Promise<number> {
  if ((await db.all("SELECT 1 FROM daily_refresh WHERE day='once' AND slot='full_history'")).length) return 0;
  const day = istDay(now), rows: unknown[][] = [];
  for (let y = 2021, m = 1; `${y}-${String(m).padStart(2, "0")}` <= day.slice(0, 7); m === 12 ? (y++, (m = 1)) : m++) {
    const mm = String(m).padStart(2, "0"), last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `01-${mm}-${y}`, to = `${last}-${mm}-${y}`;
    for (const [kind, ep] of [["sast29", "corporate-sast-reg29"], ["board_meetings", "corporate-board-meetings"], ["corp_actions", "corporates-corporateActions"], ["credit_rating", "corporate-credit-rating"]] as const)
      rows.push([kind, null, `${API}${ep}?index=equities&from_date=${from}&to_date=${to}`, `api/${kind}/all/${y}-${mm}.json`]);
  }
  const syms = (await db.all<{ symbol: string }>("SELECT DISTINCT symbol FROM fetch_job WHERE kind='pit' AND symbol IS NOT NULL")).map((r) => r.symbol);
  const to = dmy(day);
  for (const s of syms) {
    rows.push(["pit", s, `${API}corporates-pit?index=equities&symbol=${encodeURIComponent(s)}&from_date=01-01-2021&to_date=${to}`, `api/pit/${s}/full-${day}.json`]);
    rows.push(["governance", s, `${API}corporate-governance-master?index=equities&symbol=${encodeURIComponent(s)}&from_date=01-01-2021&to_date=${to}`, `api/governance/${s}/full-${day}.json`]);
    rows.push(["brsr", s, `${API}corporate-bussiness-sustainabilitiy?index=equities&symbol=${encodeURIComponent(s)}&from_date=01-01-2021&to_date=${to}`, `api/brsr/${s}/full-${day}.json`]);
  }
  await batchAll(db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key)", 4, rows));
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once', 'full_history', ?, ?)", [now.toISOString(), JSON.stringify({ queued: rows.length })]);
  return rows.length;
}

export async function dailyRefresh(d: Deps, slot: "evening" | "morning") {
  const day = istDay(d.now), tag = `${day}-${slot}`;
  const out: Record<string, number | string> = { slot };
  // 1. Corporate actions → second source (D138).
  const ca = await fetchKept(d, "bulk_corp_actions", `${API}corporates-corporateActions?index=equities&from_date=${dmy(addDays(day, -7))}&to_date=${dmy(addDays(day, 90))}`, `api/bulk/corp_actions/${tag}.json`);
  if (ca.text) {
    const rows = rowsOf(ca.text).map((r) => [String(r.symbol ?? ""), isoFromNse(r.exDate), String(r.subject ?? ""), String(r.series ?? "EQ"), "nse_bulk"]).filter((r) => r[0] && r[1] && r[2]);
    await batchAll(d.market, insertRows("INSERT OR IGNORE INTO corp_action_extra (symbol, ex_date, purpose, series, source)", 5, rows));
    out.corp_actions = rows.length;
  } else out.corp_actions = "fetch failed";
  // 2. Shareholding → XBRL attachments.
  const sh = await fetchKept(d, "bulk_shareholding", `${API}corporate-share-holdings-master?index=equities&from_date=${dmy(addDays(day, -3))}&to_date=${dmy(day)}`, `api/bulk/shareholding/${tag}.json`);
  const ok = inFocus(d);
  if (sh.text && sh.jobId) {
    // files, not lists: born discovered=1, or the every-minute discovery query keeps re-reading them (C56)
    const att = rowAttachments(sh.text).filter(([s]) => ok(s)).map(([s, u]) => ["xbrl_shareholding", s || null, u, attachmentKey(u), sh.jobId, 1]);
    await batchAll(d.db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key, parent_id, discovered)", 6, att));
    out.shareholding_attachments = att.length;
  } else out.shareholding_attachments = "fetch failed";
  // 2b. Insider trading (C53): NSE's system since 3 May 2026 (/api/corporates-pit-gg; the old corporates-pit is empty).
  //     The list carries one XBRL link per filing; discover() queues them and the GitHub attachment job downloads them
  //     from the archive host (NSE refuses GitHub for the API host, so the list itself is fetched here).
  const pg = await fetchKept(d, "pit_gg", `${API}corporates-pit-gg?index=equities&from_date=${dmy(addDays(day, -3))}&to_date=${dmy(day)}`, `api/pit_gg/${tag}.json`);
  out.insider_list = pg.text ? (() => { try { return ((JSON.parse(pg.text!) as { data?: unknown[] }).data ?? []).length; } catch { return "unreadable"; } })() : "fetch failed";
  // The list was kept with discovered=1 (fetchKept), so discover() never queued its XBRL: no insider filing after the
  // one-off probe list was being downloaded (found 4 Nov). Queued here, like shareholding, for the focus companies.
  if (pg.text && pg.jobId) {
    const att = rowAttachments(pg.text).filter(([s]) => ok(s)).map(([s, u]) => ["xbrl_pit_gg", s || null, u, attachmentKey(u), pg.jobId, 1]);
    await batchAll(d.db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key, parent_id, discovered)", 6, att));
    out.insider_attachments = att.length;
  }
  // 2c. Frozen feeds since the one-off full history of 3 Nov (audit P1): SAST Reg 29, board meetings, credit ratings —
  //     NSE's dated all-company feeds (D149: checked uncapped), the last 3 days, one call each. The event loader reads
  //     them (same kinds as the history lists); their XBRL is queued for the focus companies only (D161).
  for (const [kind, ep] of [["sast29", "corporate-sast-reg29"], ["board_meetings", "corporate-board-meetings"], ["credit_rating", "corporate-credit-rating"]] as const) {
    const r = await fetchKept(d, kind, `${API}${ep}?index=equities&from_date=${dmy(addDays(day, -3))}&to_date=${dmy(day)}`, `api/${kind}/daily/${tag}.json`);
    if (!r.text || !r.jobId) { out[kind] = "fetch failed"; continue; }
    out[kind] = rowsOf(r.text).length;
    if (kind === "credit_rating") continue; // no XBRL attachments
    const att = rowAttachments(r.text).filter(([s]) => ok(s)).map(([s, u]) => [`xbrl_${kind}`, s || null, u, attachmentKey(u), r.jobId, 1]);
    await batchAll(d.db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key, parent_id, discovered)", 6, att));
  }
  // 3. Integrated Filing: dated per-company refresh for companies with a results-type announcement.
  const an = await fetchKept(d, "announcements_daily", `${API}corporate-announcements?index=equities&from_date=${dmy(addDays(day, -1))}&to_date=${dmy(day)}`, `api/bulk/announcements/${tag}.json`);
  const sweep = slot === "evening" && new Date(Date.parse(day + "T00:00:00Z")).getUTCDay() === 0;
  let symbols = an.text ? resultsTriggers(an.text).filter(ok) : [];
  // Sunday sweep: the focus companies (was every company that ever had a list, ~2,636 calls a week)
  if (sweep) symbols = d.focus ?? (await d.db.all<{ symbol: string }>("SELECT DISTINCT symbol FROM fetch_job WHERE kind='integrated_financials' AND symbol IS NOT NULL")).map((r) => r.symbol);
  const from = dmy(addDays(day, sweep ? -10 : -5)), to = dmy(day);
  const jobs = symbols.map((s) => ["integrated_financials", s, `${API}${PER_COMPANY.integrated_financials!(s)}&from_date=${from}&to_date=${to}`, `api/integrated_financials/${s}/${tag}${sweep ? "-sweep" : ""}.json`]);
  await batchAll(d.db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key)", 4, jobs)); // fetched by runBatch, then discover()
  out.results_refresh = jobs.length;
  if (sweep) out.sweep = 1;
  // 5. Market structure (D144). History once: bulk / block / short selling day by day from 2024 (the API caps at 70
  //    rows per call, so one call per day; days at exactly 70 are flagged at parse time). Daily: today's API lists
  //    plus ASM, GSM and FII/DII snapshots (no history exists at NSE). Archive files (participant OI, ban list,
  //    price bands, complete bulk.csv/block.csv) come from the GitHub archive job.
  if (slot === "evening") {
    for (const [k, url] of [["asm", `${API}reportASM`], ["gsm", `${API}reportGSM`], ["fii_dii", `${API}fiidiiTradeReact`]] as const)
      await fetchKept(d, `snap_${k}`, `${url}?d=${day}`, `api/market_structure/${k}/${day}.json`);
    out.snapshots = 3;
  }
  if (!an.text) out.announcements = "fetch failed";
  const failed = Object.values(out).some((v) => v === "fetch failed");
  if (failed) {
    const [t] = await d.db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day=? AND slot=?", [day, `${slot}:retry`]);
    const tries = Number((t ? (JSON.parse(t.detail) as { tries?: number }).tries : 0) ?? 0) + 1;
    await d.db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES (?, ?, ?, ?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail",
      [day, `${slot}:retry`, d.now.toISOString(), JSON.stringify({ ...out, tries })]);
    return { ...out, tries };
  }
  await d.db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES (?, ?, ?, ?)", [day, slot, d.now.toISOString(), JSON.stringify(out)]);
  return out;
}
