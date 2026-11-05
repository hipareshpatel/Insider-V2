// M2 event loader (owner #289): reads the downloaded NSE lists (R2) for insider trades, SAST, board meetings and credit
// ratings into their tables. Walks the ledger by a (kind, job_id) cursor over ix_fetch_kind_job (P0, 4 Nov: the former
// "+kind" form scanned the whole table tail from the cursor on every run, since no new event list sits there) and stops at a
// list that is not downloaded yet, so nothing is skipped. Rows are keyed; INSERT OR IGNORE makes re-reads harmless.
import { type Sql, batchAll, byKindAfter, markFresh, insertRows, parseBoardMeetings, parseCreditRatings, parsePit, parsePitXbrl, parseSast, parseXbrl } from "@disclo/core";

/** Newest of a set of ISO timestamps (null when none). */
const newestOf = (xs: (string | null | undefined)[]) => xs.reduce<string | null>((a, x) => (x && (!a || x > a) ? x : a), null);
const dnum = (iso: string | null) => (iso ? Number(iso.replace(/-/g, "")) : null);
const KINDS = ["pit", "sast29", "board_meetings", "credit_rating"];
export const SQL_EVENTS_NEXT = "SELECT job_id, kind, r2_key, status, attempts FROM fetch_job WHERE kind = ? AND job_id > ? ORDER BY job_id LIMIT ?";

/** Audit P1: a file that cannot be read is recorded in event_load (it was: 0 rows, cursor moved on, nothing kept); a
 *  storage error is temporary — the cursor waits at that file (retried next run) and records it after 3 runs. */
export class BadFile extends Error {}
const parsed = <T>(f: () => T): T => { try { return f(); } catch (e) { throw new BadFile(String(e).slice(0, 200)); } };
async function recordFailure(db: Sql, jobId: number, kind: string, detail: string) {
  await db.run("INSERT INTO event_load (job_id, kind, status, detail, at) VALUES (?,?, 'failed', ?, ?) ON CONFLICT (job_id) DO UPDATE SET detail=excluded.detail, at=excluded.at", [jobId, kind, detail.slice(0, 300), new Date().toISOString()]);
}
export interface EventOpts { focus?: string[]; deadline?: number; issuers?: Map<string, string> }

/** Item 7 (2.10): NSE's credit-rating feed carries no symbol (all 40,900 stored rows: Symbol null) and the rated
 *  instrument's ISIN, not the share's. An Indian ISIN's first 7 characters name the issuer (INE040A… = HDFC Bank for
 *  its shares INE040A01034 and its bonds INE040A08…), so a rating is the focus company's when its ISIN's issuer part is
 *  that of one of the company's own ISINs. */
export const issuerOf = (isin: string | null | undefined) => (isin && /^IN[A-Z][0-9A-Z]{4}/.test(isin) ? isin.slice(0, 7) : null);
export const SQL_FOCUS_ISSUERS = `SELECT n.value AS symbol, i.value AS isin FROM security_identifier n
  JOIN security_identifier i ON i.security_id = n.security_id AND i.id_type = 'isin'
  WHERE n.id_type = 'nse_symbol' AND n.value IN (SELECT value FROM json_each(?1))`;
export async function focusIssuers(market: Sql, focus: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (const r of await market.all<{ symbol: string; isin: string }>(SQL_FOCUS_ISSUERS, [JSON.stringify(focus)])) { const k = issuerOf(r.isin); if (k && !m.has(k)) m.set(k, r.symbol); }
  return m;
}
/** The symbol a rating belongs to. The issuer code decides; NSE's own Symbol field counts only when it is one of the
 *  focus companies' symbols — it often holds "NOTLISTED", "NA", "Not Listed", "000000" or "222333" even for listed
 *  issuers (L&T INE018A08BJ8 "NOTLISTED", Reliance INE002A08690 "NA"). Without an issuer map: NSE's field as given. */
export function ratingSymbol(c: { symbol: string; isin: string }, issuers?: Map<string, string>): string {
  if (!issuers) return c.symbol;
  const m = issuers.get(issuerOf(c.isin) ?? "");
  if (m) return m;
  for (const v of issuers.values()) if (v === c.symbol) return c.symbol;
  return "";
}
type Cursor = { after: number; rows: number; stuck?: number; tries?: number; failed?: number };
/** Read one stored file: text, null when it is not in R2, or "wait" on a storage error (≤ 3 runs, then recorded). */
async function readOrWait(db: Sql, cur: Cursor, j: { job_id: number; r2_key: string }, kind: string, getText: (k: string) => Promise<string | null>): Promise<string | null | "wait"> {
  try { return await getText(j.r2_key); } catch (e) {
    cur.tries = cur.stuck === j.job_id ? (cur.tries ?? 0) + 1 : 1; cur.stuck = j.job_id;
    if (cur.tries < 3) return "wait";
    await recordFailure(db, j.job_id, kind, `storage read error (3 runs): ${String(e).slice(0, 150)}`);
    cur.failed = (cur.failed ?? 0) + 1;
    return null;
  }
}

export async function loadEvents(db: Sql, getText: (k: string) => Promise<string | null>, limit = 60, opts: EventOpts = {}): Promise<{ lists: number; rows: number; after: number }> {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='events_cursor'");
  const cur: Cursor = st ? JSON.parse(st.detail) as Cursor : { after: 0, rows: 0 };
  const jobs = await byKindAfter<{ job_id: number; kind: string; r2_key: string; status: string; attempts: number }>(db, SQL_EVENTS_NEXT, KINDS, cur.after, limit);
  const focus = opts.focus ? new Set(opts.focus) : null;
  const keep = (sym: unknown) => !focus || focus.has(String(sym ?? ""));
  let lists = 0;
  for (const j of jobs) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    const terminal = j.status === "done" || j.status === "empty" || (j.status === "failed" && j.attempts >= 4);
    if (!terminal) break; // not downloaded yet: wait here, never skip
    if (j.status === "done") {
      const t = await readOrWait(db, cur, j, j.kind, getText);
      if (t === "wait") break;
      if (t === null && cur.stuck !== j.job_id) { await recordFailure(db, j.job_id, j.kind, "file not in R2"); cur.failed = (cur.failed ?? 0) + 1; }
      if (t) {
        try { cur.rows += await write(db, j.kind, t, j.job_id, keep, opts.issuers); } catch (e) {
          if (!(e instanceof BadFile)) throw e; // a D1 error stops the run here; the cursor has not moved past this list
          await recordFailure(db, j.job_id, j.kind, `unreadable list: ${e.message}`); cur.failed = (cur.failed ?? 0) + 1;
        }
      }
    }
    cur.after = j.job_id; delete cur.stuck; delete cur.tries; lists++;
  }
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','events_cursor',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  return { lists, rows: cur.rows, after: cur.after };
}

/** Rows of one list (D161: focus companies only, `keep`); a parse failure is a BadFile, a D1 failure is not. */
async function write(db: Sql, kind: string, json: string, jobId: number, keep: (sym: unknown) => boolean = () => true, issuers?: Map<string, string>): Promise<number> {
  if (kind === "pit") {
    const r = parsed(() => parsePit(json)).filter((t) => keep(t.symbol)).map((t) => [t.key, t.symbol, t.person, t.category, t.secType, t.txn, t.mode, t.qty, t.valueRs, t.beforeQty, t.afterQty, t.beforePct, t.afterPct, dnum(t.fromDate), dnum(t.toDate), dnum(t.intimated), t.disclosedAt, t.did, t.pid, t.exchange, t.derivative, jobId]);
    await batchAll(db, insertRows("INSERT OR IGNORE INTO insider_trade (key,symbol,person,category,sec_type,txn,mode,qty,value_rs,before_qty,after_qty,before_pct,after_pct,from_d,to_d,intimated,disclosed_at,did,pid,exchange,derivative,job_id)", 22, r));
    return r.length;
  }
  if (kind === "sast29") {
    const objs = parsed(() => parseSast(json)).filter((t) => keep(t.symbol));
    await markFresh(db, "sast29", newestOf(objs.map((o) => o.disclosedAt)), objs.length);
    const r = objs.map((s) => [s.key, s.symbol, s.acquirer, s.promoter === null ? null : s.promoter ? 1 : 0, s.regType, s.action, s.mode, s.secType, s.sharesAcq, s.sharesSale, s.sharesAfter, s.pctAcq, s.pctSale, s.pctAfter, s.period, s.disclosedAt, jobId]);
    await batchAll(db, insertRows("INSERT OR IGNORE INTO sast_disclosure (key,symbol,acquirer,promoter,reg_type,action,mode,sec_type,shares_acq,shares_sale,shares_after,pct_acq,pct_sale,pct_after,period,disclosed_at,job_id)", 17, r));
    return r.length;
  }
  if (kind === "board_meetings") {
    const objs = parsed(() => parseBoardMeetings(json)).filter((t) => keep(t.symbol));
    await markFresh(db, "board_meetings", newestOf(objs.map((o) => o.announcedAt)), objs.length);
    const r = objs.map((b) => [b.key, b.symbol, dnum(b.meetingDate), b.purpose, b.description, b.intimation, b.announcedAt, b.xbrl, jobId]);
    await batchAll(db, insertRows("INSERT OR IGNORE INTO board_meeting (key,symbol,meeting_d,purpose,description,intimation,announced_at,xbrl,job_id)", 9, r));
    return r.length;
  }
  const objs = parsed(() => parseCreditRatings(json)).map((t) => ({ ...t, symbol: ratingSymbol(t, issuers) })).filter((t) => keep(t.symbol));
  await markFresh(db, "credit_rating", newestOf(objs.map((o) => o.disclosedAt)), objs.length);
  const r = objs.map((c) => [c.key, c.symbol, c.company, c.isin, c.agency, c.rating, c.outlook, c.action, dnum(c.ratedOn), c.earlierRating, c.earlierOutlook, c.disclosedAt, c.appId, jobId]);
  await batchAll(db, insertRows("INSERT OR IGNORE INTO credit_rating (key,symbol,company,isin,agency,rating,outlook,action,rated_on,earlier_rating,earlier_outlook,disclosed_at,app_id,job_id)", 14, r));
  return r.length;
}

/** C53: insider trades from NSE's system since 3 May 2026 — one XBRL per filing (kind xbrl_pit_gg*), linked from the
 *  pit-gg lists that give its broadcast time, filing number (appId) and the filing it revises (prevAppId). Walks the
 *  ledger by job_id and waits at a file not downloaded yet (C47); a revision replaces the rows of the filing it revises. */
const PITX = ["xbrl_pit_gg", "xbrl_pit_gg_probe"];
export const SQL_PITX_NEXT = `SELECT j.job_id, j.url, j.r2_key, j.status, j.attempts, j.http_status, p.r2_key AS parent_key FROM fetch_job j LEFT JOIN fetch_job p ON p.job_id = j.parent_id
     WHERE j.kind = ? AND j.job_id > ? ORDER BY j.job_id LIMIT ?`;
export async function loadPitXbrl(db: Sql, getText: (k: string) => Promise<string | null>, limit = 150, opts: EventOpts = {}): Promise<{ files: number; rows: number; after: number; waiting: boolean }> {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='pitx_cursor'");
  const cur: Cursor = st ? JSON.parse(st.detail) as Cursor : { after: 0, rows: 0 };
  const jobs = await byKindAfter<{ job_id: number; kind: string; url: string; r2_key: string; status: string; attempts: number; http_status: number | null; parent_key: string | null }>(db, SQL_PITX_NEXT, PITX, cur.after, limit);
  const focus = opts.focus ? new Set(opts.focus) : null;
  const lists = new Map<string, Record<string, unknown>[] | null>();
  let files = 0, waiting = false;
  const fail = async (j: { job_id: number }, why: string) => { await recordFailure(db, j.job_id, "xbrl_pit_gg", why); cur.failed = (cur.failed ?? 0) + 1; };
  for (const j of jobs) {
    if (opts.deadline && Date.now() > opts.deadline) break;
    const terminal = j.status === "done" || j.status === "empty" || (j.status === "failed" && (j.attempts >= 3 || j.http_status === 404));
    if (!terminal) { waiting = true; break; }
    if (j.status === "done" && !j.parent_key) await fail(j, "no parent list (broadcast time and filing number unknown)");
    if (j.status === "done" && j.parent_key) {
      if (!lists.has(j.parent_key)) {
        const t = await readOrWait(db, cur, { job_id: j.job_id, r2_key: j.parent_key }, "xbrl_pit_gg", getText);
        if (t === "wait") { waiting = true; break; }
        let rows: Record<string, unknown>[] | null = null;
        if (t) try { const d = JSON.parse(t) as unknown; rows = Array.isArray(d) ? d as Record<string, unknown>[] : ((d as { data?: Record<string, unknown>[] } | null)?.data ?? []); } catch { rows = null; }
        lists.set(j.parent_key, rows);
      }
      const listRows = lists.get(j.parent_key)!;
      const row = listRows?.find((r) => r.xmlFileName === j.url);
      if (!listRows) await fail(j, "parent list unreadable or not in R2");
      else if (!row) await fail(j, "file not found in its parent list");
      else if (focus && !focus.has(String(row.symbol ?? ""))) { /* outside the focus companies (D161): not loaded, not a failure */ }
      else {
        const xml = await readOrWait(db, cur, j, "xbrl_pit_gg", getText);
        if (xml === "wait") { waiting = true; break; }
        if (xml === null && cur.stuck !== j.job_id) await fail(j, "file not in R2");
        if (xml) {
          let trades: ReturnType<typeof parsePitXbrl> | null = null;
          try { trades = parsePitXbrl(parseXbrl(xml), { appId: String(row.appId ?? ""), broadcast: row.broadcastDateTime ?? row.exchdisstime, symbol: String(row.symbol ?? "") }); } catch (e) { await fail(j, `unreadable XBRL: ${String(e).slice(0, 150)}`); }
          if (trades) {
            const stmts = [];
            if (row.prevAppId) stmts.push({ sql: "DELETE FROM insider_trade WHERE key >= ? AND key < ?", params: [`pitx:${row.prevAppId}:`, `pitx:${row.prevAppId};`] }); // ';' sorts right after ':'
            stmts.push(...insertRows("INSERT OR REPLACE INTO insider_trade (key,symbol,person,category,sec_type,txn,mode,qty,value_rs,before_qty,after_qty,before_pct,after_pct,from_d,to_d,intimated,disclosed_at,did,pid,exchange,derivative,job_id)", 22,
              trades.map((t) => [t.key, t.symbol, t.person, t.category, t.secType, t.txn, t.mode, t.qty, t.valueRs, t.beforeQty, t.afterQty, t.beforePct, t.afterPct, dnum(t.fromDate), dnum(t.toDate), dnum(t.intimated), t.disclosedAt, t.did, t.pid, t.exchange, t.derivative, j.job_id])));
            await batchAll(db, stmts);
            await markFresh(db, "insider_trades", newestOf(trades.map((t) => t.disclosedAt)), trades.length);
            cur.rows += trades.length;
          }
        }
      }
    }
    cur.after = j.job_id; delete cur.stuck; delete cur.tries; files++;
    if (files % 25 === 0) await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','pitx_cursor',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  }
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','pitx_cursor',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  return { files, rows: cur.rows, after: cur.after, waiting };
}

/** Item 7 (2.10), one-off: re-read every stored credit-rating list with the issuer match; ratings of the focus companies
 *  not stored yet are added (INSERT OR IGNORE), stored ones still without a symbol get it (owner #363: symbol filled,
 *  nothing deleted). Cursor by job_id in ('once','ratings_relink'). */
export async function ratingsRelink(db: Sql, getText: (k: string) => Promise<string | null>, focus: string[], issuers: Map<string, string>, limit = 12) {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='ratings_relink_v2'");
  const cur = st ? JSON.parse(st.detail) as { after: number; lists: number; rows: number; inserted: number; linked: number; done: boolean }
    : { after: 0, lists: 0, rows: 0, inserted: 0, linked: 0, done: false };
  if (cur.done) return cur;
  const fs = new Set(focus);
  const jobs = await db.all<{ job_id: number; r2_key: string }>("SELECT job_id, r2_key FROM fetch_job WHERE kind = 'credit_rating' AND status = 'done' AND job_id > ?1 ORDER BY job_id LIMIT ?2", [cur.after, limit]);
  for (const j of jobs) {
    const t = await getText(j.r2_key).catch(() => null);
    cur.after = j.job_id; cur.lists++;
    if (!t) continue;
    let objs; try { objs = parseCreditRatings(t); } catch { continue; }
    const mine = objs.map((c) => ({ ...c, symbol: ratingSymbol(c, issuers) })).filter((c) => fs.has(c.symbol));
    if (!mine.length) continue;
    cur.rows += mine.length;
    const r = mine.map((c) => [c.key, c.symbol, c.company, c.isin, c.agency, c.rating, c.outlook, c.action, dnum(c.ratedOn), c.earlierRating, c.earlierOutlook, c.disclosedAt, c.appId, j.job_id]);
    cur.inserted += await batchAll(db, insertRows("INSERT OR IGNORE INTO credit_rating (key,symbol,company,isin,agency,rating,outlook,action,rated_on,earlier_rating,earlier_outlook,disclosed_at,app_id,job_id)", 14, r));
    // v2: NSE's placeholder symbols ("NOTLISTED", "NA", …) are replaced too — any stored symbol other than the match
    cur.linked += await batchAll(db, mine.map((c) => ({ sql: "UPDATE credit_rating SET symbol = ?1 WHERE key = ?2 AND symbol <> ?1", params: [c.symbol, c.key] })));
  }
  cur.done = jobs.length < limit;
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','ratings_relink_v2',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  return cur;
}
