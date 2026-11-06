"""NSE client with an in-page fallback — the pattern of the public NSE-BSE-Insider-Tracker repo's BSE client
(collectors/bse/client.py), applied to NSE. Written from its documented behaviour; no code copied.

How a request goes:
1. PLAIN: `NseSession` (tools/nse_session.py, D160): browser-session headers, cookie warm-up, one re-warm on 401/403.
2. IN-PAGE: if the plain route is still refused (401/403) on an API URL, the rest of the run asks from INSIDE a
   www.nseindia.com page in headless Chrome, with an XHR — the way NSE's own pages call their API. The browser is the
   stock one: it is not disguised (no automation-hiding flags, no user-agent change), so NSE sees what it is.
3. STOP: a refusal in-page too (401/403), or any 429, or an API answer that is not JSON (an "Access Denied" page) raises
   `Blocked`. The client never retries a refusal, rotates anything, or tries another way round. Network errors and 5xx
   are retried (3 tries, growing wait), then `Failed`. A 404 is returned as a status: that file is missing, NSE has not
   refused anything.

Pacing: 4-6 s between calls (the reference's BSE rhythm). Every answer is handed to `on_fetch` with the exact bytes and
which route got them (`via`: 'plain' | 'in_page_xhr'), so the raw copy is stored before anything is parsed (CLAUDE rule:
raw is write-once).

What this does NOT do: it cannot change which IP addresses NSE refuses. C54 (4 Nov): GitHub's runners are refused on the
API host; a browser started on the same runner shares that address. Whether the in-page route gets through from a given
network is measured by `.github/workflows/nse-inpage-probe.yml`, not assumed.
"""
from __future__ import annotations

import hashlib
import os
import random
import time
from dataclasses import dataclass, field
from typing import Callable

NSE_HOME = "https://www.nseindia.com/"
API_PREFIX = "https://www.nseindia.com/api/"
PACE_SECONDS = (4.0, 6.0)
RETRIES = 3
STOP_STATUSES = (401, 403, 429)


class Blocked(RuntimeError):
    """NSE refused (401/403/429) or sent something that is not data. Stop; do not try another way round."""


class Failed(RuntimeError):
    """Still failing after the retries (network error or 5xx)."""


@dataclass
class Fetched:
    url: str
    status: int
    body: bytes
    via: str                      # 'plain' | 'in_page_xhr'
    sha256: str = field(default="")

    def __post_init__(self):
        self.sha256 = hashlib.sha256(self.body).hexdigest()


def is_api(url: str) -> bool:
    return url.startswith(API_PREFIX)


def looks_like_json(body: bytes) -> bool:
    return body.lstrip()[:1] in (b"{", b"[")


class InPage:
    """api calls made by an XHR from inside a www.nseindia.com page (stock headless Chromium, not disguised).
    `home` and `launch` are injectable so the class can be tested against a local page."""

    SCRIPT = ("(url) => new Promise((resolve) => { const x = new XMLHttpRequest(); x.open('GET', url); x.timeout = 90000;"
              "x.setRequestHeader('Accept', 'application/json, text/plain, */*');"
              "x.onload = () => resolve([x.status, x.getResponseHeader('content-type') || '', x.responseText]);"
              "x.onerror = x.ontimeout = () => resolve([0, '', '']); x.send(); })")

    def __init__(self, home: str = NSE_HOME, launch: Callable | None = None):
        self.home, self._launch = home, launch
        self._pw = self._browser = self._page = None

    def _start(self):
        if self._page is not None:
            return
        if self._launch:
            self._page = self._launch(self.home)
            return
        from playwright.sync_api import sync_playwright  # imported late: only needed when the fallback is used
        self._pw = sync_playwright().start()
        # Stock Chromium, default arguments (--no-sandbox only because CI runs as root in a container).
        self._browser = self._pw.chromium.launch(headless=True, args=["--no-sandbox"], executable_path=os.environ.get("NSE_CHROMIUM_PATH") or None)
        self._page = self._browser.new_context(locale="en-US").new_page()
        self._page.goto(self.home, wait_until="domcontentloaded", timeout=60000)

    def get(self, url: str) -> tuple[int, bytes]:
        self._start()
        status, _ctype, text = self._page.evaluate(self.SCRIPT, url)
        return int(status), text.encode("utf-8")

    def close(self):
        for o in (self._browser, self._pw):
            try:
                if o is not None:
                    o.close() if hasattr(o, "close") else o.stop()
            except Exception:
                pass
        self._pw = self._browser = self._page = None


class NseClient:
    def __init__(self, session=None, inpage: InPage | None = None, on_fetch: Callable[[Fetched], None] | None = None,
                 pace: tuple[float, float] = PACE_SECONDS, retries: int = RETRIES,
                 sleep: Callable[[float], None] = time.sleep, uniform: Callable[[float, float], float] = random.uniform):
        if session is None:
            from nse_session import NseSession
            session = NseSession()
        self.session, self.inpage, self.on_fetch = session, inpage or InPage(), on_fetch
        self.pace, self.retries, self._sleep, self._uniform = pace, retries, sleep, uniform
        self.in_page_mode = False       # once the plain route is refused on an API URL, the rest of the run goes in-page
        self._calls = 0

    def _pace(self):
        if self._calls:
            self._sleep(self._uniform(*self.pace))
        self._calls += 1

    def _ask(self, url: str) -> tuple[int, bytes, str]:
        if self.in_page_mode and is_api(url):
            status, body = self.inpage.get(url)
            return status, body, "in_page_xhr"
        status, body = self.session.get(url)
        return status, body, "plain"

    def get(self, url: str) -> Fetched:
        """One answer (any status except a refusal). Raises Blocked on a refusal, Failed after the retries."""
        self._pace()
        for attempt in range(1, self.retries + 1):
            status, body, via = self._ask(url)
            if status in (401, 403) and via == "plain" and is_api(url):
                # the plain route (after its own single re-warm) is refused: from here on, ask from inside the page
                self.in_page_mode = True
                status, body, via = self._ask(url)
            if status in STOP_STATUSES:
                raise Blocked(f"NSE answered {status} ({via}) for {url}")
            if status == 200 and is_api(url) and not looks_like_json(body):
                raise Blocked(f"NSE sent something that is not data for {url} ({via}, {len(body)} bytes)")
            if status == 0 or status >= 500:
                if attempt == self.retries:
                    raise Failed(f"{url}: still failing after {self.retries} tries (last status {status}, {via})")
                self._sleep(2 ** attempt)
                continue
            f = Fetched(url, status, body, via)
            if self.on_fetch:
                self.on_fetch(f)
            return f
        raise Failed(url)  # pragma: no cover

    def close(self):
        self.inpage.close()
