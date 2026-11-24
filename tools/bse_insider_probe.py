"""BSE insider-trading (SEBI PIT) cross-check for the five names NSE's list holds nothing for. READ-ONLY, tiny, rule-bound.

Why: NSE's `corporates-pit-gg` list (6 Nov probe) holds HDFCBANK 0, ICICIBANK 0, KOTAKBANK 0, TCS 0, RELIANCE 2 filings since
3 May 2026. Under SEBI PIT Reg 7(2)(b) the company notifies every exchange it is listed on, so BSE is the independent check:
if BSE's insider CSV holds filings for these names, NSE's list is incomplete; if it holds none, they most likely filed none.

Rules (owner, 6 Nov, "Fill the insider-trading gap"): standard Playwright with an IDENTIFIABLE user-agent, fixed gentle
intervals, no circumvention of any kind (no proxy rotation, no CAPTCHA handling, no automation-hiding flags, no header
mimicry). robots.txt is NOT read and NOT a gate (owner decision D172, 6 Nov); `--respect-robots` turns the old gate back on.
What does NOT change: any 401/403/429, any challenge page, or anything that is not the expected CSV stops the run at once
(exit 2); nothing else is tried. A refusal is a refusal whether or not robots.txt is read.

What it asks (BSE's own page calls these; the request is an XHR made from inside a www.bseindia.com page):
  the BSE home page (and, only with --respect-robots, robots.txt of both hosts); then
  api.bseindia.com/BseIndiaAPI/api/Corp_Regulation_DownloadCSV_ng/w?scripCode=&Regulation=&fromDT=&ToDate=&Isdefault=2
  A. all companies, 1-10 Oct 2026 (replicates the reference repo's published count of 368 rows)
  B. one request per name, 3 May 2026 -> today: 5 requests
Total: 1 page + 6 data requests, 5 s apart (+2 robots requests with --respect-robots).

Output: JSON of counts and dates per COMPANY only. Names of persons are never printed or stored; no file is written.
Terms of use are NOT checked by this tool: that reading is the owner's.

    python3 tools/bse_insider_probe.py [--to YYYY-MM-DD] [--respect-robots]      exit 0 ok · 2 blocked/refused · 3 failed
"""
import argparse, csv, io, json, os, re, sys, time
from datetime import date, datetime
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

UA = "DiscloBot/1.0 (+https://disclo.in/bot)"
BOT = "DiscloBot"
HOME = "https://www.bseindia.com/"
API = "https://api.bseindia.com/BseIndiaAPI/api/"
CSV_PATH = "Corp_Regulation_DownloadCSV_ng/w"
ROBOTS = ("https://www.bseindia.com/robots.txt", "https://api.bseindia.com/robots.txt")
INTERVAL_SECONDS = 5.0                      # fixed, not jittered
STOP_STATUSES = (401, 403, 429)
CSV_HEAD = "Security Code,Security Name,Name of Person"
CHALLENGE = re.compile(r"access denied|captcha|just a moment|pardon our interruption|unusual traffic|request unsuccessful|"
                       r"attention required|incapsula|reference #\d|are you a robot|verify you are human", re.I)
# BSE scrip codes of the five names; the name BSE answers with is reported so a wrong code cannot pass silently.
NAMES = {"500180": "HDFC Bank", "532174": "ICICI Bank", "500247": "Kotak Mahindra Bank", "532540": "Tata Consultancy", "500325": "Reliance Industries"}
NSE_PIT_GG_FILINGS = {"500180": 0, "532174": 0, "500247": 0, "532540": 0, "500325": 2}   # 6 Nov probe, for the side-by-side
REFERENCE_CLAIM_ROWS = 368                  # reference repo docs: 1-10 Oct 2026, all companies


class Blocked(RuntimeError):
    """A refusal, a challenge, a robots.txt disallow, or an answer that is not the expected data. Stop."""


class Failed(RuntimeError):
    """A non-refusal failure (network error, 5xx). Stop; the run is small enough to repeat by hand."""


class PlaywrightSession:
    """Stock headless Chromium with the identifiable user-agent. Requests go from inside a www.bseindia.com page."""
    SCRIPT = ("(url) => new Promise((resolve) => { const x = new XMLHttpRequest(); x.open('GET', url); x.timeout = 90000;"
              "x.onload = () => resolve([x.status, x.getResponseHeader('content-type') || '', x.responseText]);"
              "x.onerror = x.ontimeout = () => resolve([0, '', '']); x.send(); })")

    def __init__(self, home=HOME, user_agent=UA):
        self.home_url, self.ua = home, user_agent
        self._pw = self._browser = self._ctx = self._page = None

    def start(self):
        from playwright.sync_api import sync_playwright   # late import: the decision logic is testable without it
        self._pw = sync_playwright().start()
        # Default arguments only (--no-sandbox because CI runs as root in a container). No automation-hiding flags.
        self._browser = self._pw.chromium.launch(headless=True, args=["--no-sandbox"], executable_path=os.environ.get("BSE_CHROMIUM_PATH") or None)
        self._ctx = self._browser.new_context(user_agent=self.ua, locale="en-US")
        self._page = self._ctx.new_page()

    def robots(self, url):
        r = self._ctx.request.get(url, timeout=30000)
        return r.status, r.text()

    def home(self):
        resp = self._page.goto(self.home_url, wait_until="domcontentloaded", timeout=60000)
        return (resp.status if resp else 0), self._page.content()[:20000]

    def xhr(self, url):
        status, ctype, text = self._page.evaluate(self.SCRIPT, url)
        return int(status), ctype, text

    def close(self):
        for o in (self._browser, self._pw):
            try:
                if o is not None:
                    o.close() if hasattr(o, "close") else o.stop()
            except Exception:
                pass


def ymd(d):
    return d.strftime("%Y%m%d")


def parse_day(v):
    try:
        return datetime.strptime(str(v or "").strip(), "%d %b %Y").date()
    except ValueError:
        return None


def aggregate(text):
    """(header_ok, summary) of one CSV answer: company-level counts and dates only; no person field is read."""
    body = text.lstrip("﻿")
    rows = list(csv.reader(io.StringIO(body)))
    if not rows:
        return True, {"rows": 0, "empty_body": True}
    head, data = rows[0], [r for r in rows[1:] if any(c.strip() for c in r)]
    col = lambda prefix: next((i for i, h in enumerate(head) if h.strip().lower().startswith(prefix.lower())), None)
    i_code, i_name, i_rep = col("Security Code"), col("Security Name"), col("Reported to Exchange")
    if i_code is None or i_name is None:
        return False, {}
    days = [d for d in (parse_day(r[i_rep]) for r in data if i_rep is not None and len(r) > i_rep) if d]
    return True, {"rows": len(data), "distinct_securities": len({r[i_code].strip() for r in data if len(r) > i_code}),
                  "security_names": sorted({r[i_name].strip() for r in data if len(r) > i_name})[:3],
                  "oldest_reported": min(days).isoformat() if days else None, "newest_reported": max(days).isoformat() if days else None}


def run(sess, to_day, sleep=time.sleep, interval=INTERVAL_SECONDS, respect_robots=False):
    summary = {"user_agent": UA, "interval_seconds": interval, "robots": {"read": respect_robots}, "home": None, "checks": {}}
    calls = [0]

    def pace():
        if calls[0]:
            sleep(interval)
        calls[0] += 1

    try:
        # 1. robots.txt: not read and not a gate (D172) unless --respect-robots
        if respect_robots:
            parsers = {}
            for url in ROBOTS:
                pace()
                status, text = sess.robots(url)
                host = urlparse(url).netloc
                if status in STOP_STATUSES or status >= 500 or status == 0:
                    raise Blocked(f"robots.txt of {host} answered {status}: access policy cannot be confirmed")
                looks = status == 200 and re.search(r"(?im)^\s*user-agent\s*:", text) is not None
                summary["robots"][host] = {"status": status, "has_rules": looks}
                if looks:
                    rp = RobotFileParser()
                    rp.parse(text.splitlines())
                    parsers[host] = rp
            targets = {"home page": HOME, "insider CSV": API + CSV_PATH}
            summary["robots"]["can_fetch"] = {}
            for label, url in targets.items():
                rp = parsers.get(urlparse(url).netloc)
                ok = True if rp is None else rp.can_fetch(BOT, url)
                summary["robots"]["can_fetch"][label] = ok
                if not ok:
                    raise Blocked(f"robots.txt disallows {label} for {BOT}")
        # 2. the page the XHR will come from
        pace()
        status, page = sess.home()
        if status in STOP_STATUSES or status >= 400 or status == 0:
            raise Blocked(f"BSE home page answered {status}")
        if CHALLENGE.search(page):
            raise Blocked("BSE home page is a challenge / access-denied page")
        summary["home"] = {"status": status}

        def fetch_csv(code, a, b):
            pace()
            url = f"{API}{CSV_PATH}?scripCode={code}&Regulation=&fromDT={ymd(a)}&ToDate={ymd(b)}&Isdefault=2"
            status, _ctype, text = sess.xhr(url)
            if status in STOP_STATUSES:
                raise Blocked(f"BSE API answered {status}")
            if status == 0 or status >= 500:
                raise Failed(f"BSE API answered {status}")
            if status != 200:
                raise Blocked(f"BSE API answered {status}")
            if text.strip() and not text.lstrip("﻿").startswith(CSV_HEAD):
                raise Blocked("BSE API answered something that is not the expected CSV" + (" (challenge page)" if CHALLENGE.search(text) else ""))
            ok, agg = aggregate(text)
            if not ok:
                raise Blocked("BSE API CSV lacks the expected columns")
            agg["bytes"] = len(text)
            return agg

        # 3. A: replicate the published count; B: one request per name
        a = fetch_csv("", date(2026, 10, 1), date(2026, 10, 10))
        a["reference_claimed_rows"] = REFERENCE_CLAIM_ROWS
        summary["checks"]["A_all_companies_1_to_10_oct_2026"] = a
        b = {}
        for code, label in NAMES.items():
            r = fetch_csv(code, date(2026, 5, 3), to_day)
            r["expected_name_contains"] = label
            r["name_matches"] = any(label.lower().split()[0] in n.lower() for n in r.get("security_names", [])) if r.get("rows") else None
            r["nse_pit_gg_filings_3may_to_5nov"] = NSE_PIT_GG_FILINGS[code]
            b[f"{label} ({code})"] = r
        summary["checks"]["B_per_name_3_may_to_today"] = b
        return summary, 0
    except Blocked as e:
        summary["stopped"] = {"kind": "blocked", "why": str(e)}
        return summary, 2
    except Failed as e:
        summary["stopped"] = {"kind": "failed", "why": str(e)}
        return summary, 3


def main(argv=None, session=None, sleep=time.sleep):
    ap = argparse.ArgumentParser()
    ap.add_argument("--to", default=date.today().isoformat())
    ap.add_argument("--respect-robots", action="store_true", help="read robots.txt first and stop if it disallows (off by default, D172)")
    a = ap.parse_args(argv)
    sess = session or PlaywrightSession()
    if session is None:
        sess.start()
    try:
        summary, code = run(sess, date.fromisoformat(a.to), sleep=sleep, respect_robots=a.respect_robots)
    finally:
        sess.close()
    print(json.dumps(summary, indent=2))
    return code


if __name__ == "__main__":
    sys.exit(main())
