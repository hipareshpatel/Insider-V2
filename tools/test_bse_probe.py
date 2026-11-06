"""Tests for tools/bse_insider_probe.py (python3 -m unittest discover -s tools -p 'test_*.py').
Stop rules and output are tested on fakes; the identifiable user-agent is verified with a real headless Chromium against a LOCAL
server (skipped when Playwright is absent). Nothing here contacts BSE."""
import http.server, json, os, sys, threading, unittest
from datetime import date
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bse_insider_probe as p

HEAD = ("Security Code,Security Name,Name of Person,Category of person,Reported to Exchange\n")
def csv_of(code, name, n, day="09 Oct 2026"):
    return HEAD + "".join(f"{code},{name},SOME PERSON {i},Promoter,{day}\n" for i in range(n))


class Fake:
    def __init__(self, robots=((404, ""), (404, "")), home=(200, "<html>BSE</html>"), xhr=None):
        self._robots, self._home, self._xhr = list(robots), home, xhr or (lambda url: (200, "text/csv", csv_of("500180", "HDFC Bank Ltd", 2)))
        self.calls, self.closed = [], False
    def robots(self, url): self.calls.append(("robots", url)); return self._robots.pop(0)
    def home(self): self.calls.append(("home", p.HOME)); return self._home
    def xhr(self, url): self.calls.append(("xhr", url)); return self._xhr(url)
    def close(self): self.closed = True
    def kinds(self): return [k for k, _ in self.calls]


def good_xhr(url):
    if "scripCode=&" in url:                                           # check A: all companies
        return 200, "text/csv", HEAD + "".join(f"{500000 + i},Co {i},P {i},Promoter,0{1 + i % 9} Oct 2026\n" for i in range(30))
    code = url.split("scripCode=")[1].split("&")[0]
    names = {"500180": "HDFC Bank Ltd", "532174": "ICICI Bank Ltd", "500247": "Kotak Mahindra Bank Ltd", "532540": "Tata Consultancy Services Ltd", "500325": "Reliance Industries Ltd"}
    return 200, "text/csv", csv_of(code, names[code], 3 if code == "500180" else 0, "21 Jul 2026") if code != "500180" else csv_of(code, names[code], 3, "21 Jul 2026")


class Rules(unittest.TestCase):
    def run_(self, fake, sleeps=None):
        sl = [] if sleeps is None else sleeps
        s, code = p.run(fake, date(2026, 11, 6), sleep=sl.append)
        return s, code, sl

    def test_identifiable_user_agent_is_the_one_the_owner_named(self):
        self.assertEqual(p.UA, "DiscloBot/1.0 (+https://disclo.in/bot)")
        self.assertNotIn("Chrome", p.UA)

    def test_happy_path_counts_only_and_fixed_interval(self):
        f = Fake(xhr=good_xhr)
        s, code, sleeps = self.run_(f)
        self.assertEqual(code, 0)
        self.assertEqual(f.kinds(), ["robots", "robots", "home"] + ["xhr"] * 6)       # 2 robots + 1 page + 6 data requests
        self.assertEqual(sleeps, [5.0] * 8)                                           # fixed interval between every call, none before the first
        a = s["checks"]["A_all_companies_1_to_10_oct_2026"]
        self.assertEqual((a["rows"], a["distinct_securities"], a["reference_claimed_rows"]), (30, 30, 368))
        b = s["checks"]["B_per_name_3_may_to_today"]
        self.assertEqual(b["HDFC Bank (500180)"]["rows"], 3)
        self.assertEqual((b["HDFC Bank (500180)"]["newest_reported"], b["HDFC Bank (500180)"]["name_matches"]), ("2026-07-21", True))
        self.assertEqual(b["Tata Consultancy (532540)"]["rows"], 0)
        self.assertEqual(b["Reliance Industries (500325)"]["nse_pit_gg_filings_3may_to_5nov"], 2)

    def test_no_person_name_is_ever_in_the_output(self):
        s, _, _ = self.run_(Fake(xhr=good_xhr))
        self.assertNotIn("SOME PERSON", json.dumps(s))

    def test_robots_disallow_stops_before_any_page_or_data_request(self):
        rules = "User-agent: DiscloBot\nDisallow: /BseIndiaAPI/\n"
        f = Fake(robots=((404, ""), (200, rules)))
        s, code, _ = self.run_(f)
        self.assertEqual(code, 2)
        self.assertIn("robots.txt disallows", s["stopped"]["why"])
        self.assertEqual(f.kinds(), ["robots", "robots"])

    def test_a_generic_disallow_for_all_agents_also_binds_us(self):
        f = Fake(robots=((200, "User-agent: *\nDisallow: /\n"), (404, "")))
        s, code, _ = self.run_(f)
        self.assertEqual(code, 2); self.assertEqual(f.kinds(), ["robots", "robots"])

    def test_robots_refused_or_unreachable_stops(self):
        for status in (403, 429, 503, 0):
            f = Fake(robots=((status, ""), (404, "")))
            s, code, _ = self.run_(f)
            self.assertEqual(code, 2, status); self.assertEqual(f.kinds(), ["robots"])

    def test_a_robots_url_that_returns_a_web_page_publishes_no_rules(self):
        s, code, _ = self.run_(Fake(robots=((200, "<html>app</html>"), (200, "<html>app</html>")), xhr=good_xhr))
        self.assertEqual(code, 0); self.assertFalse(s["robots"]["www.bseindia.com"]["has_rules"])

    def test_refused_home_page_or_challenge_page_stops_before_data(self):
        for home in ((403, ""), (429, ""), (200, "<title>Access Denied</title> Reference #18.abc"), (200, "Just a moment... captcha")):
            f = Fake(home=home)
            s, code, _ = self.run_(f)
            self.assertEqual(code, 2, home); self.assertNotIn("xhr", f.kinds())

    def test_refusal_challenge_or_non_csv_from_the_api_stops_at_once(self):
        for ans in ((403, "", ""), (429, "", ""), (200, "text/html", "<html>Access Denied</html>"), (200, "text/html", "<html>ok</html>"), (200, "text/csv", "a,b,c\n1,2,3\n")):
            f = Fake(xhr=lambda url, a=ans: a)
            s, code, _ = self.run_(f)
            self.assertEqual(code, 2, ans); self.assertEqual(f.kinds().count("xhr"), 1)   # never retried, nothing else tried

    def test_server_error_is_a_failure_not_a_retry(self):
        f = Fake(xhr=lambda url: (502, "", ""))
        s, code, _ = self.run_(f)
        self.assertEqual(code, 3); self.assertEqual(f.kinds().count("xhr"), 1)

    def test_empty_body_for_a_name_is_zero_rows_not_a_stop(self):
        def xhr(url):
            return good_xhr(url) if "scripCode=&" in url else (200, "text/csv", "")
        s, code, _ = self.run_(Fake(xhr=xhr))
        self.assertEqual(code, 0)
        self.assertTrue(s["checks"]["B_per_name_3_may_to_today"]["HDFC Bank (500180)"]["empty_body"])

    def test_a_wrong_scrip_code_is_visible(self):
        def xhr(url):
            return good_xhr(url) if "scripCode=&" in url else (200, "text/csv", csv_of("500180", "Some Other Ltd", 1))
        s, _, _ = self.run_(Fake(xhr=xhr))
        self.assertFalse(s["checks"]["B_per_name_3_may_to_today"]["HDFC Bank (500180)"]["name_matches"])

    def test_session_is_always_closed(self):
        import contextlib, io
        f = Fake()
        with contextlib.redirect_stdout(io.StringIO()):
            p.main(["--to", "2026-11-06"], session=f, sleep=lambda s: None)
        self.assertTrue(f.closed)


try:
    import playwright.sync_api  # noqa: F401
    HAVE_PW = True
except ImportError:
    HAVE_PW = False


@unittest.skipUnless(HAVE_PW, "playwright not installed")
class RealBrowser(unittest.TestCase):
    def test_identifiable_user_agent_goes_on_robots_page_and_xhr_and_xhr_comes_from_the_page(self):
        seen = []

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def do_GET(self):
                seen.append((self.path, {k.lower(): v for k, v in self.headers.items()}))
                body, ctype = {"/robots.txt": (b"User-agent: *\nDisallow: /private\n", "text/plain"), "/api/csv": (b"Security Code,Security Name\n1,X\n", "text/csv")}.get(
                    self.path, (b"<html><title>home</title></html>", "text/html"))
                self.send_response(200); self.send_header("content-type", ctype); self.send_header("content-length", str(len(body))); self.end_headers(); self.wfile.write(body)

        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        home = f"http://127.0.0.1:{srv.server_address[1]}/"
        os.environ.setdefault("BSE_CHROMIUM_PATH", os.environ.get("NSE_CHROMIUM_PATH", ""))
        s = p.PlaywrightSession(home=home); s.start()
        try:
            r_status, r_text = s.robots(home + "robots.txt")
            h_status, _ = s.home()
            x_status, _ctype, x_text = s.xhr(home + "api/csv")
        finally:
            s.close(); srv.shutdown(); srv.server_close()
        self.assertEqual((r_status, h_status, x_status), (200, 200, 200)); self.assertIn("Disallow", r_text); self.assertTrue(x_text.startswith("Security Code"))
        by = {path: h for path, h in seen}
        for path in ("/robots.txt", "/", "/api/csv"):
            self.assertEqual(by[path]["user-agent"], p.UA, path)                    # identifiable on every kind of request
            self.assertNotIn("Chrome/", by[path]["user-agent"])
        self.assertEqual(by["/api/csv"]["referer"], home); self.assertEqual(by["/api/csv"]["sec-fetch-site"], "same-origin")


if __name__ == "__main__":
    unittest.main()
