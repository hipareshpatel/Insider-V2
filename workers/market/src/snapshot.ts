// Index membership snapshot (D9) + sector classification (D121), once per day from the current index lists.
// NSE publishes current constituents only, so history starts at our first snapshot.
import { type Fetcher, type Sql, type Stmt, batchAll, indexListUrl, parseIndexList } from "@disclo/core";

export const INDEX_LISTS: Record<string, string> = {
  "NIFTY 50": "ind_nifty50list",
  "NIFTY NEXT 50": "ind_niftynext50list",
  "NIFTY 100": "ind_nifty100list",
  "NIFTY 200": "ind_nifty200list",
  "NIFTY 500": "ind_nifty500list",
  "NIFTY MIDCAP 150": "ind_niftymidcap150list",
  "NIFTY SMALLCAP 250": "ind_niftysmallcap250list",
  "NIFTY MICROCAP 250": "ind_niftymicrocap250_list",
  "NIFTY TOTAL MARKET": "ind_niftytotalmarket_list",
};
const EXPECTED: Record<string, number> = { "NIFTY 50": 50, "NIFTY NEXT 50": 50, "NIFTY 100": 100, "NIFTY 200": 200, "NIFTY 500": 500, "NIFTY MIDCAP 150": 150, "NIFTY SMALLCAP 250": 250, "NIFTY MICROCAP 250": 250 };

export interface SnapshotReport { asOf: string; indices: Record<string, number | string>; sectors: number; unmatched: string[] }

export async function snapshotIndices(asOf: string, db: Sql, fetch: Fetcher): Promise<SnapshotReport> {
  const isinToSec = new Map((await db.all<{ value: string; security_id: number }>(
    "SELECT value, security_id FROM security_identifier WHERE id_type='isin' AND valid_to IS NULL")).map((r) => [r.value, r.security_id]));
  const report: SnapshotReport = { asOf, indices: {}, sectors: 0, unmatched: [] };
  const stmts: Stmt[] = [];
  for (const [name, file] of Object.entries(INDEX_LISTS)) {
    const r = await fetch(indexListUrl(file));
    if (r.status !== 200) { report.indices[name] = `HTTP ${r.status}`; continue; }
    const rows = parseIndexList(new TextDecoder().decode(r.bytes));
    // Gate (§9.1): index snapshot row counts exact.
    if (EXPECTED[name] !== undefined && rows.length !== EXPECTED[name]) { report.indices[name] = `rejected: ${rows.length} rows, expected ${EXPECTED[name]}`; continue; }
    const members = new Set<number>();
    for (const m of rows) {
      const sid = isinToSec.get(m.isin);
      if (sid === undefined) { report.unmatched.push(`${name}:${m.symbol}`); continue; }
      members.add(sid);
      if (name === "NIFTY TOTAL MARKET") {
        stmts.push({ sql: `INSERT INTO classification (security_id, as_of, sector, industry_detail, sector_source, source_ref)
          SELECT ?1, ?2, ?3, NULL, 'index_csv', ?4
          WHERE NOT EXISTS (SELECT 1 FROM classification c WHERE c.security_id = ?1 AND c.as_of = (SELECT max(as_of) FROM classification WHERE security_id = ?1) AND c.sector IS ?3)`,
          params: [sid, asOf, m.sector, `${file}.csv@${asOf}`] });
        report.sectors++;
      }
    }
    // Close memberships that ended, open new ones (valid_from/valid_to).
    const current = new Set((await db.all<{ security_id: number }>("SELECT security_id FROM index_membership WHERE index_name=? AND valid_to IS NULL", [name])).map((x) => x.security_id));
    for (const sid of current) if (!members.has(sid)) stmts.push({ sql: "UPDATE index_membership SET valid_to=? WHERE index_name=? AND security_id=? AND valid_to IS NULL", params: [asOf, name, sid] });
    for (const sid of members) if (!current.has(sid)) stmts.push({ sql: "INSERT OR IGNORE INTO index_membership (index_name, security_id, valid_from) VALUES (?,?,?)", params: [name, sid, asOf] });
    report.indices[name] = rows.length;
  }
  await batchAll(db, stmts);
  return report;
}
