"""Tests for tools/nse_client.py. Run: python3 -m unittest discover -s tools -p 'test_*.py'
The decision logic is tested with fakes. The in-page route is tested against a LOCAL page with real headless Chromium
(skipped when Playwright is not installed): it proves the request really comes from inside a page (Origin, Referer,
Sec-Fetch-Site headers a page's XHR carries and a script's plain GET does not). It says nothing about NSE itself."""
import http.server, json, os, sys, threading, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nse_client
from nse_client import API_PREFIX, Blocked, Failed, InPage, NseClient

API = API_PREFIX + "corporates-pit-gg?index=equities"
ARCHIVE = "https://nsearchives.nseindia.com/corporate/xbrl/x.xml"
JSON_OK = b'{"data": [{"symbol": "ABC"}]}'


class FakeSession:
    def __init__(self, answers): self.answers, self.calls = list(answers), []
    def get(self, url):
        self.calls.append(url)
        return self.answers.pop(0) if self.answers else (200, JSON_OK)


class FakeInPage:
    def __init__(self, answers): self.answers, self.calls, self.closed = list(answers), [], False
    def get(self, url):
        self.calls.append(url)
        return self.answers.pop(0) if self.answers else (200, JSON_OK)
    def close(self): self.closed = True


def client(session, inpage, **kw):
    sleeps = []
    c = NseClient(session=session, inpage=inpage, sleep=sleeps.append, uniform=lambda a, b: (a + b) / 2, **kw)
    c.sleeps = sleeps
    return c


class Decisions(unittest.TestCase):
    def test_plain_route_answers_so_no_browser_is_used(self):
        s, p = FakeSession([(200, JSON_OK)]), FakeInPage([])
        f = client(s, p).get(API)
        self.assertEqual((f.status, f.via, f.body), (200, "plain", JSON_OK))
        self.assertEqual(p.calls, [])

    def test_refused_plain_moves_this_and_every_later_api_call_in_page(self):
        s, p = FakeSession([(403, b"")]), FakeInPage([(200, JSON_OK), (200, JSON_OK)])
        c = client(s, p)
        a, b = c.get(API), c.get(API + "&x=1")
        self.assertEqual([a.via, b.via], ["in_page_xhr", "in_page_xhr"])
        self.assertEqual(len(s.calls), 1)          # the plain route was asked once, then never again for API URLs
        self.assertTrue(c.in_page_mode)

    def test_archive_files_always_go_plain_even_in_page_mode(self):
        s, p = FakeSession([(403, b""), (200, b"<xml/>")]), FakeInPage([(200, JSON_OK)])
        c = client(s, p)
        c.get(API)
        f = c.get(ARCHIVE)
        self.assertEqual((f.via, f.body), ("plain", b"<xml/>"))
        self.assertEqual(p.calls, [API])

    def test_refusal_in_page_too_is_a_hard_stop_not_a_retry(self):
        s, p = FakeSession([(403, b"")]), FakeInPage([(403, b"")])
        with self.assertRaises(Blocked):
            client(s, p).get(API)
        self.assertEqual(len(p.calls), 1)

    def test_429_stops_at_once_on_either_route(self):
        with self.assertRaises(Blocked):
            client(FakeSession([(429, b"")]), FakeInPage([])).get(API)
        with self.assertRaises(Blocked):
            client(FakeSession([(429, b"")]), FakeInPage([])).get(ARCHIVE)

    def test_an_api_answer_that_is_not_json_is_blocked_not_stored(self):
        seen = []
        c = client(FakeSession([(200, b"<html>Access Denied</html>")]), FakeInPage([]), on_fetch=seen.append)
        with self.assertRaises(Blocked):
            c.get(API)
        self.assertEqual(seen, [])

    def test_network_errors_and_5xx_retry_three_times_with_growing_waits_then_fail(self):
        c = client(FakeSession([(0, b""), (502, b""), (0, b"")]), FakeInPage([]))
        with self.assertRaises(Failed):
            c.get(API)
        self.assertEqual(c.sleeps, [2, 4])
        c = client(FakeSession([(0, b""), (200, JSON_OK)]), FakeInPage([]))
        self.assertEqual(c.get(API).status, 200)

    def test_404_is_a_status_not_a_refusal(self):
        f = client(FakeSession([(404, b"")]), FakeInPage([])).get(ARCHIVE)
        self.assertEqual(f.status, 404)

    def test_pacing_waits_between_calls_but_not_before_the_first(self):
        c = client(FakeSession([]), FakeInPage([]))
        c.get(API); c.get(API); c.get(API)
        self.assertEqual(c.sleeps, [5.0, 5.0])      # midpoint of 4-6 s, twice

    def test_every_answer_is_handed_over_with_exact_bytes_and_route(self):
        seen = []
        c = client(FakeSession([(403, b"")]), FakeInPage([(200, JSON_OK)]), on_fetch=seen.append)
        c.get(API)
        self.assertEqual([(f.url, f.status, f.via, f.body) for f in seen], [(API, 200, "in_page_xhr", JSON_OK)])
        self.assertEqual(len(seen[0].sha256), 64)

    def test_close_closes_the_browser(self):
        p = FakeInPage([]); client(FakeSession([]), p).close(); self.assertTrue(p.closed)


class Pit(unittest.TestCase):
    def test_cli_stores_bytes_reports_route_and_exits_2_when_blocked(self):
        import tempfile, nse_pit_fetch, contextlib, io
        listing = json.dumps({"data": [{"symbol": "ABC", "broadcastDateTime": "03-Nov-2026 22:09:12", "xmlFileName": ARCHIVE}]}).encode()
        with tempfile.TemporaryDirectory() as d:
            c = client(FakeSession([(403, b""), (200, b"<xml/>")]), FakeInPage([(200, listing)]))
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = nse_pit_fetch.main([d, "--max-xml", "1"], client=c)
            s = json.loads(out.getvalue())
            self.assertEqual(code, 0)
            self.assertEqual(s["list"]["via"], "in_page_xhr"); self.assertEqual(s["list"]["filings"], 1)
            self.assertEqual(s["xml"], {"asked": 1, "ok": 1, "statuses": {"200": 1}}); self.assertTrue(s["in_page_mode_used"])
            def read(name, mode="r"):
                with open(os.path.join(d, name), mode) as fh:
                    return fh.read()
            self.assertEqual(len(read("manifest.jsonl").splitlines()), 2)
            self.assertIn(listing, [read(f, "rb") for f in os.listdir(d) if f.endswith(".bin")])
        with tempfile.TemporaryDirectory() as d:
            c = client(FakeSession([(403, b"")]), FakeInPage([(403, b"")]))
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = nse_pit_fetch.main([d], client=c)
            self.assertEqual(code, 2)
            self.assertEqual(json.loads(out.getvalue())["stopped"]["kind"], "blocked")


try:
    import playwright.sync_api  # noqa: F401
    HAVE_PW = True
except ImportError:
    HAVE_PW = False


@unittest.skipUnless(HAVE_PW, "playwright not installed")
class RealBrowser(unittest.TestCase):
    def test_xhr_comes_from_inside_a_page(self):
        seen = []

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def do_GET(self):
                seen.append((self.path, {k.lower(): v for k, v in self.headers.items()}))
                if self.path == "/api/probe":
                    body, ctype = b'{"ok": true}', "application/json"
                else:
                    body, ctype = b"<html><title>home</title></html>", "text/html"
                self.send_response(200); self.send_header("content-type", ctype); self.send_header("content-length", str(len(body))); self.end_headers(); self.wfile.write(body)

        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        home = f"http://127.0.0.1:{srv.server_address[1]}/"
        ip = InPage(home=home)
        try:
            status, body = ip.get(home + "api/probe")
        finally:
            ip.close(); srv.shutdown(); srv.server_close()
        self.assertEqual((status, json.loads(body)), (200, {"ok": True}))
        api = next(h for p, h in seen if p == "/api/probe")
        self.assertEqual(api.get("referer"), home)                        # a page's XHR carries the page as its referrer
        self.assertIn("sec-fetch-site", api); self.assertEqual(api["sec-fetch-site"], "same-origin")
        self.assertIn("HeadlessChrome", api["user-agent"])                # stock headless browser, honestly identified


if __name__ == "__main__":
    unittest.main()
