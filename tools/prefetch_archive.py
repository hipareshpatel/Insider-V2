"""Prefetch NSE archive history into R2 (D128). Runs on a GitHub runner.
Usage: python3 tools/prefetch_archive.py <bucket> <from YYYY-MM-DD> <to YYYY-MM-DD>
Downloads the daily files (UDiFF bhavcopy, PR bundle, delivery, index closes) in parallel and uploads each
to R2 at cache/<url path>. Skips files already in R2 (listed once) and 404s (no session)."""
import concurrent.futures as cf, datetime as dt, json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
HOST = "https://nsearchives.nseindia.com"

def urls(d: dt.date):
    y, m, dd = d.strftime("%Y"), d.strftime("%m"), d.strftime("%d")
    return [f"{HOST}/content/cm/BhavCopy_NSE_CM_0_0_0_{y}{m}{dd}_F_0000.csv.zip",
            f"{HOST}/archives/equities/bhavcopy/pr/PR{dd}{m}{y[2:]}.zip",
            f"{HOST}/products/content/sec_bhavdata_full_{dd}{m}{y}.csv",
            f"{HOST}/content/indices/ind_close_all_{dd}{m}{y}.csv"]

def get(url):
    for i in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"}), timeout=60) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404: return 404, b""
            if e.code in (403, 429, 503) and i < 4: time.sleep(2 * (i + 1)); continue
            return e.code, b""
        except Exception:
            if i < 4: time.sleep(2 * (i + 1)); continue
            return 0, b""

def put(bucket, key, data):
    with tempfile.NamedTemporaryFile(delete=False) as f:
        f.write(data); p = f.name
    try:
        for i in range(4):
            r = subprocess.run(["npx", "--yes", "wrangler@4.156.1", "r2", "object", "put", f"{bucket}/{key}", "--file", p, "--remote"],
                               capture_output=True, text=True)
            if r.returncode == 0: return True
            time.sleep(3 * (i + 1))
        print("upload failed", key, r.stderr[-300:].replace("\n", " "), flush=True)
        return False
    finally:
        os.unlink(p)

def main():
    bucket, a, b = sys.argv[1], dt.date.fromisoformat(sys.argv[2]), dt.date.fromisoformat(sys.argv[3])
    days = [a + dt.timedelta(n) for n in range((b - a).days + 1)]
    jobs = [u for d in days for u in urls(d)]
    stats = {"ok": 0, "404": 0, "refused_or_error": 0, "bytes": 0, "upload_failed": 0}
    t0 = time.time()
    def work(u):
        code, data = get(u)
        if code == 200:
            key = "cache" + u[len(HOST):]
            return ("ok", len(data)) if put(bucket, key, data) else ("upload_failed", 0)
        return ("404", 0) if code == 404 else ("refused_or_error", 0)
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        for n, (k, size) in enumerate(ex.map(work, jobs), 1):
            stats[k] += 1; stats["bytes"] += size
            if n % 200 == 0: print(f"{n}/{len(jobs)} {stats} {time.time()-t0:.0f}s", flush=True)
    print("DONE", json.dumps(stats), f"{time.time()-t0:.0f}s", flush=True)
    if stats["refused_or_error"] > len(jobs) * 0.05: sys.exit(1)

if __name__ == "__main__":
    main()
