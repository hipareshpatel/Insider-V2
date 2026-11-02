// Market daily job (§6, §9.1). One trading date at a time: fetch -> gates -> identity -> load -> corporate actions -> reviews.
// Idempotent: a date whose files are unchanged is not reloaded (Phase 1 test 4).
import {
  EQUITY_SERIES, type BhavRow, type DeliveryRow, type FetchResult, type Fetcher, type IdentifierRow, type IndexCloseRow,
  type McapRow, type RawStore, type ReviewItem, type Sql, type Stmt, affectsPrice, batchAll, decideFactor, dedupeBc, dec, diffIdentities,
  div, deliveryUrl, indexCloseUrl, insertRows, mul, parseDelivery, parseIndexClose, parsePrBundle, parsePurpose, parseUdiffZip,
  prBundleUrl, reviewUpsert, sha256Hex, sub, toText, udiffUrl, withinRatio,
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
}

export interface DayReport {
  date: string;
  status: "loaded" | "unchanged" | "no_session" | "pending" | "rejected" | "failed";
  counts?: Record<string, number>;
  reasons?: string[];
  reviews?: number;
}

const iso = (d: Date) => d.toISOString();
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
  const [u, p, dl, ix] = await Promise.all([
    get(deps.fetch, udiffUrl(ymd(date)), deps.retryWaits), get(deps.fetch, prBundleUrl(ddmmyy(date)), deps.retryWaits),
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
  if (us !== 200 || ps !== 200) return { date, status: "pending", reasons: [`bhavcopy ${us}, PR bundle ${ps}`] };

  // Idempotency (B4): unchanged bytes for both main files -> nothing to do.
  const shaU = await sha256Hex(u.res!.bytes), shaP = await sha256Hex(p.res!.bytes);
  const prev = await deps.market.all<{ source: string; sha256: string }>(
    "SELECT source, sha256 FROM source_file WHERE file_date=? AND source IN ('udiff_bhavcopy','pr_bundle') ORDER BY file_id", [date]);
  const last = (s: string) => prev.filter((r) => r.source === s).at(-1)?.sha256;
  if (last("udiff_bhavcopy") === shaU && last("pr_bundle") === shaP) return { date, status: "unchanged" };

  // Parse (schema check: parsers throw on missing columns).
  const bhavAll = await parseUdiffZip(u.res!.bytes);
  const pr = await parsePrBundle(p.res!.bytes);
  const delivery: DeliveryRow[] = dl.res?.status === 200 ? parseDelivery(new TextDecoder().decode(dl.res.bytes)) : [];
  const indices: IndexCloseRow[] = ix.res?.status === 200 ? parseIndexClose(new TextDecoder().decode(ix.res.bytes)) : [];

  const wrongDate = bhavAll.filter((r) => r.tradeDate !== date).length;
  if (wrongDate) return { date, status: "rejected", reasons: [`${wrongDate} bhavcopy rows dated other than ${date}`] };
  // Store everything (D127); the universe (D4, D126: EQ/BE/BZ, no INF fund units) is what the gates judge and what is analysed.
  const inUniverse = (r: BhavRow) => EQUITY_SERIES.has(r.series) && !r.isin.startsWith("INF");
  const equity = bhavAll.filter(inUniverse);
  const reviews: ReviewItem[] = [];
  const reasons: string[] = [];

  // Gate: price sanity. Bad rows are dropped to review; the date is rejected if > 0.1% are bad (D125).
  const bad = equity.filter((r) => !saneRow(r));
  if (bad.length > Math.max(0, Math.floor(equity.length * 0.001))) reasons.push(`${bad.length} rows fail low<=open,close<=high or >0`);
  for (const r of bad) reviews.push({ kind: "bc_unparsed", subjectDb: "market", subjectRef: `price|${r.symbol}|${r.series}|${date}`, summary: `Bad OHLC row ${r.symbol} ${r.series} ${date}`, evidence: r });
  const good = equity.filter(saneRow);
  const goodAll = bhavAll.filter(saneRow); // every instrument, stored (D127)

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

  // Gate: row count within ±5% of the 20-session median (needs 20 sessions of history).
  const counts = await deps.market.all<{ n: number }>(
    `SELECT n FROM (SELECT p.trade_date, count(*) AS n FROM price_daily p JOIN security s ON s.security_id = p.security_id
       WHERE p.trade_date < ? AND s.kind = 'equity' AND p.series IN ('EQ','BE','BZ') GROUP BY p.trade_date ORDER BY p.trade_date DESC LIMIT 20)`, [date]);
  if (counts.length >= 20) {
    const sorted = counts.map((c) => c.n).sort((a, b) => a - b);
    const median = (sorted[9]! + sorted[10]!) / 2;
    if (Math.abs(good.length - median) / median > 0.05) reasons.push(`row count ${good.length} vs 20-session median ${median} (> ±5%)`);
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
    const key = `raw/${source}/${date}/${sha}`;
    await deps.raw.put(key, g.res.bytes, g.res.contentType);
    await deps.market.run(
      "INSERT OR IGNORE INTO source_file (source, file_date, url, sha256, bytes, fetched_at, r2_key) VALUES (?,?,?,?,?,?,?)",
      [source, date, g.url, sha, g.res.bytes.length, iso(deps.now()), key]);
    const [row] = await deps.market.all<{ file_id: number }>("SELECT file_id FROM source_file WHERE source=? AND file_date=? AND sha256=?", [source, date, sha]);
    fileIds[source] = row!.file_id;
  }

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
      secRows.push([sid, ob.name, ob.kind]);
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
  stmts.push(...insertRows(
    "INSERT INTO price_daily (security_id,trade_date,series,open,high,low,close,last,prev_close,volume,turnover_rs,trades,isin,file_id)", 14,
    rowsAll.map((r) => [secOf.get(r.symbol), date, r.series, r.open, r.high, r.low, r.close, r.last, r.prevClose, r.volume, r.turnoverRs, r.trades, r.isin, fileIds.udiff_bhavcopy]),
    "ON CONFLICT (security_id,trade_date,series) DO UPDATE SET open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,last=excluded.last,prev_close=excluded.prev_close,volume=excluded.volume,turnover_rs=excluded.turnover_rs,trades=excluded.trades,isin=excluded.isin,file_id=excluded.file_id"));
  // One shares row per security per day: prefer the EQ series' MCAP row.
  const bySec = new Map<number, unknown[]>();
  for (const r of [...rowsAll].sort((x, y) => (x.series === "EQ" ? 0 : 1) - (y.series === "EQ" ? 0 : 1))) {
    const sid = secOf.get(r.symbol)!;
    const m = mcapBy.get(`${r.symbol}|${r.series}`);
    if (m && !bySec.has(sid)) bySec.set(sid, [sid, date, m.issueSize, m.faceValue, m.mcapRs, "nse", fileIds.pr_bundle]);
  }
  const shareRowsUnique = [...bySec.values()];
  stmts.push(...insertRows("INSERT INTO shares_daily (security_id,trade_date,issue_size,face_value,mcap_rs,mcap_source,file_id)", 7, shareRowsUnique,
    "ON CONFLICT (security_id,trade_date) DO UPDATE SET issue_size=excluded.issue_size,face_value=excluded.face_value,mcap_rs=excluded.mcap_rs,mcap_source=excluded.mcap_source,file_id=excluded.file_id"));
  if (fileIds.delivery) {
    const dRows = delivery.filter((d) => secOf.has(d.symbol) && d.tradeDate === date)
      .map((d) => [secOf.get(d.symbol), date, d.series, d.deliverableQty, d.deliveryPct, fileIds.delivery]);
    stmts.push(...insertRows("INSERT INTO delivery_daily (security_id,trade_date,series,deliverable_qty,delivery_pct,file_id)", 6, dRows,
      "ON CONFLICT (security_id,trade_date,series) DO UPDATE SET deliverable_qty=excluded.deliverable_qty,delivery_pct=excluded.delivery_pct,file_id=excluded.file_id"));
  }
  if (fileIds.index_close) {
    const iRows = indices.filter((i) => i.tradeDate === date).map((i) => [i.indexName, date, i.open, i.high, i.low, i.close, i.pe, i.pb, i.divYield, fileIds.index_close]);
    stmts.push(...insertRows("INSERT INTO index_daily (index_name,trade_date,open,high,low,close,pe,pb,div_yield,file_id)", 10, iRows,
      "ON CONFLICT (index_name,trade_date) DO UPDATE SET open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,pe=excluded.pe,pb=excluded.pb,div_yield=excluded.div_yield,file_id=excluded.file_id"));
  }
  stmts.push({ sql: "INSERT OR REPLACE INTO trading_calendar (trade_date, is_session, note) VALUES (?, 1, NULL)", params: [date] });
  await batchAll(deps.market, stmts);

  // Corporate actions (D6, D7): record every Bc row; decide factors for actions whose ex-date is today.
  const bc = dedupeBc(pr.bc, new Set(pr.bc.map((r) => r.series))); // every series (D127); one row per symbol/ex-date/purpose
  const caStmts: Stmt[] = [];
  const todays = new Map<number, { purposes: string[]; comps: ReturnType<typeof parsePurpose>["components"] }>();
  const shareLike = new Set(rowsAll.filter((r) => ["equity", "etf", "reit", "invit"].includes(kindOf(r))).map((r) => r.symbol));
  for (const r of bc) {
    const sid = secOf.get(r.symbol);
    if (!sid) continue;
    if (!shareLike.has(r.symbol)) continue; // bonds/debentures/G-secs: their corporate actions don't adjust share prices
    const parsed = parsePurpose(r.purpose);
    const priceAffecting = affectsPrice(parsed);
    const status = parsed.unparsed.length ? "review" : "parsed";
    const type = typeOf(parsed.components);
    if ((type === "meeting" || parsed.components.every((c) => c.type === "debt_service" || c.type === "meeting")) && !parsed.unparsed.length) continue;
    const amount = parsed.components.filter((c) => c.type === "dividend").map((c) => (c as { amount: string }).amount).join("+") || null;
    caStmts.push({ sql: `INSERT INTO corp_action (security_id,ex_date,type,raw_purpose,amount,status,file_id) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT (security_id,ex_date,raw_purpose) DO NOTHING`, params: [sid, r.exDate, type, r.purpose, amount, status, fileIds.pr_bundle] });
    if (parsed.unparsed.length) reviews.push({ kind: "bc_unparsed", subjectDb: "market", subjectRef: `${r.symbol}|${r.exDate}|${r.purpose}`, summary: `Unparsed corporate action: ${r.symbol} ex ${r.exDate}: "${r.purpose}"`, evidence: { unparsed: parsed.unparsed } });
    if (r.exDate === date && (priceAffecting || parsed.unparsed.length)) {
      const t = todays.get(sid) ?? { purposes: [], comps: [] };
      t.purposes.push(r.purpose);
      t.comps.push(...parsed.components.filter((c) => c.type !== "dividend" && c.type !== "meeting"));
      if (parsed.unparsed.length) t.comps.push({ type: "capital_reduction" }); // force review: something unknown changes the price basis
      todays.set(sid, t);
    }
  }
  await batchAll(deps.market, caStmts);

  const prevDate = (await deps.market.all<{ d: string | null }>("SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND trade_date < ?", [date]))[0]?.d ?? null;
  const prevShares = new Map<number, number>();
  const prevClose = new Map<number, string>();
  const prevFv = new Map<number, string>();
  if (prevDate) {
    for (const r of await deps.market.all<{ security_id: number; issue_size: number; face_value: string | null }>("SELECT security_id, issue_size, face_value FROM shares_daily WHERE trade_date=?", [prevDate])) {
      prevShares.set(r.security_id, r.issue_size);
      if (r.face_value) prevFv.set(r.security_id, r.face_value);
    }
    for (const r of await deps.market.all<{ security_id: number; close: string; series: string }>("SELECT security_id, close, series FROM price_daily WHERE trade_date=? ORDER BY series='EQ'", [prevDate])) prevClose.set(r.security_id, r.close);
  }
  const todayShares = new Map<number, number>(shareRowsUnique.map((r) => [r[0] as number, r[2] as number]));
  const factorStmts: Stmt[] = [];
  for (const [sid, t] of todays) {
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
  }
  await batchAll(deps.market, factorStmts);

  // Review checks: unexplained share-count change > 2%, unexplained move > ±35% (§9.1).
  const factored = new Set(todays.keys());
  const universeSids = new Set(rows.map((r) => secOf.get(r.symbol)!));
  for (const [sid, n] of todayShares) {
    if (!universeSids.has(sid)) continue;
    const before = prevShares.get(sid);
    if (before && !factored.has(sid) && Math.abs(n - before) / before > 0.02) {
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
  await writeReviews(deps, reviews);

  return {
    date, status: "loaded",
    counts: { prices: rows.length, stored_all: rowsAll.length, shares: shareRowsUnique.length, delivery: fileIds.delivery ? delivery.length : 0, indices: fileIds.index_close ? indices.length : 0, corp_actions: caStmts.length, factors: factorStmts.length, new_securities: changes.filter((c) => c.kind === "new_security").length },
    reviews: reviews.length,
  };
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

/** Instrument type for storage (D127). Universe = 'equity' in EQ/BE/BZ. */
function kindOf(r: BhavRow): "equity" | "etf" | "reit" | "invit" | "other" {
  if (r.isin.startsWith("INF")) return "etf";
  if (r.series === "RR") return "reit";
  if (r.series === "IV") return "invit";
  if (r.isin.startsWith("INE") || r.isin.startsWith("IN9")) return "equity";
  return "other"; // government securities, bonds, etc.
}
