// D141 evidence for one review item (read-only): NSE's own adjusted previous close on the date (prev_close in the
// bhavcopy is set after NSE's corporate-action adjustment; for demergers from the special pre-open), the real close of
// the previous session, share counts on both days, and actions from both NSE sources.
import { type Sql, diso, dnum, fromPaise } from "@disclo/core";

export async function evidence(db: Sql, sid: number, date: string) {
  const [prev] = await db.all<{ d: string | null }>("SELECT max(trade_date) AS d FROM trading_calendar WHERE is_session=1 AND trade_date < ?", [date]);
  const pD = prev?.d ? dnum(prev.d)! : null, eD = dnum(date)!;
  const px = await db.all<{ d: number; series: string; open: number | null; close: number; prev_close: number | null }>(
    "SELECT d, series, open, close, prev_close FROM price_daily WHERE security_id=? AND d IN (?, ?) ORDER BY d, series='EQ' DESC", [sid, pD ?? 0, eD]);
  const sh = await db.all<{ d: number; issue_size: number; face_value_paise: number | null }>("SELECT d, issue_size, face_value_paise FROM shares_daily WHERE security_id=? AND d IN (?, ?)", [sid, pD ?? 0, eD]);
  const sym = await db.all<{ value: string }>("SELECT value FROM security_identifier WHERE security_id=? AND id_type='nse_symbol' ORDER BY valid_from DESC LIMIT 1", [sid]);
  const isin = await db.all<{ value: string }>("SELECT value FROM security_identifier WHERE security_id=? AND id_type='isin' ORDER BY valid_from DESC LIMIT 1", [sid]);
  const [kind] = await db.all<{ kind: string; name: string }>("SELECT kind, name FROM security WHERE security_id=?", [sid]);
  const acts = await db.all("SELECT ex_date, type, raw_purpose, status, file_id IS NULL AS from_company_list FROM corp_action WHERE security_id=? AND ex_date BETWEEN ? AND ?", [sid, prev?.d ?? date, date]);
  const extra = sym[0] ? await db.all("SELECT ex_date, purpose FROM corp_action_extra WHERE symbol=? AND ex_date BETWEEN ? AND ?", [sym[0].value, prev?.d ?? date, date]) : [];
  const factor = await db.all("SELECT factor, method, status FROM adj_factor WHERE security_id=? AND ex_date=?", [sid, date]);
  const p0 = px.find((x) => x.d === pD), p1 = px.find((x) => x.d === eD);
  const s0 = sh.find((x) => x.d === pD), s1 = sh.find((x) => x.d === eD);
  return {
    sid, symbol: sym[0]?.value, isin: isin[0]?.value, kind: kind?.kind, name: kind?.name, date, prevDate: prev?.d ?? null,
    prevClose: p0 ? fromPaise(p0.close) : null, nsePrevClose: p1?.prev_close != null ? fromPaise(p1.prev_close) : null,
    nseFactor: p0 && p1?.prev_close ? p1.prev_close / p0.close : null,
    open: p1?.open != null ? fromPaise(p1.open) : null, close: p1 ? fromPaise(p1.close) : null, series: [p0?.series, p1?.series],
    sharesBefore: s0?.issue_size ?? null, sharesOn: s1?.issue_size ?? null, shareRatio: s0 && s1 ? s1.issue_size / s0.issue_size : null,
    fvBefore: s0?.face_value_paise ?? null, fvOn: s1?.face_value_paise ?? null,
    actions: acts, companyList: extra, factor: factor[0] ?? null, prevDateIso: pD ? diso(pD) : null,
  };
}
