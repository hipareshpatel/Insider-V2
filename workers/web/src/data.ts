// M3 site v0 read model (D151: facts only, each with its source and as-of). All reads go through the `Sql`
// interface so the same code runs on D1 and on the test databases built from the real migrations.
import type { Sql } from "@disclo/core";

export interface Dbs { market: Sql; filings: Sql; app: Sql }

const iso = (d: number | string) => { const s = String(d); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };
const num = (d: string) => Number(d.replaceAll("-", ""));
const rs = (paise: number | null) => (paise === null ? null : paise / 100);
const pct = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : Math.round((a / b - 1) * 10000) / 100); // % to 2 places
/** Equity-like series, in order of preference when a stock trades in more than one on a day. */
const SERIES = ["EQ", "BE", "BZ", "SM", "ST", "RR", "IV"];

/** The two latest loaded sessions (YYYY-MM-DD). */
export async function sessions(m: Sql): Promise<string[]> {
  return (await m.all<{ trade_date: string }>("SELECT trade_date FROM trading_calendar WHERE is_session=1 AND universe_rows IS NOT NULL ORDER BY trade_date DESC LIMIT 2")).map((r) => r.trade_date);
}

export const KEY_INDICES = ["NIFTY 50", "NIFTY NEXT 50", "NIFTY 100", "NIFTY 500", "NIFTY MIDCAP 150", "NIFTY SMALLCAP 250", "NIFTY MICROCAP 250", "NIFTY BANK", "NIFTY IT", "NIFTY FMCG", "NIFTY PHARMA", "NIFTY AUTO", "NIFTY METAL", "NIFTY REALTY", "NIFTY ENERGY", "NIFTY FINANCIAL SERVICES"];

export async function dashboard(db: Dbs) {
  const m = db.market;
  const [s0, s1] = await sessions(m);
  if (!s0) return { as_of: null };
  const d0 = num(s0), d1 = s1 ? num(s1) : null;
  const marks = KEY_INDICES.map(() => "?").join(",");
  // Independent reads run together (one round trip each, in parallel).
  const [idx, hist, rows, exRows, sectors, fii, oiDay, banDay, surv, dealDays, symRows] = await Promise.all([
    // Indices: latest two sessions; P/E percentile vs the index's own history in our data (2024 →).
    m.all<{ index_name: string; d: number; close: string; pe: string | null; pb: string | null; div_yield: string | null }>(
      "SELECT index_name, d, close, pe, pb, div_yield FROM index_daily WHERE d IN (?, ?) ORDER BY index_name", [d0, d1 ?? d0]),
    m.all<{ index_name: string; below: number; n: number; first: number }>(
      `SELECT h.index_name, sum(CAST(h.pe AS REAL) < CAST(t.pe AS REAL)) AS below, count(*) AS n, min(h.d) AS first FROM index_daily h
       JOIN index_daily t ON t.index_name = h.index_name AND t.d = ? WHERE h.index_name IN (${marks}) AND h.pe IS NOT NULL AND t.pe IS NOT NULL GROUP BY h.index_name`, [d0, ...KEY_INDICES]),
    // Breadth + movers from the latest session (equity series; prev_close as published, D26: not adjusted, so an
    // ex-date of a split shows as a fall — those securities are excluded from movers using today's factors).
    m.all<{ security_id: number; series: string; close: number; prev_close: number | null; turnover_paise: number | null; kind: string; name: string }>(
      `SELECT p.security_id, p.series, p.close, p.prev_close, p.turnover_paise, s.kind, s.name FROM price_daily p JOIN security s ON s.security_id = p.security_id
       WHERE p.d = ? AND p.series IN (${SERIES.map(() => "?").join(",")})`, [d0, ...SERIES]),
    m.all<{ security_id: number }>("SELECT security_id FROM adj_factor WHERE ex_date = ?", [s0]),
    // Sector moves: equal-weighted average of members' change (sector = latest classification, D121/D150).
    m.all<{ security_id: number; sector: string | null }>(
      "SELECT c.security_id, c.sector FROM classification c JOIN (SELECT security_id, max(as_of) AS a FROM classification GROUP BY security_id) l ON l.security_id = c.security_id AND l.a = c.as_of"),
    m.all<{ d: number; category: string; buy_cr: string; sell_cr: string; net_cr: string }>("SELECT d, category, buy_cr, sell_cr, net_cr FROM fii_dii ORDER BY d DESC LIMIT 20"),
    m.all<{ d: number }>("SELECT max(d) AS d FROM fo_oi_participant"),
    m.all<{ d: number }>("SELECT max(d) AS d FROM fo_ban"),
    m.all<{ list: string; stage: string; n: number }>("SELECT list, stage, count(*) AS n FROM surveillance WHERE valid_to IS NULL GROUP BY list, stage ORDER BY list, stage"),
    // deal's key starts with kind: latest day per kind uses the key (a plain max(d) scans the table)
    m.all<{ d: number | null }>("SELECT max(d) AS d FROM deal WHERE kind='bulk' UNION ALL SELECT max(d) FROM deal WHERE kind='block'"),
    m.all<{ security_id: number; value: string }>("SELECT security_id, value FROM security_identifier WHERE id_type='nse_symbol' AND valid_to IS NULL"),
  ]);
  const pctl = new Map(hist.map((h) => [h.index_name, { pe_percentile: Math.round((h.below / h.n) * 100), since: iso(h.first) }]));
  const byName = new Map<string, { today?: (typeof idx)[number]; prev?: (typeof idx)[number] }>();
  for (const r of idx) { const e = byName.get(r.index_name) ?? {}; if (r.d === d0) e.today = r; else e.prev = r; byName.set(r.index_name, e); }
  const indices = [...byName.entries()].filter(([, e]) => e.today).map(([name, e]) => ({
    name, key: KEY_INDICES.includes(name), close: Number(e.today!.close), change_pct: e.prev ? pct(Number(e.today!.close), Number(e.prev.close)) : null,
    pe: e.today!.pe, pb: e.today!.pb, div_yield: e.today!.div_yield, ...(pctl.get(name) ?? {}),
  }));
  const exToday = new Set(exRows.map((r) => r.security_id));
  const eq = rows.filter((r) => r.kind === "equity" && r.prev_close);
  const adv = eq.filter((r) => r.close > r.prev_close!).length, dec = eq.filter((r) => r.close < r.prev_close!).length;
  const sym = new Map(symRows.map((r) => [r.security_id, r.value]));
  const liquid = eq.filter((r) => !exToday.has(r.security_id) && (r.turnover_paise ?? 0) >= 1e9) // ≥ ₹1 crore traded
    .map((r) => ({ symbol: sym.get(r.security_id) ?? null, name: r.name, close: rs(r.close), change_pct: pct(r.close, r.prev_close) }))
    .sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
  const secOf = new Map(sectors.map((x) => [x.security_id, x.sector ?? "Unclassified"]));
  const agg = new Map<string, { n: number; sum: number; up: number }>();
  for (const r of eq) {
    if (exToday.has(r.security_id)) continue;
    const sct = secOf.get(r.security_id); if (!sct) continue;
    const a = agg.get(sct) ?? { n: 0, sum: 0, up: 0 }; a.n++; a.sum += pct(r.close, r.prev_close)!; if (r.close > r.prev_close!) a.up++; agg.set(sct, a);
  }
  const oiD = oiDay[0]?.d, banD = banDay[0]?.d, dealD = Math.max(0, ...dealDays.map((x) => x.d ?? 0)) || null;
  const [oi, banRows, deals] = await Promise.all([
    oiD ? m.all<Record<string, number | string>>("SELECT * FROM fo_oi_participant WHERE d = ?", [oiD]) : Promise.resolve([]),
    banD ? m.all<{ symbol: string }>("SELECT symbol FROM fo_ban WHERE d = ? ORDER BY symbol", [banD]) : Promise.resolve([]),
    dealD ? m.all<{ kind: string; symbol: string; client: string; side: string; qty: number; price_paise: number }>(
      "SELECT kind, symbol, client, side, qty, price_paise FROM deal WHERE kind IN ('bulk','block') AND d = ? ORDER BY qty * price_paise DESC LIMIT 15", [dealD]) : Promise.resolve([]),
  ]);
  const ban = banRows.map((r) => r.symbol);
  const oiDay0 = oiD, banDay0 = banD, dealDay0 = dealD;
  return {
    as_of: s0, previous_session: s1 ?? null, source: "NSE end-of-day files (bhavcopy, index closes, NSCCL, NSE API lists)",
    indices,
    breadth: { advances: adv, declines: dec, unchanged: eq.length - adv - dec, universe: eq.length },
    movers: { gainers: liquid.slice(0, 10), losers: liquid.slice(-10).reverse(), rule: "equity series, turnover ≥ ₹1 crore, no corporate-action ex-date today" },
    sectors: [...agg.entries()].map(([sector, a]) => ({ sector, companies: a.n, avg_change_pct: Math.round((a.sum / a.n) * 100) / 100, advancing: a.up })).sort((a, b) => b.avg_change_pct - a.avg_change_pct),
    fii_dii: fii.map((r) => ({ date: iso(r.d), category: r.category, buy_cr: r.buy_cr, sell_cr: r.sell_cr, net_cr: r.net_cr })),
    fo_participant_oi: { as_of: oiDay0 ? iso(oiDay0) : null, rows: oi.map(({ d: _d, ...rest }) => rest) },
    fo_ban: { as_of: banDay0 ? iso(banDay0) : null, symbols: ban },
    surveillance: surv,
    deals: { as_of: dealDay0 ? iso(dealDay0) : null, top: deals.map((x) => ({ ...x, price: rs(x.price_paise), value_cr: (x.qty * x.price_paise) / 1e9 })) },
  };
}

/** Search list: every security with a current NSE symbol (the site searches it in the browser). */
export async function securities(m: Sql) {
  return m.all<{ symbol: string; name: string; kind: string }>(
    "SELECT i.value AS symbol, s.name, s.kind FROM security_identifier i JOIN security s ON s.security_id = i.security_id WHERE i.id_type='nse_symbol' AND i.valid_to IS NULL ORDER BY i.value");
}

const PL_LINES = ["revenue", "total_income", "interest_earned", "gross_premium", "net_premium", "pbt", "pat", "eps_basic", "operating_profit", "net_interest_income"];

export async function stock(db: Dbs, symbol: string, timing: string[] = []) {
  const m = db.market;
  let t = Date.now();
  const lap = (name: string) => { const n = Date.now(); timing.push(`${name};dur=${n - t}`); t = n; };
  const [id] = await m.all<{ security_id: number }>(
    "SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value=? ORDER BY valid_to IS NULL DESC, valid_from DESC LIMIT 1", [symbol]);
  if (!id) return null;
  lap("id");
  const sid = id.security_id;
  const f = db.filings;
  // Round trip 2: every read that needs only the security id, in parallel.
  const [secR, ids, clsR, idxR, raw, factors, breakR, shR, actions, fin, shpR] = await Promise.all([
    m.all<{ name: string; kind: string; listed_on: string | null; delisted_on: string | null }>("SELECT name, kind, listed_on, delisted_on FROM security WHERE security_id=?", [sid]),
    m.all<{ id_type: string; value: string; valid_from: string; valid_to: string | null }>("SELECT id_type, value, valid_from, valid_to FROM security_identifier WHERE security_id=? ORDER BY id_type, valid_from", [sid]),
    m.all<{ as_of: string; sector: string | null; industry_detail: string | null; sector_source: string; source_ref: string }>(
      "SELECT as_of, sector, industry_detail, sector_source, source_ref FROM classification WHERE security_id=? ORDER BY as_of DESC LIMIT 1", [sid]),
    m.all<{ index_name: string }>("SELECT index_name FROM index_membership WHERE security_id=? AND valid_to IS NULL ORDER BY index_name", [sid]),
    // Prices: one row per day (preferred series), adjusted by applied factors only (auto/confirmed), never by proposals.
    m.all<{ d: number; series: string; open: number | null; high: number | null; low: number | null; close: number; volume: number }>(
      "SELECT d, series, open, high, low, close, volume FROM price_daily WHERE security_id=? ORDER BY d", [sid]),
    m.all<{ ex_date: string; factor: string; method: string; status: string }>("SELECT ex_date, factor, method, status FROM adj_factor WHERE security_id=? ORDER BY ex_date", [sid]),
    db.app.all<{ subject_ref: string }>(
      "SELECT subject_ref FROM review_item WHERE status='rejected' AND substr(subject_ref, 1, ?) = ? AND instr(decision, 'Series break') > 0", [String(sid).length + 1, `${sid}|`]),
    m.all<{ d: number; issue_size: number; mcap_paise: number | null; mcap_source: string; face_value_paise: number | null }>(
      "SELECT d, issue_size, mcap_paise, mcap_source, face_value_paise FROM shares_daily WHERE security_id=? ORDER BY d DESC LIMIT 1", [sid]),
    m.all<{ ex_date: string; type: string; raw_purpose: string; status: string }>("SELECT ex_date, type, raw_purpose, status FROM corp_action WHERE security_id=? ORDER BY ex_date DESC LIMIT 40", [sid]),
    // Financials (filings DB): key P&L, balance-sheet and cash-flow lines, both bases, original and restated apart (D48).
    f.all<{ statement: string; line: string; period_end: string; period_kind: string; basis: string; version: string; value: string | null; disclosed_at: string; template: string; filing_id: number }>(
      `SELECT statement, line, period_end, period_kind, basis, version, value, disclosed_at, template, filing_id FROM fin_value
       WHERE security_id=? AND dims='' AND ((statement='pl' AND line IN (${PL_LINES.map(() => "?").join(",")})) OR (statement='bs' AND line IN ('total_assets','total_equity','shareholders_funds','borrowings_noncurrent','borrowings_current','cash')) OR (statement='cf' AND line IN ('cfo','cfi','cff')))
       ORDER BY period_end DESC, disclosed_at`, [sid, ...PL_LINES]),
    f.all<{ as_of: string; filing_id: number }>("SELECT as_of, filing_id FROM shareholding WHERE security_id=? ORDER BY as_of DESC LIMIT 1", [sid]),
  ]);
  lap("main");
  const sec = secR[0], cls = clsR[0], sh = shR[0], shpDay = shpR[0];
  const indices = idxR.map((r) => r.index_name);
  const day = new Map<number, (typeof raw)[number]>();
  for (const r of raw) { const o = day.get(r.d); if (!o || SERIES.indexOf(r.series) < SERIES.indexOf(o.series)) day.set(r.d, r); }
  const applied = factors.filter((x) => x.status !== "review");
  const breaks = breakR.map((r) => r.subject_ref.split("|")[1]!).sort();
  const lastBreak = breaks.at(-1) ?? null;
  const days = [...day.values()].filter((r) => !lastBreak || iso(r.d) >= lastBreak); // charts never join across a break (D146)
  const mult = (date: string) => applied.reduce((p, x) => (x.ex_date > date ? p * Number(x.factor) : p), 1);
  const prices = days.map((r) => { const k = mult(iso(r.d)); return { date: iso(r.d), open: r.open === null ? null : (r.open / 100) * k, high: r.high === null ? null : (r.high / 100) * k, low: r.low === null ? null : (r.low / 100) * k, close: (r.close / 100) * k, volume: r.volume, series: r.series }; });
  const last = days.at(-1);
  // Round trip 3: reads that depend on round trip 2, in parallel.
  const filingIds = [...new Set(fin.map((r) => r.filing_id))];
  const parts: number[][] = [];
  for (let i = 0; i < filingIds.length; i += 80) parts.push(filingIds.slice(i, i + 80));
  const sym = ids.filter((i) => i.id_type === "nse_symbol").map((i) => i.value);
  const marksS = sym.map(() => "?").join(",");
  const [dlR, srcParts, shp, insider, meetings, ratings] = await Promise.all([
    last ? m.all<{ deliverable_qty: number | null }>("SELECT deliverable_qty FROM delivery_daily WHERE security_id=? AND d=? AND series=?", [sid, last.d, last.series]) : Promise.resolve([]),
    Promise.all(parts.map((part) => f.all<{ filing_id: number; source_url: string }>(`SELECT filing_id, source_url FROM filing WHERE filing_id IN (${part.map(() => "?").join(",")})`, part))),
    shpDay ? f.all<{ category: string; shares: number | null; pct: string | null }>("SELECT category, shares, pct FROM shareholding WHERE filing_id=? AND holder_name='' ORDER BY category", [shpDay.filing_id]) : Promise.resolve([]),
    f.all<Record<string, unknown>>(`SELECT person, category, txn, mode, qty, value_rs, from_d, to_d, disclosed_at FROM insider_trade WHERE symbol IN (${marksS}) ORDER BY disclosed_at DESC LIMIT 15`, sym),
    f.all<Record<string, unknown>>(`SELECT meeting_d, purpose, announced_at FROM board_meeting WHERE symbol IN (${marksS}) ORDER BY meeting_d DESC LIMIT 8`, sym),
    f.all<Record<string, unknown>>(`SELECT agency, rating, outlook, action, rated_on, disclosed_at FROM credit_rating WHERE symbol IN (${marksS}) ORDER BY rated_on DESC LIMIT 8`, sym),
  ]);
  lap("detail");
  const dl = dlR[0];
  const src = new Map<number, string>(srcParts.flat().map((r) => [r.filing_id, r.source_url]));
  const periods = new Map<string, { period_end: string; period_kind: string; basis: string; template: string; lines: Record<string, string | null>; restated: Record<string, string | null>; disclosed_at: string; source: string | null }>();
  for (const r of fin) {
    const k = `${r.statement}|${r.period_end}|${r.period_kind}|${r.basis}`;
    const p = periods.get(k) ?? { period_end: r.period_end, period_kind: r.period_kind, basis: r.basis, template: r.template, lines: {}, restated: {}, disclosed_at: r.disclosed_at, source: src.get(r.filing_id) ?? null };
    if (r.version === "original") { if (!(r.line in p.lines)) p.lines[r.line] = r.value; }
    else p.restated[r.line] = r.value; // latest restatement wins (ordered by disclosed_at)
    periods.set(k, p);
  }
  const group = (st: string) => [...periods.entries()].filter(([k]) => k.startsWith(st + "|")).map(([, v]) => v);
  return {
    symbol, name: sec?.name ?? symbol, kind: sec?.kind, listed_on: sec?.listed_on ?? null, delisted_on: sec?.delisted_on ?? null,
    identifiers: ids,
    classification: cls ? { ...cls, label: cls.sector_source === "index_csv" ? "NSE index list" : cls.sector_source === "announcement_map" ? "from NSE announcement industry (mapped, D150)" : "unclassified" } : null,
    indices,
    quote: last ? { date: iso(last.d), close: last.close / 100, series: last.series, volume: last.volume, delivery_pct: dl?.deliverable_qty != null && last.volume ? (dl.deliverable_qty / last.volume) * 100 : null, source: "NSE bhavcopy" } : null,
    shares: sh ? { date: iso(sh.d), issue_size: sh.issue_size, mcap_cr: sh.mcap_paise === null ? null : sh.mcap_paise / 1e9, mcap_source: sh.mcap_source, face_value: sh.face_value_paise === null ? null : sh.face_value_paise / 100 } : null,
    prices: { adjusted_by: applied.map((x) => ({ ex_date: x.ex_date, factor: x.factor, method: x.method })), pending_review: factors.filter((x) => x.status === "review").length, series_breaks: breaks, starts_after_break: lastBreak, rows: prices },
    corporate_actions: actions,
    financials: { pl: group("pl"), bs: group("bs"), cf: group("cf"), unit: "₹ (rupees, as filed)", note: "Original = earliest disclosure; restated values shown separately (D48)." },
    shareholding: shpDay ? { as_of: shpDay.as_of, categories: shp } : null,
    insider_trades: insider, board_meetings: meetings, credit_ratings: ratings,
  };
}

export async function health(db: Dbs) {
  const m = db.market, f = db.filings, a = db.app;
  const [s, market_runs, market_structure, filings_loader, review_queue_open, sectors] = await Promise.all([
    sessions(m),
    m.all("SELECT pipeline, run_key, status, started_at, finished_at FROM pipeline_run ORDER BY run_id DESC LIMIT 10"),
    m.all("SELECT source, max(d) AS last_day, sum(rows < 0) AS missing_days FROM ms_day GROUP BY source ORDER BY source"),
    f.all("SELECT status, count(*) AS n FROM fin_load GROUP BY status ORDER BY status"),
    a.all("SELECT kind, count(*) AS n FROM review_item WHERE status='open' GROUP BY kind ORDER BY kind"),
    m.all("SELECT sector_source AS source, count(*) AS companies FROM (SELECT c.sector_source FROM classification c JOIN (SELECT security_id, max(as_of) AS a FROM classification GROUP BY security_id) l ON l.security_id = c.security_id AND l.a = c.as_of) GROUP BY 1"),
  ]);
  return { latest_session: s[0] ?? null, market_runs, market_structure, filings_loader, review_queue_open, sectors };
}
