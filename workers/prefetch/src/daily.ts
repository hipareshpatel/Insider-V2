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
import { API, PER_COMPANY } from "./jobs.js";

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
interface Deps { db: Sql; market: Sql; raw: R2Bucket; get: Get; gzip: (b: Uint8Array) => Promise<Uint8Array>; now: Date }

/** Slot due now (each runs once per IST day), or null. */
export async function dueSlot(db: Sql, now: Date): Promise<"evening" | "morning" | null> {
  const day = istDay(now), m = istMinutes(now);
  const slot = m >= 20 * 60 + 30 ? "evening" : m >= 7 * 60 + 30 ? "morning" : null;
  if (!slot) return null;
  return (await db.all("SELECT 1 FROM daily_refresh WHERE day=? AND slot=?", [day, slot])).length ? null : slot;
}

/** Fetch one URL once, keep it in R2, record it in the ledger; returns the text (null if not 200). */
async function fetchKept(d: Deps, kind: string, url: string, key: string): Promise<{ text: string | null; jobId: number | null }> {
  await d.db.run("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key, discovered) VALUES (?, NULL, ?, ?, 1)", [kind, url, key]);
  const [j] = await d.db.all<{ job_id: number; status: string }>("SELECT job_id, status FROM fetch_job WHERE url=?", [url]);
  if (j?.status === "done") { const o = await d.raw.get(key); return { text: o ? await new Response(o.body.pipeThrough(new DecompressionStream("gzip"))).text() : null, jobId: j.job_id }; }
  const r = await d.get(url);
  const ok = r.status === 200;
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
  if (sh.text && sh.jobId) {
    const att = rowAttachments(sh.text).map(([s, u]) => ["xbrl_shareholding", s || null, u, attachmentKey(u), sh.jobId]);
    await batchAll(d.db, insertRows("INSERT OR IGNORE INTO fetch_job (kind, symbol, url, r2_key, parent_id)", 5, att));
    out.shareholding_attachments = att.length;
  } else out.shareholding_attachments = "fetch failed";
  // 3. Integrated Filing: dated per-company refresh for companies with a results-type announcement.
  const an = await fetchKept(d, "announcements_daily", `${API}corporate-announcements?index=equities&from_date=${dmy(addDays(day, -1))}&to_date=${dmy(day)}`, `api/bulk/announcements/${tag}.json`);
  const sweep = slot === "evening" && new Date(Date.parse(day + "T00:00:00Z")).getUTCDay() === 0;
  let symbols = an.text ? resultsTriggers(an.text) : [];
  if (sweep) symbols = (await d.db.all<{ symbol: string }>("SELECT DISTINCT symbol FROM fetch_job WHERE kind='integrated_financials' AND symbol IS NOT NULL")).map((r) => r.symbol);
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
  await d.db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES (?, ?, ?, ?)", [day, slot, d.now.toISOString(), JSON.stringify(out)]);
  return out;
}
