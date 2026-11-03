import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "./main";

const PriceChart = lazy(() => import("./chart")); // chart library loads only on stock pages (LCP)

/* eslint-disable @typescript-eslint/no-explicit-any */
function useJson(url: string) {
  const [s, set] = useState<{ data: any; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    set({ data: null, error: null, loading: true });
    fetch(url).then(async (r) => { const j: any = await r.json(); if (!live) return; set(r.ok ? { data: j, error: null, loading: false } : { data: null, error: j.error ?? `HTTP ${r.status}`, loading: false }); })
      .catch((e) => live && set({ data: null, error: String(e), loading: false }));
    return () => { live = false; };
  }, [url]);
  return s;
}

const n2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const n0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const f2 = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? "—" : n2.format(v));
const f0 = (v: number | null | undefined) => (v === null || v === undefined ? "—" : n0.format(v));
/** ₹ crore from a rupee text value (financials are stored in rupees, exact). */
const cr = (v: string | null | undefined) => (v === null || v === undefined ? "—" : n2.format(Number(v) / 1e7));
function Chg({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="muted">—</span>;
  return <span className={v > 0 ? "up" : v < 0 ? "down" : ""}>{v > 0 ? "+" : ""}{n2.format(v)}%</span>;
}
function Table({ id, caption, head, rows }: { id: string; caption: React.ReactNode; head: React.ReactNode[]; rows: React.ReactNode[][] }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-labelledby={id}>
      <table>
        <caption id={id}>{caption}</caption>
        <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}
const Loading = ({ s }: { s: { loading: boolean; error: string | null } }) => (s.loading ? <p className="muted">Loading…</p> : <p className="note">Could not load: {s.error}</p>);

export function Dashboard() {
  const s = useJson("/api/v1/dashboard");
  const d = s.data;
  if (!d) return <Loading s={s} />;
  if (!d.as_of) return <p className="note">No market session loaded yet.</p>;
  const key = d.indices.filter((x: any) => x.key);
  const rest = d.indices.filter((x: any) => !x.key);
  return (
    <>
      <h1>Markets</h1>
      <p className="muted">End of day {d.as_of} (previous session {d.previous_session}). Source: {d.source}.</p>
      <div className="grid">
        {key.map((x: any) => (
          <div className="tile" key={x.name}>
            <div className="label">{x.name}</div>
            <div className="value">{f2(x.close)}</div>
            <div><Chg v={x.change_pct} /> <span className="muted">P/E {x.pe ?? "—"}{x.pe_percentile !== undefined ? ` · ${x.pe_percentile}th pct since ${x.since}` : ""}</span></div>
          </div>
        ))}
      </div>
      <h2>Breadth</h2>
      <div className="grid">
        <div className="tile"><div className="label">Advances</div><div className="value up">{f0(d.breadth.advances)}</div></div>
        <div className="tile"><div className="label">Declines</div><div className="value down">{f0(d.breadth.declines)}</div></div>
        <div className="tile"><div className="label">Unchanged</div><div className="value">{f0(d.breadth.unchanged)}</div></div>
        <div className="tile"><div className="label">Equities traded</div><div className="value">{f0(d.breadth.universe)}</div></div>
      </div>
      <div className="cols">
        <div><h2>Top gainers</h2><Table id="t-gain" caption={<span className="muted">{d.movers.rule}</span>} head={["Stock", "Close ₹", "Change"]}
          rows={d.movers.gainers.map((x: any) => [<Link to={`/s/${x.symbol}`}>{x.symbol}</Link>, f2(x.close), <Chg v={x.change_pct} />])} /></div>
        <div><h2>Top losers</h2><Table id="t-lose" caption={<span className="muted">{d.movers.rule}</span>} head={["Stock", "Close ₹", "Change"]}
          rows={d.movers.losers.map((x: any) => [<Link to={`/s/${x.symbol}`}>{x.symbol}</Link>, f2(x.close), <Chg v={x.change_pct} />])} /></div>
      </div>
      <h2>Sectors</h2>
      <Table id="t-sec" caption={<span className="muted">Equal-weighted average change of each sector's companies (sector: NSE index list, else NSE announcement industry mapped to 22 sectors)</span>}
        head={["Sector", "Companies", "Advancing", "Avg change"]} rows={d.sectors.map((x: any) => [x.sector, f0(x.companies), f0(x.advancing), <Chg v={x.avg_change_pct} />])} />
      <div className="cols">
        <div><h2>FII / DII (₹ crore)</h2><Table id="t-fii" caption={<span className="muted">NSE provisional figures</span>} head={["Date · category", "Buy", "Sell", "Net"]}
          rows={d.fii_dii.map((x: any) => [`${x.date} · ${x.category}`, x.buy_cr, x.sell_cr, <span className={Number(x.net_cr) >= 0 ? "up" : "down"}>{x.net_cr}</span>])} /></div>
        <div><h2>F&amp;O participant open interest</h2><Table id="t-oi" caption={<span className="muted">Contracts, {d.fo_participant_oi.as_of} (NSCCL)</span>} head={["Participant", "Index fut long", "Index fut short", "Total long", "Total short"]}
          rows={d.fo_participant_oi.rows.map((x: any) => [x.client_type, f0(x.fut_idx_long), f0(x.fut_idx_short), f0(x.total_long), f0(x.total_short)])} /></div>
      </div>
      <h2>F&amp;O ban list</h2>
      <p>{d.fo_ban.symbols.length ? d.fo_ban.symbols.map((s: string, i: number) => <span key={s}>{i ? ", " : ""}<Link to={`/s/${s}`}>{s}</Link></span>) : "None"} <span className="muted">({d.fo_ban.as_of})</span></p>
      <h2>Surveillance (ASM / GSM)</h2>
      <p>{d.surveillance.length ? d.surveillance.map((x: any) => `${x.list.toUpperCase()} ${x.stage}: ${x.n}`).join(" · ") : <span className="muted">No snapshot yet</span>}</p>
      <h2>Largest bulk and block deals</h2>
      <Table id="t-deal" caption={<span className="muted">{d.deals.as_of}</span>} head={["Stock", "Kind", "Client", "Side", "Qty", "Price ₹", "Value ₹ cr"]}
        rows={d.deals.top.map((x: any) => [<Link to={`/s/${x.symbol}`}>{x.symbol}</Link>, x.kind, x.client, x.side === "B" ? "Buy" : "Sell", f0(x.qty), f2(x.price), f2(x.value_cr)])} />
      <h2>All indices</h2>
      <Table id="t-idx" caption={<span className="muted">{rest.length} indices · close and change vs previous session</span>} head={["Index", "Close", "Change", "P/E", "P/B", "Yield %"]}
        rows={rest.map((x: any) => [x.name, f2(x.close), <Chg v={x.change_pct} />, x.pe ?? "—", x.pb ?? "—", x.div_yield ?? "—"])} />
    </>
  );
}

const LINE_LABEL: Record<string, string> = {
  revenue: "Revenue from operations", total_income: "Total income", interest_earned: "Interest earned", gross_premium: "Gross premium",
  net_premium: "Net premium", operating_profit: "Operating profit", net_interest_income: "Net interest income", pbt: "Profit before tax", pat: "Profit after tax", eps_basic: "EPS (₹)",
  total_assets: "Total assets", total_equity: "Total equity", shareholders_funds: "Shareholders' funds", borrowings_noncurrent: "Long-term borrowings", borrowings_current: "Short-term borrowings", cash: "Cash",
  cfo: "Operating cash flow", cfi: "Investing cash flow", cff: "Financing cash flow",
};
function Statement({ id, title, periods, lines, kind }: { id: string; title: string; periods: any[]; lines: string[]; kind?: string }) {
  const ps = periods.filter((p) => !kind || p.period_kind === kind).slice(0, 12);
  const used = lines.filter((l) => ps.some((p) => p.lines[l] !== undefined || p.restated[l] !== undefined));
  if (!ps.length || !used.length) return null;
  const cell = (p: any, l: string) => {
    const v = p.lines[l], r = p.restated[l];
    const fmt = (x: string | null) => (l === "eps_basic" ? (x === null ? "—" : n2.format(Number(x))) : cr(x));
    return <>{v === undefined ? "—" : fmt(v)}{r !== undefined && r !== v ? <span className="restated" title="Restated in a later filing">restated {fmt(r)}</span> : null}</>;
  };
  return (
    <>
      <Table id={id} caption={<>{title} <span className="muted">₹ crore unless stated · original figures; restatements shown under them</span></>}
        head={["", ...ps.map((p) => <a href={p.source ?? undefined} target="_blank" rel="noreferrer" title={`Filed ${p.disclosed_at}`}>{p.period_end}</a>)]}
        rows={used.map((l) => [LINE_LABEL[l] ?? l, ...ps.map((p) => cell(p, l))])} />
    </>
  );
}

export function Stock({ symbol }: { symbol: string }) {
  const s = useJson(`/api/v1/stocks/${encodeURIComponent(symbol)}`);
  const d = s.data;
  const [basis, setBasis] = useState<"consolidated" | "standalone" | null>(null);
  if (!d) return <Loading s={s} />;
  const bases = [...new Set(d.financials.pl.map((p: any) => p.basis))] as ("consolidated" | "standalone")[];
  const b = basis ?? (bases.includes("consolidated") ? "consolidated" : bases[0] ?? "standalone");
  const of = (st: any[]) => st.filter((p: any) => p.basis === b);
  return (
    <>
      <h1>{d.name} <span className="muted">{d.symbol}</span></h1>
      <p className="muted">
        {d.classification ? <>{d.classification.sector ?? "Unclassified"}{d.classification.industry_detail ? ` · ${d.classification.industry_detail}` : ""} ({d.classification.label}) · </> : null}
        {d.indices.length ? d.indices.join(", ") : "Not in our tracked index lists"}
        {d.delisted_on ? ` · delisted ${d.delisted_on}` : ""}
      </p>
      <div className="grid">
        <div className="tile"><div className="label">Close ₹ ({d.quote?.date ?? "—"})</div><div className="value">{f2(d.quote?.close)}</div><div className="muted">{d.quote?.source} · series {d.quote?.series}</div></div>
        <div className="tile"><div className="label">Market cap ₹ crore</div><div className="value">{f2(d.shares?.mcap_cr)}</div><div className="muted">{d.shares ? `${d.shares.date} · ${d.shares.mcap_source === "nse" ? "NSE" : "derived"}` : ""}</div></div>
        <div className="tile"><div className="label">Shares outstanding</div><div className="value">{f0(d.shares?.issue_size)}</div><div className="muted">face value ₹{d.shares?.face_value ?? "—"}</div></div>
        <div className="tile"><div className="label">Delivery % (last session)</div><div className="value">{f2(d.quote?.delivery_pct)}</div><div className="muted">volume {f0(d.quote?.volume)}</div></div>
      </div>
      <h2>Price (adjusted)</h2>
      {d.prices.starts_after_break ? <p className="note">Series break on {d.prices.starts_after_break}: earlier prices are not comparable and are not shown (D146).</p> : null}
      {d.prices.pending_review ? <p className="note">{d.prices.pending_review} corporate-action adjustment(s) still under review; they are not applied.</p> : null}
      <Suspense fallback={<div className="chart" aria-busy="true" />}>{d.prices.rows.length ? <PriceChart rows={d.prices.rows} /> : <p className="muted">No prices.</p>}</Suspense>
      <p className="muted">Adjusted for {d.prices.adjusted_by.length ? d.prices.adjusted_by.map((a: any) => `${a.ex_date} ×${Number(a.factor).toFixed(4)} (${a.method.replace("_", " ")})`).join("; ") : "no corporate actions"}.</p>

      <h2>Financials</h2>
      {bases.length > 1 && (
        <p role="group" aria-label="Basis">
          {bases.map((x) => <button key={x} type="button" aria-pressed={x === b} onClick={() => setBasis(x)} style={{ marginInlineEnd: 8, fontWeight: x === b ? 700 : 400 }}>{x}</button>)}
        </p>
      )}
      {d.financials.pl.length ? (
        <>
          <Statement id="t-q" title={`Quarterly results (${b})`} periods={of(d.financials.pl)} kind="Q" lines={["revenue", "total_income", "interest_earned", "gross_premium", "net_premium", "operating_profit", "pbt", "pat", "eps_basic"]} />
          <h2>Balance sheet</h2>
          <Statement id="t-bs" title={`Balance sheet (${b})`} periods={of(d.financials.bs)} lines={["total_assets", "total_equity", "shareholders_funds", "borrowings_noncurrent", "borrowings_current", "cash"]} />
          <h2>Cash flow</h2>
          <Statement id="t-cf" title={`Cash flow, year to date (${b})`} periods={of(d.financials.cf)} lines={["cfo", "cfi", "cff"]} />
        </>
      ) : <p className="muted">No financial results loaded yet for this company.</p>}

      {d.shareholding ? (
        <><h2>Shareholding</h2>
          <Table id="t-shp" caption={<span className="muted">As of {d.shareholding.as_of} (shareholding pattern filing)</span>} head={["Category", "Shares", "% of shares"]}
            rows={d.shareholding.categories.map((c: any) => [c.category, f0(c.shares), c.pct ?? "—"])} /></>
      ) : null}
      {d.insider_trades.length ? (
        <><h2>Insider trades (SEBI PIT)</h2>
          <Table id="t-pit" caption={<span className="muted">Latest {d.insider_trades.length} disclosures</span>} head={["Person", "Category", "Type", "Mode", "Qty", "Value ₹", "Disclosed"]}
            rows={d.insider_trades.map((t: any) => [t.person, t.category, t.txn, t.mode, f0(t.qty), t.value_rs, (t.disclosed_at ?? "").slice(0, 10)])} /></>
      ) : null}
      {d.board_meetings.length ? (
        <><h2>Board meetings</h2>
          <Table id="t-bm" caption={<span className="muted">Latest {d.board_meetings.length}</span>} head={["Meeting date", "Purpose", "Announced"]}
            rows={d.board_meetings.map((m: any) => [m.meeting_d ? String(m.meeting_d).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "—", m.purpose, (m.announced_at ?? "").slice(0, 10)])} /></>
      ) : null}
      {d.credit_ratings.length ? (
        <><h2>Credit ratings</h2>
          <Table id="t-cr" caption={<span className="muted">As disclosed to NSE</span>} head={["Agency", "Rating", "Outlook", "Action", "Rated on"]}
            rows={d.credit_ratings.map((r: any) => [r.agency, r.rating, r.outlook, r.action, r.rated_on ? String(r.rated_on).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "—"])} /></>
      ) : null}
      {d.corporate_actions.length ? (
        <><h2>Corporate actions</h2>
          <Table id="t-ca" caption={<span className="muted">NSE corporate-action records (latest 40)</span>} head={["Ex-date", "Type", "Purpose as filed"]}
            rows={d.corporate_actions.map((a: any) => [a.ex_date, a.type, a.raw_purpose])} /></>
      ) : null}
      <h2>Identifiers</h2>
      <Table id="t-id" caption={<span className="muted">Symbol / ISIN history</span>} head={["Type", "Value", "From", "To"]}
        rows={d.identifiers.map((i: any) => [i.id_type, i.value, i.valid_from, i.valid_to ?? "current"])} />
    </>
  );
}

export function Health() {
  const s = useJson("/api/v1/health");
  const d = s.data;
  if (!d) return <Loading s={s} />;
  return (
    <>
      <h1>Data health</h1>
      <p className="muted">Latest market session loaded: {d.latest_session ?? "—"}</p>
      <div className="cols">
        <div><h2>Filings loader</h2><Table id="h-f" caption={<span className="muted">Results and shareholding files</span>} head={["Status", "Files"]} rows={d.filings_loader.map((x: any) => [x.status, f0(x.n)])} /></div>
        <div><h2>Review queue (open)</h2><Table id="h-r" caption={<span className="muted">Items waiting for a decision</span>} head={["Kind", "Open"]} rows={d.review_queue_open.length ? d.review_queue_open.map((x: any) => [x.kind, f0(x.n)]) : [["none", "0"]]} /></div>
        <div><h2>Sector sources</h2><Table id="h-s" caption={<span className="muted">Companies by sector source</span>} head={["Source", "Companies"]} rows={d.sectors.map((x: any) => [x.source, f0(x.companies)])} /></div>
      </div>
      <h2>Market-structure data</h2>
      <Table id="h-ms" caption={<span className="muted">Latest day loaded per source; missing = sessions with no file</span>} head={["Source", "Last day", "Missing days"]}
        rows={d.market_structure.map((x: any) => [x.source, String(x.last_day).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"), f0(x.missing_days)])} />
      <h2>Latest market runs</h2>
      <Table id="h-run" caption={<span className="muted">Newest first</span>} head={["Pipeline · key", "Status", "Started", "Finished"]}
        rows={d.market_runs.map((x: any) => [`${x.pipeline} · ${x.run_key}`, x.status, x.started_at, x.finished_at ?? "—"])} />
    </>
  );
}
