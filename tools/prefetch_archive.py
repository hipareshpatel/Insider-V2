"""Prefetch NSE archive history into R2 (D128). Runs on a GitHub runner.
Usage: python3 tools/prefetch_archive.py <bucket> <from YYYY-MM-DD> <to YYYY-MM-DD> [set]
set = market (default: UDiFF bhavcopy, PR bundle, delivery, index closes) | structure (D144: F&O participant OI,
F&O ban list, price bands) | snapshot (today's bulk.csv / block.csv, complete; the history API caps at 70 rows)
| indices (D156: daily index file only — OHLC, P/E, P/B, yield of every index — for the 10-year index history)
| indices_weekends (C52: the same file for Saturdays and Sundays only — special sessions such as Diwali muhurat and
Budget-day Saturdays; writes cache/content/indices/_weekends_<from>_<to>.done when the run completes).
Uploads each file to R2 at cache/<url path> (snapshots: cache/<path>_<date>). With ONLY_MISSING=1 (the 23:07 retry,
audit P1) a file already in R2 is not downloaded again; otherwise R2 is not checked, so run it only for dates not yet
fetched (the daily schedule runs today only; owner #265: never download twice). Requests: D160 browser session."""
import concurrent.futures as cf, datetime as dt, json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
from nse_session import NseSession  # D160: browser-session headers

NSE = NseSession()
ONLY_MISSING = os.environ.get("ONLY_MISSING") == "1"
HOST = "https://nsearchives.nseindia.com"

def urls(d: dt.date, which: str = "market"):
    y, m, dd = d.strftime("%Y"), d.strftime("%m"), d.strftime("%d")
    if which in ("indices", "indices_weekends"):
        return [f"{HOST}/content/indices/ind_close_all_{dd}{m}{y}.csv"]
    if which == "structure":
        return [f"{HOST}/content/nsccl/fao_participant_oi_{dd}{m}{y}.csv",
                f"{HOST}/archives/fo/sec_ban/fo_secban_{dd}{m}{y}.csv",
                f"{HOST}/content/equities/sec_list_{dd}{m}{y}.csv"]
    return [f"{HOST}/content/cm/BhavCopy_NSE_CM_0_0_0_{y}{m}{dd}_F_0000.csv.zip",
            f"{HOST}/archives/equities/bhavcopy/pr/PR{dd}{m}{y[2:]}.zip",
            f"{HOST}/products/content/sec_bhavdata_full_{dd}{m}{y}.csv",
            f"{HOST}/content/indices/ind_close_all_{dd}{m}{y}.csv"]

def get(url):
    for i in range(5):
        code, data = NSE.get(url, "archive")
        if code in (200, 404): return code, data
        if code in (403, 429, 503, 0) and i < 4: time.sleep(2 * (i + 1)); continue
        return code, b""
    return 0, b""

def in_r2(bucket, key):
    """True when the object exists (one R2 read; used only by the ONLY_MISSING retry, ~11 files a day)."""
    r = subprocess.run(["npx", "--yes", "wrangler@4.156.1", "r2", "object", "get", f"{bucket}/{key}", "--pipe", "--remote"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return r.returncode == 0

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
    which = sys.argv[4] if len(sys.argv) > 4 else "market"
    all_days = [a + dt.timedelta(n) for n in range((b - a).days + 1)]
    if which == "indices_weekends": days = [d for d in all_days if d.weekday() >= 5]
    else: days = [d for d in all_days if d.weekday() < 5 or which == "market"]
    if which == "snapshot":
        for u in (f"{HOST}/content/equities/bulk.csv", f"{HOST}/content/equities/block.csv"):
            key = "cache" + u[len(HOST):].replace(".csv", f"_{b.isoformat()}.csv")
            if ONLY_MISSING and in_r2(bucket, key): print(u, "already in R2", flush=True); continue
            code, data = get(u)
            print(u, code, len(data), "uploaded" if code == 200 and put(bucket, key, data) else "skipped", flush=True)
        return
    jobs = ([f"{HOST}/content/equities/EQUITY_L.csv", f"{HOST}/emerge/corporates/content/SME_EQUITY_L.csv"] if which == "market" else []) + [u for d in days for u in urls(d, which)]
    if ONLY_MISSING:
        # retry run: only what the first run did not store (the company lists are refreshed by the first run only)
        jobs = [u for u in jobs if "EQUITY_L" not in u and not in_r2(bucket, "cache" + u[len(HOST):])]
        print(f"only missing: {len(jobs)} file(s) to fetch", flush=True)
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
    if which == "indices_weekends" and stats["refused_or_error"] == 0 and stats["upload_failed"] == 0:
        # the loader reads weekends only once this marker exists (a partial run must not count as complete)
        put(bucket, f"cache/content/indices/_weekends_{a.isoformat()}_{b.isoformat()}.done", json.dumps(stats).encode())
    if jobs and stats["refused_or_error"] > len(jobs) * 0.05: sys.exit(1)

if __name__ == "__main__":
    main()
