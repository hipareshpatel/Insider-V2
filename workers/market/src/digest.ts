// M1 Phase 1 acceptance tests 4 and 5 (§9.2): "re-running any date changes 0 rows" and "a rebuild from R2 is
// identical". One checksum per table for a trading date, keyed by the NSE symbol valid that day (security ids are
// assigned per database, so staging and production can differ). Read-only.
import type { Sql } from "@disclo/core";

export interface DayDigest { date: string; tables: Record<string, { rows: number; sha256: string }> }

async function sha(text: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function digestDay(m: Sql, date: string): Promise<DayDigest> {
  const d = Number(date.replaceAll("-", ""));
  const ids = await m.all<{ security_id: number; value: string; valid_from: string; valid_to: string | null }>(
    "SELECT security_id, value, valid_from, valid_to FROM security_identifier WHERE id_type='nse_symbol' AND valid_from <= ?1 AND (valid_to IS NULL OR valid_to >= ?1)", [date]);
  const sym = new Map(ids.map((r) => [r.security_id, r.value]));
  const key = (sid: number) => sym.get(sid) ?? `#${sid}`; // unmapped ids are visible in the digest rows
  const tables: DayDigest["tables"] = {};
  const put = async (name: string, rows: unknown[][]) => {
    const lines = rows.map((r) => r.map((x) => (x === null ? "" : String(x))).join("|")).sort();
    tables[name] = { rows: lines.length, sha256: await sha(lines.join("\n")) };
  };
  const [price, deliv, shares, factors, actions] = await Promise.all([
    m.all<Record<string, number | string | null>>("SELECT security_id, series, open, high, low, close, prev_close, volume, turnover_paise, trades FROM price_daily WHERE d=?", [d]),
    m.all<Record<string, number | string | null>>("SELECT security_id, series, deliverable_qty FROM delivery_daily WHERE d=?", [d]),
    m.all<Record<string, number | string | null>>("SELECT security_id, issue_size, mcap_paise, mcap_source, face_value_paise FROM shares_daily WHERE d=?", [d]),
    m.all<Record<string, number | string | null>>("SELECT security_id, factor, method, status FROM adj_factor WHERE ex_date=?", [date]),
    m.all<Record<string, number | string | null>>("SELECT security_id, type, raw_purpose, ratio_num, ratio_den, amount FROM corp_action WHERE ex_date=?", [date]),
  ]);
  await put("price_daily", price.map((r) => [key(r.security_id as number), r.series, r.open, r.high, r.low, r.close, r.prev_close, r.volume, r.turnover_paise, r.trades]));
  await put("delivery_daily", deliv.map((r) => [key(r.security_id as number), r.series, r.deliverable_qty]));
  await put("shares_daily", shares.map((r) => [key(r.security_id as number), r.issue_size, r.mcap_paise, r.mcap_source, r.face_value_paise]));
  await put("adj_factor", factors.map((r) => [key(r.security_id as number), r.factor, r.method, r.status]));
  await put("corp_action", actions.map((r) => [key(r.security_id as number), r.type, r.raw_purpose, r.ratio_num, r.ratio_den, r.amount]));
  return { date, tables };
}
