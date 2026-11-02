"""D128: download archive-hosted attachments queued in fetch_job and hand them to the prefetch Worker's /ingest.
Usage: python3 tools/prefetch_attachments.py <worker base url> <minutes>   (env INGEST_TOKEN)
Reads batches from D1 via wrangler (filings DB), downloads 16 in parallel from the archive (0 refusals seen from
GitHub runners), PUTs bytes to /ingest which writes R2 and marks the job."""
import concurrent.futures as cf, json, os, subprocess, sys, time, urllib.error, urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
BASE, MINUTES = sys.argv[1].rstrip("/"), float(sys.argv[2])
TOKEN = os.environ["INGEST_TOKEN"]

def batch(limit=1500):
    sql = ("SELECT job_id, url FROM fetch_job WHERE url LIKE 'https://nsearchives%' "
           "AND (status='todo' OR (status='failed' AND attempts < 3 AND IFNULL(http_status, 0) <> 404)) "
           "ORDER BY attempts, job_id LIMIT " + str(int(limit)))
    for i in range(5):
        r = subprocess.run(["npx", "--yes", "wrangler@4.156.1", "d1", "execute", "DB_FILINGS", "--remote", "-c", "wrangler.migrate.json", "--json", "--command", sql],
                           capture_output=True, text=True)
        if r.returncode == 0:
            out = r.stdout
            return json.loads(out[out.index("["):])[0]["results"]
        time.sleep(10 * (i + 1))
    raise SystemExit("d1 query failed: " + r.stderr[-300:])

def fetch(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"}), timeout=60) as r:
                return 200, r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 429, 503) and i < 3: time.sleep(2 * (i + 1)); continue
            return e.code, b""
        except Exception:
            if i < 3: time.sleep(2 * (i + 1)); continue
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
        idle = globals().get("idle", 0) + 1; globals()["idle"] = idle
        print(f"queue empty ({idle} min); waiting for discovery", flush=True); time.sleep(60)
        if idle >= 20: break  # 20 quiet minutes: discovery has finished
        continue
    globals()["idle"] = 0
    with cf.ThreadPoolExecutor(max_workers=16) as ex:
        for st, n, ok in ex.map(work, jobs):
            total[st] += 1; total["bytes"] += n; total["ingest_errors"] += (not ok)
    print(f"{time.time()-t0:.0f}s {total}", flush=True)
print("DONE", json.dumps(total), flush=True)
