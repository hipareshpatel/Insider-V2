// Field catalogue §11 (activity 2): promoter holding and pledge, FII / DII / MF / public holding, each with its change
// since the previous shareholding filing, and the promoter group's pledge. Percentages on the SCRR base (all shares
// less non-promoter-non-public holdings — the market convention), computed from the filed share counts.
import { type Sql, batchAll, insertRows } from "@disclo/core";

export const SQL_TWO_LATEST_SHP = "SELECT filing_id, period_end FROM filing WHERE security_id = ?1 AND kind = 'shareholding' ORDER BY period_end DESC LIMIT 2";
export const SQL_SHP_CATEGORIES = "SELECT filing_id, category, shares FROM shareholding WHERE filing_id IN (?1, ?2) AND category NOT LIKE 'holder:%'";
export const SQL_SHP_PLEDGE = "SELECT filing_id, pledged, encumbered FROM promoter_encumbrance WHERE filing_id IN (?1, ?2)";
export const SQL_GROUP_PLEDGES = "SELECT o.security_id, o.value, g.group_name FROM ownership_feature o JOIN company_group g ON g.security_id = o.security_id WHERE o.security_id IN (SELECT value FROM json_each(?1)) AND o.field = 'promoter_pledged_pct'";
const HEAD = "INSERT INTO ownership_feature (security_id, field, value, reason, as_of, computed_at)";
const TAIL = `ON CONFLICT (security_id, field) DO UPDATE SET value = excluded.value, reason = excluded.reason, as_of = excluded.as_of, computed_at = excluded.computed_at
  WHERE ownership_feature.value IS NOT excluded.value OR ownership_feature.reason IS NOT excluded.reason OR ownership_feature.as_of IS NOT excluded.as_of`;

export interface Snapshot { asOf: string; shares: Record<string, number | null>; pledged: number | null }
const r2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);

/** Pure: the §11 fields from the latest snapshot and the one before (null with a reason when not computable). */
export function ownershipFields(now: Snapshot, prev: Snapshot | null): { field: string; value: string | null; reason: string | null }[] {
  const out: { field: string; value: string | null; reason: string | null }[] = [];
  const put = (field: string, value: string | null, reason: string) => out.push({ field, value, reason: value === null ? reason : null });
  const base = (s: Snapshot) => (s.shares.total != null ? s.shares.total - (s.shares.non_promoter_non_public ?? 0) : null);
  const pctOf = (s: Snapshot, cat: string) => { const b = base(s), v = s.shares[cat]; return b && b > 0 && v != null ? (v / b) * 100 : null; };
  const pledged = (s: Snapshot) => { const p = s.shares.promoter; return s.pledged != null && p != null ? (p > 0 ? (s.pledged / p) * 100 : 0) : null; };
  const pair = (field: string, f: (s: Snapshot) => number | null, what: string) => {
    const a = f(now);
    put(field, a === null ? null : r2(a), `${what} not filed for ${now.asOf}`);
    const b = prev ? f(prev) : null;
    put(field === "promoter_pledged_pct" ? "pledge_change_qoq" : `${field.replace(/_pct$/, "")}_change_qoq`,
      a === null || b === null ? null : r2(a - b), prev ? `${what} not filed for ${prev.asOf}` : "no earlier shareholding filing stored");
  };
  pair("promoter_holding_pct", (s) => pctOf(s, "promoter"), "promoter holding");
  pair("promoter_pledged_pct", pledged, "promoter pledge");
  pair("fii_holding_pct", (s) => pctOf(s, "fii"), "foreign institutions' holding");
  pair("dii_holding_pct", (s) => pctOf(s, "dii"), "domestic institutions' holding");
  pair("mf_holding_pct", (s) => pctOf(s, "mutual_funds"), "mutual funds' holding");
  pair("public_holding_pct", (s) => pctOf(s, "public"), "public holding");
  return out;
}

async function snapshot(db: Sql, f: { filing_id: number; period_end: string }, rows: { filing_id: number; category: string; shares: number | null }[], pl: { filing_id: number; pledged: number | null; encumbered: number | null }[]): Promise<Snapshot> {
  const shares: Record<string, number | null> = {};
  for (const r of rows) if (r.filing_id === f.filing_id) shares[r.category] = r.shares;
  const p = pl.find((x) => x.filing_id === f.filing_id);
  return { asOf: f.period_end, shares, pledged: p ? (p.pledged ?? p.encumbered ?? null) : null };
}

/** /maint/ownership and the daily cron: `limit` companies per call (cursor in daily_refresh, per IST day); the call
 *  that finishes the 250 adds the group pledge fields from company_group. */
export async function ownershipStep(db: Sql, sids: number[], now: Date, limit = 50, restart = false): Promise<{ day: string; companies: number; done: boolean }> {
  const day = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const [st] = restart ? [] : await db.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE day='once' AND slot='ownership'");
  const cur = st ? JSON.parse(st.detail) as { day: string; after: number; done: boolean } : null;
  if (cur?.day === day && cur.done) return { day, companies: 0, done: true };
  const after = cur?.day === day ? cur.after : 0;
  const todo = [...sids].sort((a, b) => a - b).filter((x) => x > after).slice(0, limit);
  const at = now.toISOString(), rows: unknown[][] = [];
  for (const sid of todo) {
    const fs = await db.all<{ filing_id: number; period_end: string }>(SQL_TWO_LATEST_SHP, [sid]);
    if (!fs.length) { rows.push([sid, "promoter_holding_pct", null, "no shareholding filing stored", "", at]); continue; }
    const ids = [fs[0]!.filing_id, fs[1]?.filing_id ?? fs[0]!.filing_id];
    const cats = await db.all<{ filing_id: number; category: string; shares: number | null }>(SQL_SHP_CATEGORIES, ids);
    const pl = await db.all<{ filing_id: number; pledged: number | null; encumbered: number | null }>(SQL_SHP_PLEDGE, ids);
    const a = await snapshot(db, fs[0]!, cats, pl), b = fs[1] ? await snapshot(db, fs[1], cats, pl) : null;
    for (const f of ownershipFields(a, b)) rows.push([sid, f.field, f.value, f.reason, a.asOf, at]);
  }
  if (rows.length) await batchAll(db, insertRows(HEAD, 6, rows, TAIL));
  const done = todo.length < limit;
  if (done) {
    // group pledge: the highest promoter pledge among the company's group, and how many members pledge at all
    const ps = await db.all<{ security_id: number; value: string | null; group_name: string | null }>(SQL_GROUP_PLEDGES, [JSON.stringify(sids)]);
    const by = new Map<string, { max: number; pledging: number }>();
    for (const p of ps) if (p.group_name && p.value != null) { const g = by.get(p.group_name) ?? { max: 0, pledging: 0 }; g.max = Math.max(g.max, Number(p.value)); if (Number(p.value) > 0) g.pledging++; by.set(p.group_name, g); }
    const gr: unknown[][] = [];
    for (const p of ps) {
      const g = p.group_name ? by.get(p.group_name) : null;
      gr.push([p.security_id, "group_pledged_max_pct", g ? r2(g.max) : null, p.group_name ? "no pledge figure for the group" : "not in a promoter group of the 250", "", at]);
      gr.push([p.security_id, "group_members_pledging", g ? String(g.pledging) : null, p.group_name ? "no pledge figure for the group" : "not in a promoter group of the 250", "", at]);
    }
    if (gr.length) await batchAll(db, insertRows(HEAD, 6, gr, TAIL));
  }
  await db.run("INSERT INTO daily_refresh (day, slot, at, detail) VALUES ('once','ownership',?,?) ON CONFLICT (day, slot) DO UPDATE SET at=excluded.at, detail=excluded.detail", [at, JSON.stringify({ day, after: todo.length ? todo[todo.length - 1] : after, done })]);
  return { day, companies: todo.length, done };
}
