// D150 sector history, built continuously (owner #291). Reads the NSE announcement lists already stored in R2 (never
// NSE): each row carries the company's ISIN and NSE's finer industry (smIndustry). Every (ISIN, smIndustry) pair is
// kept with its first and last sighting. The approved map (sector_map) turns smIndustry into one of the 22 sectors.
// Precedence (D121): the index CSV sector comes first for Total Market members from our first index snapshot on;
// announcement rows fill everyone else, and the time before that first snapshot. A value not in the map is never
// guessed: the company is recorded as Unclassified ('none') and the value is added to sector_map as 'unmapped'.
import { type Sql, type Stmt, batchAll, insertRows } from "@disclo/core";
import { r2Text } from "./structure.js";

const PREFIXES = ["api/announcements/", "api/bulk/announcements/"];
const INDEX = "NIFTY TOTAL MARKET";

export interface Seen { isin: string; ind: string; first: string; last: string; ref: string; symbol: string }

/** All (ISIN, smIndustry) pairs in one announcement list, with first/last sort_date and the first seq id. */
export function industryPairs(json: string): { rows: number; pairs: Seen[] } {
  const d = JSON.parse(json) as unknown;
  const rows = (Array.isArray(d) ? d : ((d as { data?: unknown[] }).data ?? [])) as Record<string, unknown>[];
  const out = new Map<string, Seen>();
  for (const r of rows) {
    const isin = String(r.sm_isin ?? "").trim(), ind = String(r.smIndustry ?? "").trim(), at = String(r.sort_date ?? "").trim();
    if (!/^IN[A-Z0-9]{10}$/.test(isin) || !ind || ind === "-" || !/^\d{4}-\d{2}-\d{2}/.test(at)) continue;
    const k = `${isin}|${ind}`, o = out.get(k), ref = String(r.seq_id ?? ""), symbol = String(r.symbol ?? "").trim();
    if (!o) out.set(k, { isin, ind, first: at, last: at, ref, symbol });
    else { if (at < o.first) { o.first = at; o.ref = ref; } if (at > o.last) { o.last = at; if (symbol) o.symbol = symbol; } }
  }
  return { rows: rows.length, pairs: [...out.values()] };
}

export interface SectorDeps { market: Sql; raw: R2Bucket; today: string }
export interface SectorReport { files: number; pairs: number; newValues: string[]; inserted: number; classified: boolean }

/** Read announcement list files not read before (within budget), then rebuild the classification rows if anything changed. */
export async function buildSectors(deps: SectorDeps, budgetMs: number): Promise<SectorReport> {
  const t0 = Date.now(), m = deps.market;
  const rep: SectorReport = { files: 0, pairs: 0, newValues: [], inserted: 0, classified: false };
  const read = new Set((await m.all<{ r2_key: string }>("SELECT r2_key FROM sector_file")).map((r) => r.r2_key));
  const todo: string[] = [];
  for (const prefix of PREFIXES) {
    let cursor: string | undefined;
    do {
      const l = await deps.raw.list({ prefix, cursor, limit: 1000 });
      for (const o of l.objects) if (!read.has(o.key)) todo.push(o.key);
      cursor = l.truncated ? l.cursor : undefined;
    } while (cursor);
  }
  const known = new Set((await m.all<{ sm_industry: string }>("SELECT sm_industry FROM sector_map")).map((r) => r.sm_industry));
  for (const key of todo.sort()) {
    if (Date.now() - t0 > budgetMs) break;
    const t = await r2Text(deps.raw, key);
    if (t === null) continue;
    let parsed: ReturnType<typeof industryPairs>;
    try { parsed = industryPairs(t); } catch { parsed = { rows: -1, pairs: [] }; } // not JSON: recorded, never retried silently
    const stmts: Stmt[] = insertRows("INSERT INTO industry_seen (isin, sm_industry, first_at, last_at, first_ref, symbol)", 6,
      parsed.pairs.map((p) => [p.isin, p.ind, p.first, p.last, p.ref, p.symbol || null]),
      ` ON CONFLICT (isin, sm_industry) DO UPDATE SET first_at = min(first_at, excluded.first_at),
        first_ref = CASE WHEN excluded.first_at < first_at THEN excluded.first_ref ELSE first_ref END, last_at = max(last_at, excluded.last_at),
        symbol = CASE WHEN excluded.last_at >= last_at OR symbol IS NULL THEN coalesce(excluded.symbol, symbol) ELSE symbol END
        WHERE excluded.first_at < industry_seen.first_at OR excluded.last_at > industry_seen.last_at OR (industry_seen.symbol IS NULL AND excluded.symbol IS NOT NULL)`);
    for (const p of parsed.pairs) if (!known.has(p.ind)) {
      known.add(p.ind); rep.newValues.push(p.ind);
      stmts.push({ sql: "INSERT OR IGNORE INTO sector_map (sm_industry, sector, map_version, status, first_seen, first_ref) VALUES (?, NULL, NULL, 'unmapped', ?, ?)", params: [p.ind, p.first, p.ref] });
    }
    stmts.push({ sql: "INSERT OR REPLACE INTO sector_file (r2_key, rows, pairs, read_at) VALUES (?, ?, ?, ?)", params: [key, parsed.rows, parsed.pairs.length, deps.today] });
    await batchAll(m, stmts);
    rep.files++; rep.pairs += parsed.pairs.length;
  }
  const caughtUp = rep.files === todo.length;
  const [ran] = await m.all<{ n: number }>("SELECT count(*) AS n FROM pipeline_run WHERE pipeline='market.sectors' AND run_key=?", [deps.today]);
  // Classify when caught up and either new files were read or not yet today (map or index changes).
  if (caughtUp && (rep.files > 0 || !ran?.n)) {
    rep.inserted = await classify(m, deps.today);
    rep.classified = true;
    await m.run("INSERT INTO pipeline_run (pipeline, run_key, started_at, finished_at, status, detail) VALUES ('market.sectors', ?, ?, ?, 'ok', ?)",
      [deps.today, new Date(t0).toISOString(), new Date().toISOString(), JSON.stringify({ files: rep.files, pairs: rep.pairs, new_values: rep.newValues, inserted: rep.inserted })]);
  }
  return rep;
}

interface Row { asOf: string; sector: string | null; detail: string | null; source: string; ref: string }
const same = (a: Row | undefined, b: Row) => !!a && a.sector === b.sector && a.detail === b.detail && a.source === b.source;

/** Desired announcement rows per security, inserted only where they change what the security's history says. */
export function plan(input: {
  today: string;
  pairs: { ind: string; first: string; last: string; ref: string }[];
  map: Map<string, { sector: string | null; status: string; version: string | null }>;
  existing: Row[];               // this security's classification rows
  member: boolean;               // in the Total Market list now
  ended: string | null;          // latest valid_to of a past membership
}): Row[] {
  const { today, map } = input;
  if (!input.pairs.length) return [];
  const value = (p: { ind: string; first: string; ref: string }, asOf: string): Row => {
    const mm = map.get(p.ind), mapped = !!mm && mm.status !== "unmapped";
    return { asOf, sector: mapped ? mm!.sector : null, detail: p.ind, source: mapped ? "announcement_map" : "none", ref: `smIndustry seq ${p.ref}${mapped ? ` map ${mm!.version}` : " (unmapped)"}` };
  };
  const byFirst = [...input.pairs].sort((a, b) => a.first.localeCompare(b.first));
  const cur = [...input.pairs].sort((a, b) => b.last.localeCompare(a.last))[0]!;
  const points: Row[] = byFirst.map((p) => value(p, p.first.slice(0, 10)));
  if (input.member || input.ended) {
    const idxFirst = input.existing.filter((r) => r.source === "index_csv").map((r) => r.asOf).sort()[0] ?? null;
    const cut = idxFirst ?? today;
    const before = points.filter((p) => p.asOf < cut);
    if (!input.member && input.ended) before.push(value(cur, input.ended)); // left the index: the announcement value resumes
    points.splice(0, points.length, ...before);
  } else points.push(value(cur, today)); // also catches a later map decision for the current value
  // Merge with existing rows in date order; keep a point only if it changes the history at that date.
  const out: Row[] = [];
  const all = [...input.existing.map((r) => ({ r, mine: false })), ...points.map((r) => ({ r, mine: true }))]
    .sort((a, b) => a.r.asOf.localeCompare(b.r.asOf) || (a.mine ? 1 : -1));
  const taken = new Set(input.existing.map((r) => r.asOf));
  let prev: Row | undefined;
  for (const { r, mine } of all) {
    if (mine) {
      if (taken.has(r.asOf) || same(prev, r)) continue;
      taken.add(r.asOf); out.push(r);
    }
    prev = r;
  }
  return out;
}

async function classify(m: Sql, today: string): Promise<number> {
  const map = new Map((await m.all<{ sm_industry: string; sector: string | null; status: string; map_version: string | null }>(
    "SELECT sm_industry, sector, status, map_version FROM sector_map")).map((r) => [r.sm_industry, { sector: r.sector, status: r.status, version: r.map_version }]));
  const isin = new Map<string, number>();
  for (const r of await m.all<{ value: string; security_id: number }>("SELECT value, security_id FROM security_identifier WHERE id_type='isin'")) isin.set(r.value, r.security_id);
  // Stale ISINs on announcements (C42): fall back to the NSE symbol valid on the last sighting.
  const syms = new Map<string, { security_id: number; valid_from: string; valid_to: string | null }[]>();
  for (const r of await m.all<{ value: string; security_id: number; valid_from: string; valid_to: string | null }>("SELECT value, security_id, valid_from, valid_to FROM security_identifier WHERE id_type='nse_symbol'")) {
    const l = syms.get(r.value) ?? []; l.push(r); syms.set(r.value, l);
  }
  const bySymbol = (sym: string | null, at: string) => {
    const d = at.slice(0, 10), l = sym ? syms.get(sym) : undefined;
    return l?.find((r) => r.valid_from <= d && (!r.valid_to || r.valid_to >= d))?.security_id;
  };
  const pairs = new Map<number, { ind: string; first: string; last: string; ref: string }[]>();
  for (const s of await m.all<{ isin: string; sm_industry: string; first_at: string; last_at: string; first_ref: string; symbol: string | null }>("SELECT isin, sm_industry, first_at, last_at, first_ref, symbol FROM industry_seen")) {
    const sid = isin.get(s.isin) ?? bySymbol(s.symbol, s.last_at);
    if (sid === undefined) continue;
    const l = pairs.get(sid) ?? []; l.push({ ind: s.sm_industry, first: s.first_at, last: s.last_at, ref: s.first_ref }); pairs.set(sid, l);
  }
  const existing = new Map<number, Row[]>();
  for (const c of await m.all<{ security_id: number; as_of: string; sector: string | null; industry_detail: string | null; sector_source: string; source_ref: string }>(
    "SELECT security_id, as_of, sector, industry_detail, sector_source, source_ref FROM classification")) {
    const l = existing.get(c.security_id) ?? []; l.push({ asOf: c.as_of, sector: c.sector, detail: c.industry_detail, source: c.sector_source, ref: c.source_ref }); existing.set(c.security_id, l);
  }
  const member = new Set<number>(), ended = new Map<number, string>();
  for (const r of await m.all<{ security_id: number; valid_to: string | null }>("SELECT security_id, valid_to FROM index_membership WHERE index_name=?", [INDEX])) {
    if (r.valid_to === null) member.add(r.security_id);
    else if ((ended.get(r.security_id) ?? "") < r.valid_to) ended.set(r.security_id, r.valid_to);
  }
  const ins: unknown[][] = [];
  for (const [sid, ps] of pairs) {
    for (const r of plan({ today, pairs: ps, map, existing: existing.get(sid) ?? [], member: member.has(sid), ended: member.has(sid) ? null : ended.get(sid) ?? null }))
      ins.push([sid, r.asOf, r.sector, r.detail, r.source, r.ref]);
  }
  await batchAll(m, insertRows("INSERT OR IGNORE INTO classification (security_id, as_of, sector, industry_detail, sector_source, source_ref)", 6, ins));
  return ins.length;
}
