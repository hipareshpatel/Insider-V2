"""D160 (owner #340): NSE browser-session compatibility for the GitHub scripts (same rules as packages/core/src/nse/session.ts).
Every NSE request carries a consistent set of current Chrome headers; a cookie jar is warmed on the NSE homepage before
the first API call, reused for the whole run, and re-warmed ONCE per run if NSE answers 401/403 (that request is retried
once). No proxies, no IP rotation, no CAPTCHA solving; request rates are the callers' (unchanged).
Archive files (nsearchives.nseindia.com) are fetched as a download from an NSE page (same-site); they need no cookies,
and NSE refuses GitHub's runners on its API host (C54), so a failed warm-up is ignored there."""
import http.cookiejar, threading, urllib.error, urllib.request

CHROME_MAJOR = 142  # keep equal to CHROME_MAJOR in packages/core/src/nse/session.ts; update about once a quarter
NSE_HOME = "https://www.nseindia.com/"
NSE_API_REFERER = "https://www.nseindia.com/companies-listing/corporate-filings-announcements"


def chrome_headers(major=CHROME_MAJOR):
    return {
        "User-Agent": f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{major}.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "sec-ch-ua": f'"Chromium";v="{major}", "Google Chrome";v="{major}", "Not_A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }


def nse_headers(kind, major=CHROME_MAJOR):
    h = chrome_headers(major)
    if kind == "api":
        h.update({"Accept": "application/json, text/plain, */*", "Referer": NSE_API_REFERER,
                  "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty"})
    elif kind == "archive":
        h.update({"Accept": "*/*", "Referer": NSE_HOME, "Sec-Fetch-Site": "same-site", "Sec-Fetch-Mode": "no-cors", "Sec-Fetch-Dest": "empty"})
    else:  # top-level page visit (cookie warm-up)
        h.update({"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Sec-Fetch-Site": "none",
                  "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", "Sec-Fetch-User": "?1", "Upgrade-Insecure-Requests": "1"})
    return h


class NseSession:
    """Thread-safe: one jar and one re-warm for the whole run (the scripts download in parallel)."""

    def __init__(self, timeout=60):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.timeout = timeout
        self.lock = threading.Lock()
        self.warmed = False
        self.rewarmed = False

    def warm(self):
        self.warmed = True
        try:
            with self.opener.open(urllib.request.Request(NSE_HOME, headers=nse_headers("page")), timeout=self.timeout) as r:
                r.read(1)
        except Exception:
            pass  # no cookies: requests still go out (GitHub runners are refused on the API host, C54)

    def get(self, url, kind=None):
        """(status, bytes). HTTP errors are returned as their status, network errors as status 0."""
        kind = kind or ("api" if url.startswith("https://www.nseindia.com/") else "archive")
        if kind == "api":
            with self.lock:
                if not self.warmed: self.warm()
        status, body = self._once(url, kind)
        if status in (401, 403) and kind == "api":
            with self.lock:
                first = not self.rewarmed
                if first:
                    self.rewarmed = True
                    self.jar.clear()
                    self.warm()
            if first: status, body = self._once(url, kind)
        return status, body

    def _once(self, url, kind):
        try:
            with self.opener.open(urllib.request.Request(url, headers=nse_headers(kind)), timeout=self.timeout) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, b""
        except Exception:
            return 0, b""
