// M2 event loader (owner #289): reads the downloaded NSE lists (R2) for insider trades, SAST, board meetings and credit
// ratings into their tables. Walks the ledger by a primary-key cursor (C18: no whole-table scans per run) and stops at a
// list that is not downloaded yet, so nothing is skipped. Rows are keyed; INSERT OR IGNORE makes re-reads harmless.
import { type Sql, batchAll, insertRows, parseBoardMeetings, parseCreditRatings, parsePit, parsePitXbrl, parseSast, parseXbrl } from "@disclo/core";

const dnum = (iso: string | null) => (iso ? Number(iso.replace(/-/g, "")) : null);
const KINDS = ["pit", "sast29", "board_meetings", "credit_rating"];

export async function loadEvents(db: Sql, getText: (k: string) => Promise<string | null>, limit = 60): Promise<{ lists: number; rows: number; after: number }> {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='events_cursor'");
  const cur = st ? JSON.parse(st.detail) as { after: number; rows: number } : { after: 0, rows: 0 };
  const jobs = await db.all<{ job_id: number; kind: string; r2_key: string; status: string; attempts: number }>(
    `SELECT job_id, kind, r2_key, status, attempts FROM fetch_job WHERE job_id > ? AND +kind IN (${KINDS.map(() => "?").join(",")}) ORDER BY job_id LIMIT ?`, [cur.after, ...KINDS, limit]);
  let lists = 0;
  for (const j of jobs) {
    const terminal = j.status === "done" || j.status === "empty" || (j.status === "failed" && j.attempts >= 4);
    if (!terminal) break; // not downloaded yet: wait here, never skip
    if (j.status === "done") {
      const t = await getText(j.r2_key);
      if (t) {
        let n = 0;
        try { n = await write(db, j.kind, t, j.job_id); } catch { /* malformed list: counted below as 0 rows */ }
        cur.rows += n;
      }
    }
    cur.after = j.job_id; lists++;
  }
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','events_cursor',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  return { lists, rows: cur.rows, after: cur.after };
}

async function write(db: Sql, kind: string, json: string, jobId: number): Promise<number> {
  if (kind === "pit") {
    const r = parsePit(json).map((t) => [t.key, t.symbol, t.person, t.category, t.secType, t.txn, t.mode, t.qty, t.valueRs, t.beforeQty, t.afterQty, t.beforePct, t.afterPct, dnum(t.fromDate), dnum(t.toDate), dnum(t.intimated), t.disclosedAt, t.did, t.pid, t.exchange, t.derivative, jobId]);
    await batchAll(db, insertRows("INSERT OR IGNORE INTO insider_trade (key,symbol,person,category,sec_type,txn,mode,qty,value_rs,before_qty,after_qty,before_pct,after_pct,from_d,to_d,intimated,disclosed_at,did,pid,exchange,derivative,job_id)", 22, r));
    return r.length;
  }
  if (kind === "sast29") {
    const r = parseSast(json).map((s) => [s.key, s.symbol, s.acquirer, s.promoter === null ? null : s.promoter ? 1 : 0, s.regType, s.action, s.mode, s.secType, s.sharesAcq, s.sharesSale, s.sharesAfter, s.pctAcq, s.pctSale, s.pctAfter, s.period, s.disclosedAt, jobId]);
    await batchAll(db, insertRows("INSERT OR IGNORE INTO sast_disclosure (key,symbol,acquirer,promoter,reg_type,action,mode,sec_type,shares_acq,shares_sale,shares_after,pct_acq,pct_sale,pct_after,period,disclosed_at,job_id)", 17, r));
    return r.length;
  }
  if (kind === "board_meetings") {
    const r = parseBoardMeetings(json).map((b) => [b.key, b.symbol, dnum(b.meetingDate), b.purpose, b.description, b.intimation, b.announcedAt, b.xbrl, jobId]);
    await batchAll(db, insertRows("INSERT OR IGNORE INTO board_meeting (key,symbol,meeting_d,purpose,description,intimation,announced_at,xbrl,job_id)", 9, r));
    return r.length;
  }
  const r = parseCreditRatings(json).map((c) => [c.key, c.symbol, c.company, c.isin, c.agency, c.rating, c.outlook, c.action, dnum(c.ratedOn), c.earlierRating, c.earlierOutlook, c.disclosedAt, c.appId, jobId]);
  await batchAll(db, insertRows("INSERT OR IGNORE INTO credit_rating (key,symbol,company,isin,agency,rating,outlook,action,rated_on,earlier_rating,earlier_outlook,disclosed_at,app_id,job_id)", 14, r));
  return r.length;
}

/** C53: insider trades from NSE's system since 3 May 2026 — one XBRL per filing (kind xbrl_pit_gg*), linked from the
 *  pit-gg lists that give its broadcast time, filing number (appId) and the filing it revises (prevAppId). Walks the
 *  ledger by job_id and waits at a file not downloaded yet (C47); a revision replaces the rows of the filing it revises. */
const PITX = ["xbrl_pit_gg", "xbrl_pit_gg_probe"];
export async function loadPitXbrl(db: Sql, getText: (k: string) => Promise<string | null>, limit = 150): Promise<{ files: number; rows: number; after: number; waiting: boolean }> {
  const [st] = await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='pitx_cursor'");
  const cur = st ? JSON.parse(st.detail) as { after: number; rows: number } : { after: 0, rows: 0 };
  const jobs = await db.all<{ job_id: number; url: string; r2_key: string; status: string; attempts: number; http_status: number | null; parent_key: string | null }>(
    `SELECT j.job_id, j.url, j.r2_key, j.status, j.attempts, j.http_status, p.r2_key AS parent_key FROM fetch_job j LEFT JOIN fetch_job p ON p.job_id = j.parent_id
     WHERE j.job_id > ? AND +j.kind IN (${PITX.map(() => "?").join(",")}) ORDER BY j.job_id LIMIT ?`, [cur.after, ...PITX, limit]);
  const lists = new Map<string, Record<string, unknown>[]>();
  let files = 0, waiting = false;
  for (const j of jobs) {
    const terminal = j.status === "done" || j.status === "empty" || (j.status === "failed" && (j.attempts >= 3 || j.http_status === 404));
    if (!terminal) { waiting = true; break; }
    if (j.status === "done" && j.parent_key) {
      if (!lists.has(j.parent_key)) {
        let rows: Record<string, unknown>[] = [];
        try { const t = await getText(j.parent_key); const d = t ? JSON.parse(t) as unknown : null; rows = Array.isArray(d) ? d as Record<string, unknown>[] : ((d as { data?: Record<string, unknown>[] } | null)?.data ?? []); } catch { /* unreadable list */ }
        lists.set(j.parent_key, rows);
      }
      const row = lists.get(j.parent_key)!.find((r) => r.xmlFileName === j.url);
      const xml = row ? await getText(j.r2_key) : null;
      if (row && xml) {
        let trades: ReturnType<typeof parsePitXbrl> = [];
        try { trades = parsePitXbrl(parseXbrl(xml), { appId: String(row.appId ?? ""), broadcast: row.broadcastDateTime ?? row.exchdisstime, symbol: String(row.symbol ?? "") }); } catch { /* unreadable file: 0 rows */ }
        const stmts = [];
        if (row.prevAppId) stmts.push({ sql: "DELETE FROM insider_trade WHERE key >= ? AND key < ?", params: [`pitx:${row.prevAppId}:`, `pitx:${row.prevAppId};`] }); // ';' sorts right after ':'
        stmts.push(...insertRows("INSERT OR REPLACE INTO insider_trade (key,symbol,person,category,sec_type,txn,mode,qty,value_rs,before_qty,after_qty,before_pct,after_pct,from_d,to_d,intimated,disclosed_at,did,pid,exchange,derivative,job_id)", 22,
          trades.map((t) => [t.key, t.symbol, t.person, t.category, t.secType, t.txn, t.mode, t.qty, t.valueRs, t.beforeQty, t.afterQty, t.beforePct, t.afterPct, dnum(t.fromDate), dnum(t.toDate), dnum(t.intimated), t.disclosedAt, t.did, t.pid, t.exchange, t.derivative, j.job_id])));
        await batchAll(db, stmts);
        cur.rows += trades.length;
      }
    }
    cur.after = j.job_id; files++;
  }
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','pitx_cursor',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [new Date().toISOString(), JSON.stringify(cur)]);
  return { files, rows: cur.rows, after: cur.after, waiting };
}
