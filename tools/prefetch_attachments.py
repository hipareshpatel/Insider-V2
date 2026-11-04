"""D128: download archive-hosted attachments queued in fetch_job and hand them to the prefetch Worker's /ingest.
Usage: python3 tools/prefetch_attachments.py <worker base url> <minutes>   (env INGEST_TOKEN)
Reads batches from D1 via wrangler (filings DB), downloads 16 in parallel from the archive (0 refusals seen from
GitHub runners), PUTs bytes to /ingest which writes R2 and marks the job."""
import concurrent.futures as cf, json, os, subprocess, sys, time, urllib.error, urllib.request
from nse_session import NseSession  # D160: browser-session headers, one cookie jar per run

NSE = NseSession()
BASE, MINUTES = sys.argv[1].rstrip("/"), float(sys.argv[2])
TOKEN = os.environ["INGEST_TOKEN"]

def d1(binding, sql):
    for i in range(5):
        r = subprocess.run(["npx", "--yes", "wrangler@4.156.1", "d1", "execute", binding, "--remote", "-c", "wrangler.migrate.json", "--json", "--command", sql],
                           capture_output=True, text=True)
        if r.returncode == 0:
            out = r.stdout
            return json.loads(out[out.index("["):])[0]["results"]
        time.sleep(10 * (i + 1))
    raise SystemExit("d1 query failed: " + r.stderr[-300:])

# Owner's universe lock (4 Nov): only the 250 focus companies' files are downloaded (current members of the focus
# indices, every NSE symbol they have had). Queued files of other companies stay queued, untouched.
FOCUS = os.environ.get("FOCUS_INDICES", "NIFTY 50,NIFTY NEXT 50,NIFTY MIDCAP 150")
def focus_symbols():
    if FOCUS.strip().upper() == "ALL": return None
    names = json.dumps([x.strip() for x in FOCUS.split(",") if x.strip()]).replace("'", "''")
    rows = d1("DB_MARKET", "SELECT DISTINCT i.value FROM index_membership m CROSS JOIN security_identifier i ON i.security_id = m.security_id "
              f"AND i.id_type = 'nse_symbol' WHERE m.valid_to IS NULL AND m.index_name IN (SELECT value FROM json_each('{names}'))")
    syms = sorted(r["value"] for r in rows if r.get("value"))
    if not syms: raise SystemExit("focus list empty (no index snapshot?) - refusing to download everything")
    return syms
SYMS = focus_symbols()
print(f"focus: {'all' if SYMS is None else len(SYMS)} symbols", flush=True)

def batch(limit=1500):
    only = "" if SYMS is None else " AND symbol IN (SELECT value FROM json_each('" + json.dumps(SYMS).replace("'", "''") + "'))"
    sql = ("SELECT job_id, url FROM fetch_job WHERE url LIKE 'https://nsearchives%' "
           "AND (status='todo' OR (status='failed' AND attempts < 3 AND IFNULL(http_status, 0) <> 404))" + only +
           " ORDER BY attempts, job_id LIMIT " + str(int(limit)))
    return d1("DB_FILINGS", sql)

def fetch(url):
    for i in range(4):
        code, data = NSE.get(url)
        if code == 200: return 200, data
        if code in (403, 429, 503, 0) and i < 3: time.sleep(2 * (i + 1)); continue
        return code, b""
    return 0, b""

def ingest(job_id, status, http, data):
    req = urllib.request.Request(f"{BASE}/ingest?job={job_id}&status={status}&http={http}", data=data, method="PUT",
                                 headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/octet-stream", "User-Agent": "disclo-prefetch-attachments/1"})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r: return r.status == 200
        except urllib.error.HTTPError as e:
            if e.code == 403: raise SystemExit("ingest 403: " + e.read()[:200].decode("utf8", "replace"))
            time.sleep(2 * (i + 1))
        except Exception:
            time.sleep(2 * (i + 1))
    return False

def work(job):
    code, data = fetch(job["url"])
    st = "done" if code == 200 else "failed"
    return st, len(data), ingest(job["job_id"], st, code, data if code == 200 else b"")

t0 = time.time(); total = {"done": 0, "failed": 0, "bytes": 0, "ingest_errors": 0}
while time.time() - t0 < MINUTES * 60:
    jobs = batch()
    if not jobs:
        # audit P1: stop at once (was: polled D1 every minute for 20 quiet minutes); the next scheduled run picks up
        # whatever the daily slots queue later
        print("queue empty; done", flush=True)
        break
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        for st, n, ok in ex.map(work, jobs):
            total[st] += 1; total["bytes"] += n; total["ingest_errors"] += (not ok)
    print(f"{time.time()-t0:.0f}s {total}", flush=True)
print("DONE", json.dumps(total), flush=True)
