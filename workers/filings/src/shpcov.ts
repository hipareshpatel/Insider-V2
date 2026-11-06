// Work list 2.8 (item 4): shareholding coverage of the 250 vs NSE's own lists. Read-only. Per company: the stored
// per-company shareholding lists (kind 'shareholding') → every listed XBRL with its as-of quarter end; from the
// D168 floor, each is matched to its download (fetch_job), load outcome (fin_load) and stored filing.
import { type Sql, parseShareholding, parseXbrl } from "@disclo/core";

const ARCHIVE = /https:\/\/nsearchives\.nseindia\.com\/corporate\/[^"\s\\]+?\.xml/gi;
const MON: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
const QE = /^(31-MAR|30-JUN|30-SEP|31-DEC)-\d{4}$/i;

/** (XBRL URL, as-of quarter end) of every row of NSE shareholding lists; the as-of date is the row's quarter-end date
 *  field (DD-MON-YYYY), whatever its name. Rows without an XBRL link are counted as `noXbrl`. */
export function shpListed(listJsons: string[]): { rows: { url: string; asOf: string | null }[]; noXbrl: string[]; keys: string[] } {
  const seen = new Map<string, string | null>(), noXbrl: string[] = [];
  let keys: string[] = [];
  for (const t of listJsons) {
    let d: unknown; try { d = JSON.parse(t); } catch { continue; }
    const arr = (Array.isArray(d) ? d : ((d as { data?: unknown[] }).data ?? [])) as Record<string, unknown>[];
    for (const r of arr) {
      if (!keys.length) keys = Object.keys(r);
      const q = Object.values(r).map((v) => String(v ?? "").trim().slice(0, 11)).find((v) => QE.test(v));
      const asOf = q ? `${q.slice(7, 11)}-${MON[q.slice(3, 6).toUpperCase()]}-${q.slice(0, 2)}` : null;
      const urls = JSON.stringify(r).match(ARCHIVE) ?? [];
      if (!urls.length) { if (asOf) noXbrl.push(asOf); continue; }
      for (const u of urls) if (!seen.has(u)) seen.set(u, asOf);
    }
  }
  return { rows: [...seen].map(([url, asOf]) => ({ url, asOf })), noXbrl, keys };
}

export const SQL_SHP_LISTS = "SELECT r2_key FROM fetch_job WHERE symbol IN (SELECT value FROM json_each(?)) AND kind='shareholding' AND status='done'";
export const SQL_SHP_FILES = `SELECT j.url, j.status, j.http_status, l.status AS load, l.detail, f.period_end AS stored
  FROM fetch_job j LEFT JOIN fin_load l ON l.job_id = j.job_id LEFT JOIN filing f ON f.kind = 'shareholding' AND f.source_url = j.url
  WHERE j.url IN (SELECT value FROM json_each(?))`;

export async function shpCoverage(db: Sql, getText: (k: string) => Promise<string | null>, companies: { sid: number; symbols: string[] }[], floor: string) {
  const out: { symbol: string; listed: number; loaded: number; missing: { as_of: string | null; why: string }[] }[] = [];
  let keys: string[] = [];
  for (const c of companies) {
    const lists = await db.all<{ r2_key: string }>(SQL_SHP_LISTS, [JSON.stringify(c.symbols)]);
    const texts = (await Promise.all(lists.map((l) => getText(l.r2_key)))).filter((t): t is string => !!t);
    const l = shpListed(texts);
    if (!keys.length) keys = l.keys;
    const rows = l.rows.filter((r) => !r.asOf || r.asOf >= floor);
    const got = rows.length ? await db.all<{ url: string; status: string; http_status: number | null; load: string | null; detail: string | null; stored: string | null }>(SQL_SHP_FILES, [JSON.stringify(rows.map((r) => r.url))]) : [];
    const byUrl = new Map(got.map((g) => [g.url, g]));
    const missing: { as_of: string | null; why: string }[] = [];
    let loaded = 0;
    for (const r of rows) {
      const g = byUrl.get(r.url);
      if (g?.stored) { loaded++; continue; }
      missing.push({ as_of: r.asOf, why: !g ? "not queued for download" : g.status !== "done" ? `download ${g.status}${g.http_status ? ` (HTTP ${g.http_status})` : ""}` : g.load ? `${g.load}: ${(g.detail ?? "").slice(0, 120)}` : "downloaded, not loaded yet" });
    }
    for (const a of l.noXbrl) if (a >= floor) missing.push({ as_of: a, why: "no XBRL link on NSE's list" });
    out.push({ symbol: c.symbols[0]!, listed: rows.length, loaded, missing });
  }
  return { keys, companies: out };
}

/** D40 (read-only /promoter-groups): the named promoter holders of each of the 250 in its latest shareholding filing. */
export const SQL_PROMOTER_HOLDERS = `SELECT s.security_id, s.category, s.holder_name, s.pct_all_shares AS pct, s.promoter FROM shareholding s
   WHERE s.security_id IN (SELECT value FROM json_each(?1)) AND s.category LIKE 'holder:%'
     AND s.as_of = (SELECT max(m.as_of) FROM shareholding m WHERE m.security_id = s.security_id)`;

/** D40: a holder name as one key (case, punctuation and the usual abbreviations folded: PVT → PRIVATE, LTD → LIMITED). */
export function holderKey(name: string): string {
  return name.toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z0-9 ]+/g, " ").replace(/\bPVT\b/g, "PRIVATE").replace(/\bLTD\b/g, "LIMITED")
    .replace(/\bCO\b/g, "COMPANY").replace(/\s+/g, " ").trim();
}
/** D40: a body corporate or trust (not an individual): the shared entities that tie group companies together. */
export const isEntity = (key: string) => /\b(LIMITED|LLP|PRIVATE|TRUST|CORPORATION|COMPANY|HOLDINGS?|INVESTMENTS?|ENTERPRISES|INDUSTRIES|VENTURES|CAPITAL|FOUNDATION|PLC|INC|AG|GMBH|BV|SA|PTE)\b/.test(key);

const INSTITUTIONAL = /MutualFund|Insurance|ForeignPortfolio|InstitutionsForeign|ForeignInstitutions|Banks|FinancialInstitutions|ProvidentFund|AlternativeInvestment|InvestorEducation|Custodian|OverseasDepositor|Government|InstitutionsDomestic|EmployeeBenefit/;
/** Smallest stake (share of all shares, our own count ÷ total) that links two companies as one group. */
export const MIN_STAKE = 0.05;
/** Smallest promoter-entity stake (share of all shares) that links two companies (D40, exact flag). */
export const MIN_LINK_STAKE = 0.01;
/** D40: promoter groups = companies whose latest shareholding names the same promoter entity (union of shared
 *  entities). Pure: input rows of SQL_PROMOTER_HOLDERS, symbol per security. */
export function promoterGroups(rows: { security_id: number; category: string; holder_name: string; pct: string | null; promoter?: number | null }[], symbol: Map<number, string>, names?: Map<number, string>) {
  const byEntity = new Map<string, Set<number>>();
  for (const r of rows) {
    // exact (owner yes, 6 Nov): the promoter flag read from the file; rows not re-read yet (NULL) fall back to the
    // probable rule — a ≥ 5 % stake held by a company or trust outside funds, banks, insurers and government
    if (r.promoter === 0) continue;
    // a promoter-group entity links companies only with a real stake: promoter tables also list group entities holding
    // 0 % or a sliver, which chained unrelated groups (Tata ↔ SBI Card / Yes Bank, L&T ↔ Torrent; 6 Nov run)
    if (r.promoter === 1 && !(Number(r.pct ?? 0) >= MIN_LINK_STAKE)) continue;
    if (r.promoter == null && (INSTITUTIONAL.test(r.category) || !(Number(r.pct ?? 0) >= MIN_STAKE))) continue;
    const k = holderKey(r.holder_name);
    if (!k || !isEntity(k)) continue;
    (byEntity.get(k) ?? byEntity.set(k, new Set()).get(k)!).add(r.security_id);
  }
  // a promoter entity that is itself one of the companies (L&T in LTIM, M&M in Tech Mahindra) joins its own group
  if (names) for (const [sid, name] of names) { const k = holderKey(name); const sids = byEntity.get(k); if (sids) sids.add(sid); }
  // union-find over companies that share an entity
  const parent = new Map<number, number>();
  const find = (x: number): number => { let p = parent.get(x) ?? x; if (p !== x) { p = find(p); parent.set(x, p); } return p; };
  for (const sids of byEntity.values()) { const [a, ...rest] = [...sids]; for (const b of rest) parent.set(find(b), find(a!)); }
  const groups = new Map<number, { companies: Set<number>; entities: Set<string> }>();
  for (const [k, sids] of byEntity) {
    if (sids.size < 2) continue;
    const root = find([...sids][0]!);
    const g = groups.get(root) ?? groups.set(root, { companies: new Set(), entities: new Set() }).get(root)!;
    for (const s of sids) g.companies.add(s);
    g.entities.add(k);
  }
  return [...groups.values()].map((g) => ({ companies: [...g.companies].map((s) => symbol.get(s) ?? String(s)).sort(), shared_entities: [...g.entities].sort().slice(0, 8) }))
    .sort((a, b) => b.companies.length - a.companies.length);
}

/** D40 one-off (owner yes, 6 Nov): fill shareholding.promoter for each focus company's latest shareholding filing from
 *  its stored file (R2). Updates only named-holder rows whose flag differs; nothing deleted. Cursor: daily_refresh. */
export const SQL_LATEST_SHP = "SELECT filing_id, source_url FROM filing WHERE security_id = ?1 AND kind = 'shareholding' ORDER BY period_end DESC LIMIT 1";
export const SQL_JOB_BY_URL = "SELECT r2_key FROM fetch_job WHERE url = ?1";
export const SQL_SET_PROMOTER = "UPDATE shareholding SET promoter = ?1 WHERE filing_id = ?2 AND category = ?3 AND holder_name = ?4 AND promoter IS NOT ?1";
export async function shpPromoterPass(db: Sql, getText: (k: string) => Promise<string | null>, sids: number[], now: Date, limit = 25, restart = false) {
  const [st] = restart ? [] : await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='shp_promoter'");
  const cur = st ? JSON.parse(st.detail) as { after: number; files: number; promoters: number; missing: number } : { after: 0, files: 0, promoters: 0, missing: 0 };
  const todo = [...sids].sort((a, b) => a - b).filter((x) => x > cur.after).slice(0, limit);
  for (const sid of todo) {
    cur.after = sid;
    const [f] = await db.all<{ filing_id: number; source_url: string }>(SQL_LATEST_SHP, [sid]);
    const [j] = f ? await db.all<{ r2_key: string }>(SQL_JOB_BY_URL, [f.source_url]) : [];
    const xml = j ? await getText(j.r2_key) : null;
    if (!f || !xml) { cur.missing++; continue; }
    let holders;
    try { holders = parseShareholding(parseXbrl(xml), { totalOverride: 1 }).namedHolders; } catch { cur.missing++; continue; }
    const seen = new Set<string>(), stmts = [];
    for (const h of holders) {
      const k = `${h.group}|${h.name}`; if (seen.has(k)) continue; seen.add(k);
      stmts.push({ sql: SQL_SET_PROMOTER, params: [h.promoter ? 1 : 0, f.filing_id, `holder:${h.group}`, h.name] });
      if (h.promoter) cur.promoters++;
    }
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
    cur.files++;
  }
  const done = todo.length < limit;
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','shp_promoter',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [now.toISOString(), JSON.stringify(cur)]);
  return { ...cur, done };
}
