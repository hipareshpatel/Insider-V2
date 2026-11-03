// Market daily job (§6, §9.1). One trading date at a time: fetch -> gates -> identity -> load -> corporate actions -> reviews.
// Idempotent: a date whose files are unchanged is not reloaded (Phase 1 test 4).
import {
  EQUITY_SERIES, type BhavRow, type DeliveryRow, type FetchResult, type Fetcher, type IdentifierRow, type IndexCloseRow,
  type McapRow, type RawStore, type ReviewItem, type Sql, type Stmt, affectsPrice, batchAll, decideFactor, dedupeBc, dec, diffIdentities,
  div, deliveryUrl, indexCloseUrl, insertRows, mul, parseDelivery, parseIndexClose, parsePrBundle, parsePurpose, parseUdiffZip,
  dnum, fromPaise, prBundleMatchesDate, prBundleUrl, reviewUpsert, toPaise, sha256Hex, sub, toText, udiffUrl, withinRatio,
} from "@disclo/core";
import { addDays, ddmmyy, ddmmyyyy, settledNoSession, ymd } from "./dates.js";

export interface Deps {
  market: Sql;
  app: Sql;
  raw: RawStore;
  fetch: Fetcher;
  now: () => Date;
  /** waits before retrying a refused file (default 3 s, 6 s, 12 s) */
  retryWaits?: number[];
  /** true when fetches come from the R2 cache wrapper (cache hits return contentType null) */
  cachedFromR2?: boolean;
}

export interface DayReport {
  date: string;
  status: "loaded" | "unchanged" | "no_session" | "pending" | "rejected" | "failed";
  counts?: Record<string, number>;
  reasons?: string[];
  reviews?: number;
  ms?: Record<string, number>;
  written?: number;
}

const iso = (d: Date) => d.toISOString();
/** Row-count gate: within ±5% of the 20-session median or of the previous accepted session (FMEA A4, C14). */
export function rowCountOk(n: number, median: number, prev: number): boolean {
  const near = (ref: number) => ref > 0 && Math.abs(n - ref) / ref <= 0.05;
  return near(median) || near(prev);
}

type Got = { url: string; res: FetchResult | null; error?: string };

const REFUSED = new Set([403, 429, 503]);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One file; a refusal is retried up to 3 times (3 s, 6 s, 12 s) before the date is left pending (D124). */
async function get(f: Fetcher, url: string, waits: number[] = [3000, 6000, 12000]): Promise<Got> {
  for (let i = 0; ; i++) {
    let res: FetchResult;
    try { res = await f(url); } catch (e) { return { url, res: null, error: String(e) }; }
    if (!REFUSED.has(res.status) || i >= waits.length) return { url, res };
    await pause(waits[i]!);
  }
}

/** Fetch, gate and load one trading date. */
export async function runDay(date: string, deps: Deps): Promise<DayReport> {
  const startedAt = iso(deps.now());
  const run = await deps.market.run(
    "INSERT INTO pipeline_run (pipeline, run_key, started_at, status) VALUES ('market.daily', ?, ?, 'running')", [date, startedAt]);
  void run;
  const [runRow] = await deps.market.all<{ id: number }>("SELECT max(run_id) AS id FROM pipeline_run WHERE pipeline='market.daily' AND run_key=?", [date]);
  const runId = runRow!.id;
  const finish = async (r: DayReport) => {
    await deps.market.run("UPDATE pipeline_run SET finished_at=?, status=?, detail=? WHERE run_id=?", [
      iso(deps.now()), r.status === "loaded" || r.status === "unchanged" ? "ok" : r.status === "no_session" ? "skipped" : "failed",
      JSON.stringify(r), runId]);
    return r;
  };
  try {
    return await finish(await load(date, deps));
  } catch (e) {
    return finish({ date, status: "failed", reasons: [String(e instanceof Error ? e.stack ?? e.message : e)] });
  }
}

async function load(date: string, deps: Deps): Promise<DayReport> {
  const t0 = Date.now();
  const ms: Record<string, number> = {};
  let written = 0;
  const lap = (k: string) => { ms[k] = Date.now() - t0; };
  // PR bundle first: every session has one, so a settled 404 means no session and nothing else is fetched
  // (the archive answers 403, not 404, for some missing bhavcopies, and refusals stop a run).
  const p = await get(deps.fetch, prBundleUrl(ddmmyy(date)), deps.retryWaits);
  if (p.res?.status === 404 && settledNoSession(date, deps.now())) {
    await deps.market.run("INSERT OR REPLACE INTO trading_calendar (trade_date, is_session, note) VALUES (?, 0, 'no PR bundle')", [date]);
    return { date, status: "no_session", reasons: ["PR bundle 404"] };
  }
  const [u, dl, ix] = await Promise.all([
    get(deps.fetch, udiffUrl(ymd(date)), deps.retryWaits),
    get(deps.fetch, deliveryUrl(ddmmyyyy(date)), deps.retryWaits), get(deps.fetch, indexCloseUrl(ddmmyyyy(date)), deps.retryWaits),
  ]);
  for (const g of [u, p]) if (!g.res) return { date, status: "failed", reasons: [`${g.url}: ${g.error}`] };
  const us = u.res!.status, ps = p.res!.status;
  if (us === 404 && ps === 404) {
    if (!settledNoSession(date, deps.now())) return { date, status: "pending", reasons: ["files not published yet"] };
    await deps.market.run("INSERT OR REPLACE INTO trading_calendar (trade_date, is_session, note) VALUES (?, 0, 'no files')", [date]);
    return { date, status: "no_session" };
  }
  // NSE's archive sometimes answers 403 (not 404) for a file that doesn't exist (seen 2024-01-27, a Saturday).
  // Every session has a PR bundle, so a settled PR-bundle 404 means no session.
  if (ps === 404 && settledNoSession(date, deps.now())) {
    await deps.market.run("INSERT OR REPLACE INTO trading_calendar (trade_date, is_session, note) VALUES (?, 0, 'no PR bundle')", [date]);
    return { date, status: "no_session", reasons: [`bhavcopy ${us}, PR bundle 404`] };
  }
  if (us !== 200 && !(us === 404 && ps === 200)) return { date, status: "pending", reasons: [`bhavcopy ${us}, PR bundle ${ps}`] };
  if (ps !== 200) return { date, status: "pending", reasons: [`bhavcopy ${us}, PR bundle ${ps}`] };

  // Wrong-date bundle (NSE data error): treat as missing.
  const prParsed = await parsePrBundle(p.res!.bytes);
  if (!prBundleMatchesDate(prParsed, date)) {
    if (us === 404 && settledNoSession(date, deps.now())) {
      await deps.market.run("INSERT OR REPLACE INTO trading_calendar (trade_date, is_session, note) VALUES (?, 0, 'PR bundle holds another date')", [date]);
      return { date, status: "no_session", reasons: ["bhavcopy 404; PR bundle holds another date's files"] };
    }
    return { date, status: "rejected", reasons: [`PR bundle for ${date} holds another date's files (${prParsed.entryNames.slice(0, 3).join(", ")})`] };
  }
  if (us !== 200) return { date, status: "pending", reasons: [`bhavcopy ${us}, PR bundle 200 (dated correctly)`] };
  // Idempotency (B4): unchanged bytes for both main files -> nothing to do.
  const shaU = await sha256Hex(u.res!.bytes), shaP = await sha256Hex(p.res!.bytes);
  const prev = await deps.market.all<{ source: string; sha256: string }>(
    "SELECT source, sha256 FROM source_file WHERE file_date=? AND source IN ('udiff_bhavcopy','pr_bundle') ORDER BY file_id", [date]);
  const last = (s: string) => prev.filter((r) => r.source === s).at(-1)?.sha256;
  if (last("udiff_bhavcopy") === shaU && last("pr_bundle") === shaP) return { date, status: "unchanged" };

  lap("fetched");
  // Parse (schema check: parsers throw on missing columns).
  const bhavAll = await parseUdiffZip(u.res!.bytes);
  const pr = prParsed;
  const delivery: DeliveryRow[] = dl.res?.status === 200 ? parseDelivery(new TextDecoder().decode(dl.res.bytes)) : [];
  const indices: IndexCloseRow[] = ix.res?.status === 200 ? parseIndexClose(new TextDecoder().decode(ix.res.bytes)) : [];

  const wrongDate = bhavAll.filter((r) => r.tradeDate !== date).length;
  if (wrongDate) return { date, status: "rejected", reasons: [`${wrongDate} bhavcopy rows dated other than ${date}`] };
  // Store everything (D127); the universe (D4, D126: EQ/BE/BZ, no INF fund units) is what the gates judge and what is analysed.
  const inUniverse = (r: BhavRow) => EQUITY_SERIES.has(r.series) && !r.isin.startsWith("INF") && !isRightsEntitlement(r.isin);
  const equity = bhavAll.filter(inUniverse);
  const reviews: ReviewItem[] = [];
  const reasons: string[] = [];

  // Gate: price sanity. Bad rows are dropped to review; the date is rejected if > 0.1% are bad (D125).
  const bad = equity.filter((r) => !saneRow(r));
  if (bad.length > Math.max(0, Math.floor(equity.length * 0.001))) reasons.push(`${bad.length} rows fail low<=open,close<=high or >0`);
  for (const r of bad) reviews.push({ kind: "bc_unparsed", subjectDb: "market", subjectRef: `price|${r.symbol}|${r.series}|${date}`, summary: `Bad OHLC row ${r.symbol} ${r.series} ${date}`, evidence: r });
  const good = equity.filter(saneRow);
  const goodAll = bhavAll.filter((r) => kindOf(r) !== null && saneRow(r)); // stocks, ETFs, REITs/InvITs (D127, #257); no debt

  // Gate: MCAP join (from 2024-02-01) and market-cap consistency.
  const mcapBy = new Map<string, McapRow>();
  for (const m of pr.mcap ?? []) mcapBy.set(`${m.symbol}|${m.series}`, m);
  if (date >= "2024-02-01") {
    if (!pr.mcap) reasons.push("MCAP file missing from PR bundle");
    else {
      const eq = good.filter((r) => r.series === "EQ");
      const joined = eq.filter((r) => mcapBy.has(`${r.symbol}|EQ`)).length;
      if (eq.length && joined / eq.length < 0.99) reasons.push(`only ${joined}/${eq.length} EQ rows join MCAP (< 99%)`);
      const inconsistent = good.filter((r) => {
        const m = mcapBy.get(`${r.symbol}|${r.series}`);
        if (!m || dec(m.mcapRs).units === 0n) return false;
        const calc = mul(dec(m.issueSize), dec(r.close));
        return !withinRatio(calc, dec(m.mcapRs), dec("0.005"));
      });
      if (inconsistent.length > Math.ceil(good.length * 0.005)) reasons.push(`${inconsistent.length} rows: |mcap - issue x close| >= 0.5%`);
      for (const r of inconsistent) reviews.push({ kind: "bc_unparsed", subjectDb: "market", subjectRef: `mcap|${r.symbol}|${date}`, summary: `Market cap inconsistent with issue x close: ${r.symbol} ${date}` });
    }
  }

  // Gate: row count within ±5% of the 20-session median (needs 20 sessions). Counts come from trading_calendar (D131).
  // Extension (D125): symbols absent the previous session don't count, so a wave of new listings doesn't block a day.
  const counts = await deps.market.all<{ n: number }>(
    "SELECT universe_rows AS n FROM trading_calendar WHERE is_session=1 AND universe_rows IS NOT NULL AND trade_date < ? ORDER BY trade_date DESC LIMIT 20", [date]);
  if (counts.length >= 20) {
    const sorted = counts.map((c) => c.n).sort((a, b) => a - b);
    const median = (sorted[9]! + sorted[10]!) / 2;
    // The previous session passed every gate, so a lasting step it accepted (2026-08-17: +161 EQ symbols) is the new
    // reference; otherwise every following day is rejected until the median catches up (FMEA C14). A truncated or
    // partial file still fails: it is far from both references.
    const prev = counts[0]!.n;
    if (!rowCountOk(good.length, median, prev)) {
      const [pd] = await deps.market.all<{ d: string | null }>("SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND trade_date < ?", [date]);
      const prevSyms = new Set(pd?.d ? (await deps.market.all<{ value: string }>(
        `SELECT DISTINCT i.value FROM price_daily p JOIN security_identifier i ON i.security_id = p.security_id AND i.id_type = 'nse_symbol'
         WHERE p.d = ? AND p.series IN ('EQ','BE','BZ')`, [dnum(pd.d)])).map((r) => r.value) : []);
      const carried = good.filter((r) => prevSyms.has(r.symbol)).length;
      const fresh = good.length - carried;
      if (!rowCountOk(carried, median, prev)) reasons.push(`row count ${good.length} (${carried} carried over) vs 20-session median ${median} and previous session ${prev} (> ±5%)`);
      else if (fresh > 0) reviews.push({ kind: "corp_action", subjectDb: "market", subjectRef: `newsymbols|${date}`, summary: `${fresh} symbols began trading on ${date} (row count ${good.length} vs median ${median}); information only` });
    }
  }
  if (reasons.length) {
    await writeReviews(deps, reviews);
    return { date, status: "rejected", reasons, reviews: reviews.length };
  }

  // Raw files to R2 + ledger.
  const fileIds: Record<string, number> = {};
  for (const [source, g] of [["udiff_bhavcopy", u], ["pr_bundle", p], ["delivery", dl], ["index_close", ix]] as const) {
    if (g.res?.status !== 200) continue;
    const sha = source === "udiff_bhavcopy" ? shaU : source === "pr_bundle" ? shaP : await sha256Hex(g.res.bytes);
    // With the R2-first fetcher every archive file is already in R2 at cache/<path> (prefetched or written through),
    // so the ledger points there and nothing is stored twice; otherwise keep a raw copy.
    const cacheKey = deps.cachedFromR2 && g.url.startsWith("https://nsearchives.nseindia.com/") ? `cache${new URL(g.url).pathname}` : null;
    const key = cacheKey ?? `raw/${source}/${date}/${sha}`;
    if (!cacheKey) await deps.raw.put(key, g.res.bytes, g.res.contentType);
    await deps.market.run(
      "INSERT OR IGNORE INTO source_file (source, file_date, url, sha256, bytes, fetched_at, r2_key) VALUES (?,?,?,?,?,?,?)",
      [source, date, g.url, sha, g.res.bytes.length, iso(deps.now()), key]);
    const [row] = await deps.market.all<{ file_id: number }>("SELECT file_id FROM source_file WHERE source=? AND file_date=? AND sha256=?", [source, date, sha]);
    fileIds[source] = row!.file_id;
  }

  lap("gated_raw");
  // Identity (B1).
  const idRows = await deps.market.all<{ security_id: number; id_type: string; value: string; valid_from: string; valid_to: string | null }>(
    "SELECT security_id, id_type, value, valid_from, valid_to FROM security_identifier WHERE id_type IN ('nse_symbol','isin')");
  const ids: IdentifierRow[] = idRows.map((r) => ({ securityId: r.security_id, idType: r.id_type as "nse_symbol" | "isin", value: r.value, validFrom: r.valid_from, validTo: r.valid_to }));
  // Identity for every instrument; prefer the universe row when a symbol trades in several series.
  const observed = [...new Map([...goodAll.filter((r) => !inUniverse(r)), ...good].map((r) => [r.symbol, { symbol: r.symbol, isin: r.isin, date, name: r.name, kind: kindOf(r) }])).values()];
  const changes = diffIdentities(ids, observed);
  const conflictSyms = new Set<string>();
  // New securities in one batch (the first day creates ~2,000).
  const fresh = changes.filter((c): c is Extract<typeof c, { kind: "new_security" }> => c.kind === "new_security");
  if (fresh.length) {
    const [mx] = await deps.market.all<{ id: number | null }>("SELECT max(security_id) AS id FROM security");
    let next = (mx?.id ?? 0) + 1;
    const secRows: unknown[][] = [];
    const idRowsNew: unknown[][] = [];
    for (const c of fresh) {
      const sid = next++;
      const ob = observed.find((o) => o.symbol === c.symbol)!;
      secRows.push([sid, ob.name, ob.kind ?? "other"]);
      idRowsNew.push([sid, "nse_symbol", c.symbol, date, `udiff:${date}`], [sid, "isin", c.isin, date, `udiff:${date}`]);
      ids.push({ securityId: sid, idType: "nse_symbol", value: c.symbol, validFrom: date, validTo: null }, { securityId: sid, idType: "isin", value: c.isin, validFrom: date, validTo: null });
    }
    await batchAll(deps.market, [
      ...insertRows("INSERT INTO security (security_id, name, kind)", 3, secRows),
      ...insertRows("INSERT INTO security_identifier (security_id,id_type,value,valid_from,source)", 5, idRowsNew),
    ]);
  }
  for (const c of changes) {
    if (c.kind === "new_security") {
      continue;
    } else if (c.kind === "extend_back") {
      await deps.market.batch([
        { sql: "UPDATE security_identifier SET valid_from=? WHERE security_id=? AND id_type='nse_symbol' AND value=? AND valid_from = (SELECT min(valid_from) FROM security_identifier WHERE security_id=? AND id_type='nse_symbol' AND value=?)", params: [date, c.securityId, c.symbol, c.securityId, c.symbol] },
        { sql: "UPDATE security_identifier SET valid_from=? WHERE security_id=? AND id_type='isin' AND value=? AND valid_from = (SELECT min(valid_from) FROM security_identifier WHERE security_id=? AND id_type='isin' AND value=?)", params: [date, c.securityId, c.isin, c.securityId, c.isin] },
      ]);
      for (const r of ids) if (r.securityId === c.securityId && ((r.idType === "nse_symbol" && r.value === c.symbol) || (r.idType === "isin" && r.value === c.isin)) && r.validFrom > date) r.validFrom = date;
    } else if (c.kind === "isin_change" || c.kind === "symbol_change") {
      const t = c.kind === "isin_change" ? "isin" : "nse_symbol";
      await deps.market.batch([
        { sql: "UPDATE security_identifier SET valid_to=? WHERE security_id=? AND id_type=? AND valid_to IS NULL", params: [addDays(date, -1), c.securityId, t] },
        { sql: "INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (?,?,?,?,?)", params: [c.securityId, t, c.to, date, `udiff:${date}`] },
      ]);
      for (const r of ids) if (r.securityId === c.securityId && r.idType === t && r.validTo === null) r.validTo = addDays(date, -1);
      ids.push({ securityId: c.securityId, idType: t, value: c.to, validFrom: date, validTo: null });
    } else {
      conflictSyms.add(c.symbol);
      reviews.push({ kind: "identity_conflict", subjectDb: "market", subjectRef: `${c.symbol}|${c.isin}|${date}`, summary: `Symbol and ISIN point to different securities: ${c.reason}`, evidence: c });
    }
  }
  const secOf = new Map<string, number>();
  for (const r of ids) if (r.idType === "nse_symbol" && r.validFrom <= date && (r.validTo === null || date <= r.validTo)) secOf.set(r.value, r.securityId);
  const rowsAll = goodAll.filter((r) => !conflictSyms.has(r.symbol) && secOf.has(r.symbol));
  const rows = rowsAll.filter(inUniverse);

  // Prices, shares, delivery, index closes.
  const stmts: Stmt[] = [];
  const D = dnum(date);
  stmts.push(...insertRows(
    "INSERT INTO price_daily (security_id,d,series,open,high,low,close,prev_close,volume,turnover_paise,trades,file_id)", 12,
    rowsAll.map((r) => [secOf.get(r.symbol), D, r.series, toPaise(r.open), toPaise(r.high), toPaise(r.low), toPaise(r.close), toPaise(r.prevClose), r.volume, toPaise(r.turnoverRs), r.trades, fileIds.udiff_bhavcopy]),
    "ON CONFLICT (security_id,d,series) DO UPDATE SET open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,prev_close=excluded.prev_close,volume=excluded.volume,turnover_paise=excluded.turnover_paise,trades=excluded.trades,file_id=excluded.file_id WHERE price_daily.open IS NOT excluded.open OR price_daily.high IS NOT excluded.high OR price_daily.low IS NOT excluded.low OR price_daily.close IS NOT excluded.close OR price_daily.prev_close IS NOT excluded.prev_close OR price_daily.volume IS NOT excluded.volume OR price_daily.turnover_paise IS NOT excluded.turnover_paise OR price_daily.trades IS NOT excluded.trades OR price_daily.file_id IS NOT excluded.file_id"));
  // One shares row per security per day: prefer the EQ series' MCAP row.
  const bySec = new Map<number, unknown[]>();
  for (const r of [...rowsAll].sort((x, y) => (x.series === "EQ" ? 0 : 1) - (y.series === "EQ" ? 0 : 1))) {
    const sid = secOf.get(r.symbol)!;
    const m = mcapBy.get(`${r.symbol}|${r.series}`);
    if (m && !bySec.has(sid)) bySec.set(sid, [sid, D, m.issueSize, toPaise(m.mcapRs), "nse", toPaise(m.faceValue)]);
  }
  const shareRowsUnique = [...bySec.values()];
  stmts.push(...insertRows("INSERT INTO shares_daily (security_id,d,issue_size,mcap_paise,mcap_source,face_value_paise)", 6, shareRowsUnique,
    "ON CONFLICT (security_id,d) DO UPDATE SET issue_size=excluded.issue_size,mcap_paise=excluded.mcap_paise,mcap_source=excluded.mcap_source,face_value_paise=excluded.face_value_paise WHERE shares_daily.issue_size IS NOT excluded.issue_size OR shares_daily.mcap_paise IS NOT excluded.mcap_paise OR shares_daily.mcap_source IS NOT excluded.mcap_source OR shares_daily.face_value_paise IS NOT excluded.face_value_paise"));
  if (fileIds.delivery) {
    const dRows = delivery.filter((d) => secOf.has(d.symbol) && d.tradeDate === date)
      .filter((d) => d.deliverableQty !== null).map((d) => [secOf.get(d.symbol), D, d.series, d.deliverableQty]);
    stmts.push(...insertRows("INSERT INTO delivery_daily (security_id,d,series,deliverable_qty)", 4, dRows,
      "ON CONFLICT (security_id,d,series) DO UPDATE SET deliverable_qty=excluded.deliverable_qty WHERE delivery_daily.deliverable_qty IS NOT excluded.deliverable_qty"));
  }
  if (fileIds.index_close) {
    const iRows = indices.filter((i) => i.tradeDate === date).map((i) => [i.indexName, D, i.open, i.high, i.low, i.close, i.pe, i.pb, i.divYield]);
    stmts.push(...insertRows("INSERT INTO index_daily (index_name,d,open,high,low,close,pe,pb,div_yield)", 9, iRows,
      "ON CONFLICT (index_name,d) DO UPDATE SET open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,pe=excluded.pe,pb=excluded.pb,div_yield=excluded.div_yield WHERE index_daily.open IS NOT excluded.open OR index_daily.high IS NOT excluded.high OR index_daily.low IS NOT excluded.low OR index_daily.close IS NOT excluded.close OR index_daily.pe IS NOT excluded.pe OR index_daily.pb IS NOT excluded.pb OR index_daily.div_yield IS NOT excluded.div_yield"));
  }
  stmts.push({ sql: "INSERT OR REPLACE INTO trading_calendar (trade_date, is_session, note, universe_rows) VALUES (?, 1, NULL, ?)", params: [date, rows.length] });
  lap("identity");
  written += await batchAll(deps.market, stmts, 250);
  lap("prices_written");

  // Upserts above rewrite a row only when a value changed (V1 lesson #280: an unchanged rewrite is still a billed write).
  // Corporate actions (D6, D7): record every Bc row; decide factors for actions whose ex-date is today.
  // Second official source (market/0016): NSE's per-company lists carry actions some Bc files omit.
  const extra = (await deps.market.all<{ symbol: string; purpose: string; series: string }>(
    "SELECT symbol, purpose, series FROM corp_action_extra WHERE ex_date = ?", [date])).map((x) => ({ series: x.series, symbol: x.symbol, name: "", recordDate: null, exDate: date, purpose: x.purpose }));
  const bcAll = [...pr.bc, ...extra.filter((x) => !pr.bc.some((b) => b.symbol === x.symbol && b.exDate === x.exDate))];
  const bc = dedupeBc(bcAll, new Set(bcAll.map((r) => r.series))); // every series (D127); one row per symbol/ex-date/purpose
  const caStmts: Stmt[] = [];
  const todays = new Map<number, { purposes: string[]; comps: ReturnType<typeof parsePurpose>["components"]; unknown: boolean }>();
  const shareLike = new Set(rowsAll.map((r) => r.symbol)); // rowsAll holds stock-like instruments only (#257)
  for (const r of bc) {
    const sid = secOf.get(r.symbol);
    if (!sid) continue;
    if (!shareLike.has(r.symbol)) continue; // bonds/debentures/G-secs: their corporate actions don't adjust share prices
    const parsed = parsePurpose(r.purpose);
    const priceAffecting = affectsPrice(parsed);
    const status = parsed.unparsed.length ? "review" : "parsed";
    const t0 = typeOf(parsed.components);
    const type = ["split", "bonus", "rights", "dividend", "demerger", "capital_reduction", "consolidation", "other", "meeting"].includes(t0) ? t0 : "other";
    if ((type === "meeting" || parsed.components.every((c) => c.type === "debt_service" || c.type === "meeting")) && !parsed.unparsed.length) continue;
    const amount = parsed.components.filter((c) => c.type === "dividend").map((c) => (c as { amount: string }).amount).join("+") || null;
    caStmts.push({ sql: `INSERT INTO corp_action (security_id,ex_date,type,raw_purpose,amount,status,file_id) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT (security_id,ex_date,raw_purpose) DO NOTHING`, params: [sid, r.exDate, type === "meeting" ? "other" : type, r.purpose, amount, status, fileIds.pr_bundle] });
    if (parsed.unparsed.length) reviews.push({ kind: "bc_unparsed", subjectDb: "market", subjectRef: `${r.symbol}|${r.exDate}|${r.purpose}`, summary: `Unparsed corporate action: ${r.symbol} ex ${r.exDate}: "${r.purpose}"`, evidence: { unparsed: parsed.unparsed } });
    if (r.exDate === date && (priceAffecting || parsed.unparsed.length)) {
      const t = todays.get(sid) ?? { purposes: [], comps: [], unknown: false };
      t.purposes.push(r.purpose);
      t.comps.push(...parsed.components.filter((c) => c.type !== "dividend" && c.type !== "meeting"));
      if (parsed.unparsed.length) t.unknown = true; // something not understood: review, and no factor is written
      todays.set(sid, t);
    }
  }
  written += await batchAll(deps.market, caStmts);

  const prevDate = (await deps.market.all<{ d: string | null }>("SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND trade_date < ?", [date]))[0]?.d ?? null;
  const prevShares = new Map<number, number>();
  const prevClose = new Map<number, string>();
  const prevFv = new Map<number, string>();
  if (prevDate) {
    // Whole day needed (D129 checks every security); served by ix_shares_d (market/0015, owner #271).
    for (const r of await deps.market.all<{ security_id: number; issue_size: number; face_value_paise: number | null }>("SELECT security_id, issue_size, face_value_paise FROM shares_daily WHERE d=?", [dnum(prevDate)])) {
      prevShares.set(r.security_id, r.issue_size);
      if (r.face_value_paise !== null) prevFv.set(r.security_id, fromPaise(r.face_value_paise)!);
    }
    for (const r of await deps.market.all<{ security_id: number; close: number; series: string }>("SELECT security_id, close, series FROM price_daily WHERE d=? ORDER BY series='EQ'", [dnum(prevDate)])) prevClose.set(r.security_id, fromPaise(r.close)!);
  }
  const todayShares = new Map<number, number>(shareRowsUnique.map((r) => [r[0] as number, r[2] as number]));
  const factorStmts: Stmt[] = [];
  const staleStmts: Stmt[] = [];
  const supersede: string[] = [];
  for (const [sid, t] of todays) {
    if (t.unknown && !t.comps.length) {
      continue; // already raised once as "Unparsed corporate action" (no duplicate item)
    }
    const row = rowsAll.find((r) => secOf.get(r.symbol) === sid && r.series === "EQ") ?? rowsAll.find((r) => secOf.get(r.symbol) === sid);
    const d = decideFactor({
      exDate: date, components: t.comps, sharesBefore: prevShares.get(sid) ?? null, sharesOnEx: todayShares.get(sid) ?? null,
      prevClose: prevClose.get(sid) ?? row?.prevClose ?? null, faceValue: prevFv.get(sid) ?? null, openOnEx: row?.open ?? null,
    });
    if (d.factor) {
      factorStmts.push({ sql: `INSERT INTO adj_factor (security_id,ex_date,factor,method,status) VALUES (?,?,?,?,?)
        ON CONFLICT (security_id,ex_date) DO UPDATE SET factor=excluded.factor,method=excluded.method,status=excluded.status WHERE adj_factor.status <> 'confirmed'`,
        params: [sid, date, d.factor, d.method, d.status] });
    }
    if (d.status === "review") reviews.push({ kind: "corp_action", subjectDb: "market", subjectRef: `${sid}|${date}`, summary: `Corporate action needs review: ${t.purposes.join(" + ")} (${d.reason})`, proposed: d });
    if (d.status === "auto" && d.factor) {
      // Stale Bc ex-dates (V1 hint #276; INOXWIND, VSTIND, POWERMECH…): the same action listed days earlier left a
      // review factor with the same ratio. Applied now on its true date → the earlier one is a duplicate (no double adjustment).
      for (const st of await deps.market.all<{ ex_date: string }>("SELECT ex_date FROM adj_factor WHERE security_id=? AND status='review' AND factor=? AND ex_date BETWEEN ? AND ?", [sid, d.factor, addDays(date, -15), addDays(date, -1)])) {
        staleStmts.push({ sql: "DELETE FROM adj_factor WHERE security_id=? AND ex_date=? AND status='review'", params: [sid, st.ex_date] });
        supersede.push(`${sid}|${st.ex_date}`);
      }
    }
  }
  written += await batchAll(deps.market, factorStmts);
  written += await batchAll(deps.market, staleStmts);
  if (supersede.length) await batchAll(deps.app, supersede.map((ref) => ({ sql: "UPDATE review_item SET status='superseded', decided_at=? WHERE status='open' AND kind='corp_action' AND subject_ref=?", params: [iso(deps.now()), ref] })));

  // Review checks: unexplained share-count change > 2%, unexplained move > ±35% (§9.1).
  const factored = new Set(todays.keys());
  const factorStmts2: Stmt[] = [];
  const universeSids = new Set(rows.map((r) => secOf.get(r.symbol)!));
  for (const [sid, n] of todayShares) {
    if (!universeSids.has(sid)) continue;
    const before = prevShares.get(sid);
    // D129: a missed split/bonus shows as a big ratio or a big price move; ordinary issuance (QIP, ESOP, allotment) doesn't.
    const ratio = before ? n / before : 1;
    const row = rows.find((r) => secOf.get(r.symbol) === sid && r.series === "EQ");
    const pc = prevClose.get(sid);
    const move = row && pc && Number(pc) > 0 ? Math.abs(Number(row.close) / Number(pc) - 1) : 0;
    if (before && !factored.has(sid) && Math.abs(n - before) / before > 0.02 && (ratio >= 1.25 || ratio <= 0.8 || move > 0.2)) {
      reviews.push({ kind: "corp_action", subjectDb: "market", subjectRef: `shares|${sid}|${date}`, summary: `Share count changed ${before} → ${n} with no corporate action`, evidence: { before, after: n } });
    }
  }
  for (const r of rows.filter((x) => x.series === "EQ")) {
    const sid = secOf.get(r.symbol)!;
    if (factored.has(sid)) continue;
    const pc = prevClose.get(sid);
    if (!pc || dec(pc).units === 0n) continue;
    const move = toText(div(sub(dec(r.close), dec(pc)), dec(pc), 4));
    if (Math.abs(Number(move)) > 0.35) reviews.push({ kind: "corp_action", subjectDb: "market", subjectRef: `move|${sid}|${date}`, summary: `${r.symbol} moved ${(Number(move) * 100).toFixed(1)}% with no corporate action`, evidence: { prevClose: pc, close: r.close } });
  }
  // ETFs: no share-count file, so a unit split shows only as a price move. Propose; the owner confirms (never auto).
  for (const r of rowsAll.filter((x) => x.series === "EQ" && kindOf(x) === "etf")) {
    const sid = secOf.get(r.symbol);
    const pc = sid ? prevClose.get(sid) : undefined;
    if (!sid || factored.has(sid) || !pc || dec(pc).units === 0n) continue;
    const move = Number(toText(div(sub(dec(r.close), dec(pc)), dec(pc), 4)));
    if (Math.abs(move) <= 0.35) continue;
    const f = cleanRatio(move);
    if (f) factorStmts2.push({ sql: "INSERT INTO adj_factor (security_id,ex_date,factor,method,status) VALUES (?,?,?,'price_ratio','review') ON CONFLICT (security_id,ex_date) DO NOTHING", params: [sid, date, f] });
    reviews.push({ kind: "corp_action", subjectDb: "market", subjectRef: `etfmove|${sid}|${date}`, summary: `ETF ${r.symbol} moved ${(move * 100).toFixed(1)}%: unit split?${f ? ` proposed factor ${f}` : ""}`, evidence: { prevClose: pc, close: r.close }, proposed: f ? { factor: f, method: "price_ratio", status: "review" } : undefined });
  }
  written += await batchAll(deps.market, factorStmts2);
  await writeReviews(deps, reviews);

  return {
    date, status: "loaded",
    counts: { prices: rows.length, stored_all: rowsAll.length, shares: shareRowsUnique.length, delivery: fileIds.delivery ? delivery.length : 0, indices: fileIds.index_close ? indices.length : 0, corp_actions: caStmts.length, factors: factorStmts.length, new_securities: changes.filter((c) => c.kind === "new_security").length },
    reviews: reviews.length,
    written,
    ms: { ...ms, total: Date.now() - t0 },
  } as DayReport;
}

function saneRow(r: BhavRow): boolean {
  try {
    const [o, h, l, c] = [dec(r.open), dec(r.high), dec(r.low), dec(r.close)];
    const pos = [o, h, l, c].every((x) => x.units > 0n);
    const le = (a: typeof o, b: typeof o) => toText(sub(b, a)).startsWith("-") === false;
    return pos && le(l, o) && le(l, c) && le(o, h) && le(c, h);
  } catch { return false; }
}

function typeOf(cs: readonly { type: string }[]): string {
  const order = ["split", "consolidation", "bonus", "rights", "demerger", "capital_reduction", "dividend"];
  for (const t of order) if (cs.some((c) => c.type === t)) return t;
  if (cs.some((c) => c.type === "merger" || c.type === "buyback")) return "other";
  if (cs.length && cs.every((c) => c.type === "meeting")) return "meeting";
  return "other";
}

async function writeReviews(deps: Deps, items: ReviewItem[]) {
  const now = iso(deps.now());
  await batchAll(deps.app, items.map((i) => reviewUpsert(i, now)));
}

/** Instrument type for storage (D127 as clarified in #257: everything about stocks, plus ETFs and REITs/InvITs).
 *  Classified by series (company debentures carry the company's INE ISIN, so ISIN alone can't tell debt from equity).
 *  null = not stored (bonds, debentures, G-secs, SGBs, T-bills, state loans, preference shares). */
export const EQUITY_STORE_SERIES = new Set(["EQ", "BE", "BZ", "BL", "SM", "ST", "SZ"]);
/** Rights entitlement: company ISIN with security-type code 20 (e.g. INE546Y20030, symbol XYZ-RE). Exact on 107
 *  sessions of 2026 (22 instruments, 0 mismatches with "-RE" symbols). Not shares: stored as 'other', outside the universe. */
export function isRightsEntitlement(isin: string): boolean {
  return isin.length === 12 && isin.startsWith("INE") && isin.slice(7, 9) === "20";
}
/** ETF unit split proposal from a price ratio (never applied without the owner: no ETF share count to confirm it). */
export function cleanRatio(move: number): string | null {
  const f = 1 + move;
  for (const [k, t] of [[0.5, "0.5"], [0.2, "0.2"], [0.1, "0.1"], [0.25, "0.25"], [1 / 3, "0.33333333"], [2, "2"], [5, "5"], [10, "10"]] as const)
    if (Math.abs(f - k) / k < 0.03) return t;
  return null;
}
export function kindOf(r: { series: string; isin: string }): "equity" | "etf" | "reit" | "invit" | "other" | null {
  if (r.series === "RR") return "reit";
  if (r.series === "IV") return "invit";
  if (r.isin.startsWith("INF") && (EQUITY_STORE_SERIES.has(r.series) || r.series === "MF")) return "etf";
  if (isRightsEntitlement(r.isin) && (EQUITY_STORE_SERIES.has(r.series) || /^[EX][1-9]$/.test(r.series))) return "other";
  if (EQUITY_STORE_SERIES.has(r.series) || /^[EX][1-9]$/.test(r.series)) return "equity"; // E1/X1…: partly paid shares
  return null;
}
