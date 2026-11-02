// Phase 1 acceptance checks (§9.2) on live data, read-only. Tests 4 (re-run = 0 rows) and 5 (rebuild from R2)
// are covered by CI / a separate rebuild job; the rest are computed here.
import { type Sql, adjustPrice, dec, div, sub, toText } from "@disclo/core";

export interface Check { id: string; name: string; pass: boolean | null; detail: string }

export async function acceptance(db: Sql, app: Sql): Promise<Check[]> {
  const out: Check[] = [];

  // 1. BAJFINANCE adjusted close 2025-06-13 = 933.10, continuous across 2025-06-16.
  const [baj] = await db.all<{ security_id: number }>("SELECT security_id FROM security_identifier WHERE id_type='nse_symbol' AND value='BAJFINANCE' LIMIT 1");
  if (!baj) out.push({ id: "1", name: "BAJFINANCE adjusted close 2025-06-13 = 933.10", pass: null, detail: "not loaded yet" });
  else {
    const f = await db.all<{ ex_date: string; factor: string }>("SELECT ex_date, factor FROM adj_factor WHERE security_id=?", [baj.security_id]);
    const p = await db.all<{ trade_date: string; close: string }>("SELECT trade_date, close FROM price_daily WHERE security_id=? AND series='EQ' AND trade_date IN ('2025-06-13','2025-06-16')", [baj.security_id]);
    const c13 = p.find((x) => x.trade_date === "2025-06-13"), c16 = p.find((x) => x.trade_date === "2025-06-16");
    if (!c13 || !c16) out.push({ id: "1", name: "BAJFINANCE adjusted close 2025-06-13 = 933.10", pass: null, detail: "2025-06 not loaded yet" });
    else {
      const fr = f.map((x) => ({ exDate: x.ex_date, factor: x.factor }));
      const a13 = adjustPrice(c13.close, "2025-06-13", fr), a16 = adjustPrice(c16.close, "2025-06-16", fr);
      const jump = Math.abs(Number(toText(div(sub(dec(a16), dec(a13)), dec(a13), 4))));
      out.push({ id: "1", name: "BAJFINANCE adjusted close 2025-06-13 = 933.10, continuous", pass: a13 === "933.1" && jump < 0.1, detail: `adjusted 13 Jun ${a13}, 16 Jun ${a16}, move ${(jump * 100).toFixed(1)}%` });
    }
  }

  // 2. Nifty 50 adjusted series: zero unexplained jumps (> ±35% day move without a factor) since 2024-01.
  const members = await db.all<{ security_id: number }>("SELECT security_id FROM index_membership WHERE index_name='NIFTY 50' AND valid_to IS NULL");
  if (members.length !== 50) out.push({ id: "2", name: "Nifty 50 adjusted series: zero unexplained jumps", pass: null, detail: `index snapshot not taken yet (${members.length} members)` });
  else {
    const ids = members.map((m) => m.security_id);
    const marks = ids.map(() => "?").join(",");
    const prices = await db.all<{ security_id: number; trade_date: string; close: string }>(`SELECT security_id, trade_date, close FROM price_daily WHERE series='EQ' AND security_id IN (${marks}) ORDER BY security_id, trade_date`, ids);
    const factors = await db.all<{ security_id: number; ex_date: string; factor: string }>(`SELECT security_id, ex_date, factor FROM adj_factor WHERE security_id IN (${marks})`, ids);
    const jumps: string[] = [];
    let prev: { id: number; adj: string; d: string } | null = null;
    for (const r of prices) {
      const fr = factors.filter((f) => f.security_id === r.security_id).map((f) => ({ exDate: f.ex_date, factor: f.factor }));
      const adj = adjustPrice(r.close, r.trade_date, fr, 4);
      if (prev && prev.id === r.security_id && dec(prev.adj).units !== 0n) {
        const mv = Number(toText(div(sub(dec(adj), dec(prev.adj)), dec(prev.adj), 4)));
        if (Math.abs(mv) > 0.35) jumps.push(`${r.security_id}@${r.trade_date}:${(mv * 100).toFixed(0)}%`);
      }
      prev = { id: r.security_id, adj, d: r.trade_date };
    }
    out.push({ id: "2", name: "Nifty 50 adjusted series: zero unexplained jumps since 2024-01", pass: jumps.length === 0, detail: `${prices.length} price rows checked; jumps: ${jumps.slice(0, 10).join(", ") || "none"}` });
  }

  // 3. Market cap equals NSE MCAP to the rupee from 2024-02-01 (stored as published; derived only before).
  const [m] = await db.all<{ nse: number; derived_after: number; derived_before: number }>(
    "SELECT sum(mcap_source='nse') AS nse, sum(mcap_source='derived' AND trade_date >= '2024-02-01') AS derived_after, sum(mcap_source='derived' AND trade_date < '2024-02-01') AS derived_before FROM shares_daily");
  out.push({ id: "3", name: "Market cap = NSE MCAP from 2024-02-01", pass: (m?.derived_after ?? 0) === 0 && (m?.nse ?? 0) > 0, detail: `${m?.nse ?? 0} NSE rows, ${m?.derived_after ?? 0} derived after Feb 2024 (must be 0), ${m?.derived_before ?? 0} derived Jan 2024 (D6)` });

  // 6. Corporate-action review queue empty.
  const [q] = await app.all<{ n: number }>("SELECT count(*) AS n FROM review_item WHERE status='open' AND kind IN ('corp_action','bc_unparsed')");
  out.push({ id: "6", name: "Corporate-action review queue empty", pass: (q?.n ?? 0) === 0, detail: `${q?.n ?? 0} open items (owner review)` });
  return out;
}
