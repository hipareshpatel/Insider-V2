import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Dashboard, Health, Stock } from "./pages";
import { Contact, Credits, Disclaimer, Privacy, Terms } from "./legal";
import "./styles.css";

/** Tiny router: / (dashboard), /s/:symbol (stock), /health. */
export function navigate(to: string) {
  history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
export function Link(p: { to: string; children: React.ReactNode; className?: string }) {
  return <a href={p.to} className={p.className} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); navigate(p.to); }}>{p.children}</a>;
}
function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => { const f = () => setPath(location.pathname); window.addEventListener("popstate", f); return () => window.removeEventListener("popstate", f); }, []);
  return path;
}

interface Sec { symbol: string; name: string; kind: string }
function Search() {
  const [all, setAll] = useState<Sec[] | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const load = () => { if (!all) fetch("/api/v1/securities").then((r) => r.json() as Promise<Sec[]>).then(setAll).catch(() => setAll([])); };
  const hits = useMemo(() => {
    const t = q.trim().toUpperCase();
    if (!t || !all) return [];
    const starts = all.filter((s) => s.symbol.startsWith(t));
    const words = all.filter((s) => !s.symbol.startsWith(t) && s.name.toUpperCase().includes(t));
    return [...starts, ...words].slice(0, 12);
  }, [q, all]);
  const go = (s: Sec) => { setQ(""); box.current?.blur(); navigate(`/s/${encodeURIComponent(s.symbol)}`); };
  return (
    <div className="search">
      <input ref={box} type="search" placeholder="Search company or symbol" aria-label="Search company or symbol" value={q} onFocus={load}
        role="combobox" aria-expanded={hits.length > 0} aria-controls="search-results" aria-autocomplete="list"
        onChange={(e) => { setQ(e.target.value); setSel(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(i + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && hits[sel]) go(hits[sel]!);
          else if (e.key === "Escape") setQ("");
        }} />
      {hits.length > 0 && (
        <ul id="search-results" role="listbox">
          {hits.map((s, i) => (
            <li key={s.symbol} role="option" aria-selected={i === sel}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); go(s); }}><strong>{s.symbol}</strong> <span className="muted">{s.name}</span></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function App() {
  const path = usePath();
  const m = /^\/s\/([^/]+)/.exec(path);
  const PAGES: Record<string, [string, () => React.ReactElement]> = { "/health": ["Data health", Health], "/credits": ["Credits", Credits], "/disclaimer": ["Disclaimer", Disclaimer], "/terms": ["Terms", Terms], "/privacy": ["Privacy", Privacy], "/contact": ["Contact", Contact] };
  const page = PAGES[path];
  useEffect(() => { document.title = m ? `${decodeURIComponent(m[1]!)} · Disclo` : page ? `${page[0]} · Disclo` : "Disclo"; }, [path]);
  return (
    <>
      <header className="top">
        <Link to="/" className="brand">Disclo</Link>
        <nav><Link to="/">Markets</Link><Link to="/health">Data health</Link></nav>
        <Search />
      </header>
      <main>{m ? <Stock symbol={decodeURIComponent(m[1]!).toUpperCase()} /> : page ? (() => { const P = page[1]; return <P />; })() : <Dashboard />}</main>
      <footer>
        <nav aria-label="Site"><Link to="/disclaimer">Disclaimer</Link><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/credits">Credits</Link><Link to="/contact">Contact</Link></nav>
        Facts from NSE filings and end-of-day files, each with its source and date. Not investment advice. Early version: figures can be wrong — check the linked filing.
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
