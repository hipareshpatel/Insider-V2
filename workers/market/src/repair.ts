// Factor repair (owner #271 follow-up, D134). Decides factors, with the same parser and rules as the daily job, for
// (1) actions in NSE's per-company lists that the Bc files omitted (corp_action_extra, market/0016) and (2) loaded
// actions that the current parser reads as price-affecting but that have no factor (rows loaded before a parser fix).
// Uses stored share counts and prices only (primary-key lookups); never re-runs old dates (FMEA A1).
import { type Sql, affectsPrice, batchAll, decideFactor, diso, dnum, fromPaise, parsePurpose, reviewUpsert } from "@disclo/core";
import { cleanRatio } from "./daily.js";

export const REPAIR_VERSION = "2026-11-03c"; // c: + rights entitlements, ETF unit-split proposals // bump after a parser change to re-run once

const ORDER = ["split", "consolidation", "bonus", "rights", "demerger", "capital_reduction", "dividend"];
const typeOf = (cs: readonly { type: string }[]) => ORDER.find((t) => cs.some((c) => c.type === t)) ?? "other";

export async function repairFactors(market: Sql, app: Sql, now: Date): Promise<{ moved: number; decided: number; reviews: number } | null> {
  if ((await market.all("SELECT 1 FROM pipeline_run WHERE pipeline='market.repair_factors' AND run_key=? AND status='ok' LIMIT 1", [REPAIR_VERSION])).length) return null;
  const [last] = await market.all<{ d: string | null }>("SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND universe_rows IS NOT NULL");
  if (!last?.d) return null;
  const nowIso = now.toISOString();

  // 1. Per-company-list actions into corp_action (symbol valid on the ex-date), for dates already loaded.
  const extras = await market.all<{ symbol: string; ex_date: string; purpose: string }>(
    "SELECT symbol, ex_date, purpose FROM corp_action_extra WHERE applied = 0 AND ex_date <= ?", [last.d]);
  let moved = 0;
  for (const x of extras) {
    const [sec] = await market.all<{ security_id: number }>(
      "SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=? AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?) LIMIT 1", [x.symbol, x.ex_date, x.ex_date]);
    if (sec) {
      const p = parsePurpose(x.purpose);
      const amount = p.components.filter((c) => c.type === "dividend").map((c) => (c as { amount: string }).amount).join("+") || null;
      await market.run(`INSERT INTO corp_action (security_id,ex_date,type,raw_purpose,amount,status,file_id) VALUES (?,?,?,?,?,?,NULL)
        ON CONFLICT (security_id,ex_date,raw_purpose) DO NOTHING`, [sec.security_id, x.ex_date, typeOf(p.components), x.purpose, amount, p.unparsed.length ? "review" : "parsed"]);
      moved++;
    }
    await market.run("UPDATE corp_action_extra SET applied = 1 WHERE symbol=? AND ex_date=? AND purpose=?", [x.symbol, x.ex_date, x.purpose]);
  }

  // 2. Every loaded action without a factor, read with the current parser.
  const rows = await market.all<{ ca_id: number; security_id: number; ex_date: string; raw_purpose: string; type: string; status: string }>(
    `SELECT c.ca_id, c.security_id, c.ex_date, c.raw_purpose, c.type, c.status FROM corp_action c
     WHERE c.ex_date <= ? AND c.status NOT IN ('confirmed','rejected')
       AND NOT EXISTS (SELECT 1 FROM adj_factor f WHERE f.security_id = c.security_id AND f.ex_date = c.ex_date)`, [last.d]);
  const groups = new Map<string, { sid: number; ex: string; comps: ReturnType<typeof parsePurpose>["components"]; purposes: string[]; unknown: boolean }>();
  for (const r of rows) {
    const p = parsePurpose(r.raw_purpose);
    const t = typeOf(p.components), st = p.unparsed.length ? "review" : "parsed";
    if (t !== r.type || st !== r.status) await market.run("UPDATE corp_action SET type=?, status=? WHERE ca_id=?", [t, st, r.ca_id]); // stale rows
    if (!affectsPrice(p) && !p.unparsed.length) continue;
    const k = `${r.security_id}|${r.ex_date}`;
    const g = groups.get(k) ?? { sid: r.security_id, ex: r.ex_date, comps: [], purposes: [], unknown: false };
    g.comps.push(...p.components.filter((c) => c.type !== "dividend" && c.type !== "meeting"));
    g.purposes.push(r.raw_purpose);
    if (p.unparsed.length) g.unknown = true;
    groups.set(k, g);
  }
  let decided = 0;
  const reviews: { sql: string; params: unknown[] }[] = [];
  for (const g of groups.values()) {
    if (g.unknown || !g.comps.length) continue; // still not understood: stays in review, no factor (A13)
    const [prev] = await market.all<{ d: string | null }>("SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND trade_date < ?", [g.ex]);
    if (!prev?.d) continue;
    const pD = dnum(prev.d)!, eD = dnum(g.ex)!;
    const [sb] = await market.all<{ issue_size: number; face_value_paise: number | null }>("SELECT issue_size, face_value_paise FROM shares_daily WHERE security_id=? AND d=?", [g.sid, pD]);
    const [se] = await market.all<{ issue_size: number }>("SELECT issue_size FROM shares_daily WHERE security_id=? AND d=?", [g.sid, eD]);
    const [pc] = await market.all<{ close: number }>("SELECT close FROM price_daily WHERE security_id=? AND d=? ORDER BY series='EQ' DESC LIMIT 1", [g.sid, pD]);
    const [po] = await market.all<{ open: number | null }>("SELECT open FROM price_daily WHERE security_id=? AND d=? ORDER BY series='EQ' DESC LIMIT 1", [g.sid, eD]);
    const d = decideFactor({
      exDate: g.ex, components: g.comps, sharesBefore: sb?.issue_size ?? null, sharesOnEx: se?.issue_size ?? null,
      prevClose: pc ? fromPaise(pc.close) : null, faceValue: sb?.face_value_paise != null ? fromPaise(sb.face_value_paise) : null,
      openOnEx: po?.open != null ? fromPaise(po.open) : null,
    });
    if (d.factor) {
      await market.run(`INSERT INTO adj_factor (security_id,ex_date,factor,method,status) VALUES (?,?,?,?,?)
        ON CONFLICT (security_id,ex_date) DO UPDATE SET factor=excluded.factor,method=excluded.method,status=excluded.status WHERE adj_factor.status <> 'confirmed'`,
        [g.sid, g.ex, d.factor, d.method, d.status]);
      decided++;
    }
    if (d.status === "review") reviews.push(reviewUpsert({ kind: "corp_action", subjectDb: "market", subjectRef: `${g.sid}|${g.ex}`, summary: `Corporate action needs review: ${g.purposes.join(" + ")} (${d.reason})`, proposed: d }, nowIso));
    if (d.status === "auto") {
      // The unexplained-change items for this security and date are now explained.
      reviews.push({ sql: "UPDATE review_item SET status='superseded', decided_at=? WHERE status='open' AND kind='corp_action' AND subject_ref IN (?, ?)", params: [nowIso, `shares|${g.sid}|${g.ex}`, `move|${g.sid}|${g.ex}`] });
    }
  }
  // 3. Rights entitlements (kind 'other', market/0017) are not shares: their move/share items are not corporate actions.
  for (const r of await market.all<{ security_id: number }>("SELECT security_id FROM security WHERE kind='other'"))
    for (const p of [`move|${r.security_id}|%`, `shares|${r.security_id}|%`])
      reviews.push({ sql: "UPDATE review_item SET status='superseded', decided_at=? WHERE status='open' AND kind='corp_action' AND subject_ref LIKE ?", params: [nowIso, p] });
  // 4. ETF history: day moves beyond ±35% with no factor → proposed unit-split factor for the owner (never auto).
  const etfs = await market.all<{ security_id: number }>("SELECT security_id FROM security WHERE kind='etf'");
  for (const e of etfs) {
    const px = await market.all<{ d: number; close: number }>("SELECT d, close FROM price_daily WHERE security_id=? AND series='EQ' ORDER BY d", [e.security_id]);
    for (let i = 1; i < px.length; i++) {
      const move = px[i]!.close / px[i - 1]!.close - 1;
      if (Math.abs(move) <= 0.35) continue;
      const ex = diso(px[i]!.d), f = cleanRatio(move);
      if ((await market.all("SELECT 1 FROM adj_factor WHERE security_id=? AND ex_date=?", [e.security_id, ex])).length) continue;
      if (f) await market.run("INSERT INTO adj_factor (security_id,ex_date,factor,method,status) VALUES (?,?,?,'price_ratio','review') ON CONFLICT (security_id,ex_date) DO NOTHING", [e.security_id, ex, f]);
      reviews.push(reviewUpsert({ kind: "corp_action", subjectDb: "market", subjectRef: `etfmove|${e.security_id}|${ex}`, summary: `ETF moved ${(move * 100).toFixed(1)}% on ${ex}: unit split?${f ? ` proposed factor ${f}` : ""}`, proposed: f ? { factor: f, method: "price_ratio", status: "review" } : undefined }, nowIso));
    }
  }
  if (reviews.length) await batchAll(app, reviews, 80);
  await market.run("INSERT INTO pipeline_run (pipeline, run_key, started_at, finished_at, status, detail) VALUES ('market.repair_factors', ?, ?, ?, 'ok', ?)",
    [REPAIR_VERSION, nowIso, new Date().toISOString(), JSON.stringify({ moved, candidates: groups.size, decided })]);
  return { moved, decided, reviews: reviews.length };
}
