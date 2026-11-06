"""Fetch NSE's insider-trading (PIT) filing list and a few of its XBRL files through `NseClient` (plain route first, then
the in-page route if the plain one is refused), store the exact bytes, and say which route worked.

    python3 tools/nse_pit_fetch.py OUT_DIR [--max-xml 5] [--from 01-11-2026 --to 05-11-2026]

Read-only: it only GETs public NSE files. It does not parse, load or change anything in our databases. Exit codes:
0 = list fetched; 2 = NSE refused (Blocked: stopped at once, nothing else tried); 3 = failed after retries.
The summary on stdout carries counts and statuses only (workflow logs are public): no bodies, no names.
"""
import argparse, hashlib, json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nse_client import Blocked, Failed, NseClient

LIST_URL = "https://www.nseindia.com/api/corporates-pit-gg?index=equities"


def main(argv=None, client=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--max-xml", type=int, default=5)
    ap.add_argument("--from", dest="from_date")
    ap.add_argument("--to", dest="to_date")
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    manifest = open(os.path.join(a.out, "manifest.jsonl"), "a", encoding="utf-8")

    def keep(f):  # raw is write-once: the bytes are on disk before anything reads them
        name = f"{f.sha256[:16]}.bin"
        with open(os.path.join(a.out, name), "wb") as fh:
            fh.write(f.body)
        manifest.write(json.dumps({"url": f.url, "status": f.status, "via": f.via, "bytes": len(f.body), "sha256": f.sha256,
                                   "file": name, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}) + "\n")
        manifest.flush()

    client = client or NseClient(on_fetch=keep)
    if client.on_fetch is None:
        client.on_fetch = keep
    url = LIST_URL + (f"&from_date={a.from_date}&to_date={a.to_date}" if a.from_date and a.to_date else "")
    summary = {"list": None, "xml": {"asked": 0, "ok": 0, "statuses": {}}, "routes": {}}
    code = 0
    try:
        lst = client.get(url)
        rows = []
        if lst.status == 200:
            d = json.loads(lst.body)
            rows = d.get("data", []) if isinstance(d, dict) else d
        summary["list"] = {"status": lst.status, "via": lst.via, "bytes": len(lst.body), "filings": len(rows),
                           "newest_broadcast": max((str(r.get("broadcastDateTime") or "") for r in rows), default=None)}
        for r in rows[: a.max_xml]:
            u = r.get("xmlFileName")
            if not u:
                continue
            summary["xml"]["asked"] += 1
            f = client.get(u)
            summary["xml"]["statuses"][str(f.status)] = summary["xml"]["statuses"].get(str(f.status), 0) + 1
            summary["xml"]["ok"] += f.status == 200
    except Blocked as e:
        summary["stopped"] = {"kind": "blocked", "why": str(e).split(" for ")[0]}
        code = 2
    except Failed as e:
        summary["stopped"] = {"kind": "failed", "why": str(e).split(":")[0][:80]}
        code = 3
    finally:
        client.close()
        manifest.close()
    summary["in_page_mode_used"] = client.in_page_mode
    print(json.dumps(summary, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
