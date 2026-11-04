"""C53 / owner #330: insider-trading filings (SEBI PIT) from NSE's system in use since 3 May 2026, downloaded on a
GitHub runner and passed to Cloudflare as ONE file per run (one R2 upload instead of thousands).

Usage: python3 tools/prefetch_pit_gg.py <bucket> <from YYYY-MM-DD> <to YYYY-MM-DD>
1. The filing list: /api/corporates-pit-gg?index=equities&from_date=&to_date=, one calendar month per call (the call
   honours the range: May 2026 = 347 filings; the undated list = the latest ~3,300).
2. Each filing's XBRL (`xmlFileName`, on the archive host) — the trades themselves.
3. One gzip JSON-lines bundle -> R2 bundles/pit_gg/<from>_<to>.jsonl.gz: one line per filing
   {"meta": <list row>, "xml": <XBRL text or null>, "http": <status>}; the Worker loads it.
The requests identify this job honestly; a refusal is reported, never worked around."""
import calendar, concurrent.futures as cf, datetime as dt, gzip, json, subprocess, sys, tempfile, time, urllib.error, urllib.request

UA = "disclo-prefetch/1.0 (+https://disclo.in)"
API = "https://www.nseindia.com/api/corporates-pit-gg?index=equities"

def get(url, tries=5):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, */*"}), timeout=60) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404: return 404, b""
            if e.code in (403, 429, 503) and i < tries - 1: time.sleep(3 * (i + 1)); continue
            return e.code, b""
        except Exception:
            if i < tries - 1: time.sleep(3 * (i + 1)); continue
            return 0, b""

def months(a, b):
    d = dt.date(a.year, a.month, 1)
    while d <= b:
        last = dt.date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])
        yield max(a, d), min(b, last)
        d = last + dt.timedelta(1)

def main():
    bucket, a, b = sys.argv[1], dt.date.fromisoformat(sys.argv[2]), dt.date.fromisoformat(sys.argv[3])
    rows, refused = [], 0
    for f, t in months(a, b):
        code, body = get(f"{API}&from_date={f:%d-%m-%Y}&to_date={t:%d-%m-%Y}")
        if code != 200 or not body.lstrip().startswith(b"{"):
            print(f"list {f}..{t}: HTTP {code}, refused", flush=True); refused += 1; continue
        part = json.loads(body).get("data", [])
        print(f"list {f}..{t}: {len(part)} filings", flush=True)
        rows += part
    seen, uniq = set(), []
    for r in rows:
        k = r.get("appId") or r.get("xmlFileName")
        if k not in seen: seen.add(k); uniq.append(r)
    def one(r):
        u = r.get("xmlFileName")
        if not u: return {"meta": r, "xml": None, "http": None}
        code, body = get(u)
        return {"meta": r, "xml": body.decode("utf-8", "replace") if code == 200 else None, "http": code}
    stats = {"filings": len(uniq), "xml_ok": 0, "xml_missing": 0, "lists_refused": refused}
    t0 = time.time()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jsonl.gz") as tmp, gzip.open(tmp.name, "wt", encoding="utf-8") as out:
        with cf.ThreadPoolExecutor(max_workers=8) as ex:
            for n, rec in enumerate(ex.map(one, uniq), 1):
                stats["xml_ok" if rec["xml"] else "xml_missing"] += 1
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                if n % 500 == 0: print(f"{n}/{len(uniq)} {stats} {time.time()-t0:.0f}s", flush=True)
        path = tmp.name
    key = f"bundles/pit_gg/{a.isoformat()}_{b.isoformat()}.jsonl.gz"
    if not uniq: print("DONE nothing to upload", json.dumps(stats)); sys.exit(1 if refused else 0)
    r = subprocess.run(["npx", "--yes", "wrangler@4.156.1", "r2", "object", "put", f"{bucket}/{key}", "--file", path, "--remote",
                        "--content-type", "application/gzip"], capture_output=True, text=True)
    print("upload", key, "ok" if r.returncode == 0 else ("FAILED " + r.stderr[-300:].replace("\n", " ")), flush=True)
    print("DONE", json.dumps(stats), f"{time.time()-t0:.0f}s", flush=True)
    if r.returncode != 0 or refused: sys.exit(1)

if __name__ == "__main__":
    main()
