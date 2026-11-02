// One-off probe: which NSE endpoints answer from Cloudflare's egress IPs?
// Only response headers / a small prefix of each body are read, to stay
// within the Free-plan CPU budget.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const BASE_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

// Recent weekday (dates are only for archive files; a 404 on a holiday is expected).
function lastWeekday(offsetDays = 1): Date {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000); // IST
  d.setUTCDate(d.getUTCDate() - offsetDays);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
const p2 = (n: number) => String(n).padStart(2, "0");

interface Result {
  name: string;
  url: string;
  status: number | null;
  ok: boolean;
  ms: number;
  contentType?: string | null;
  contentLength?: string | null;
  sample?: string;
  error?: string;
}

async function probe(name: string, url: string, headers: Record<string, string> = {}, sampleBytes = 0): Promise<Result> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { ...BASE_HEADERS, ...headers }, redirect: "manual" });
    let sample: string | undefined;
    if (sampleBytes > 0 && res.body) {
      const reader = res.body.getReader();
      const { value } = await reader.read();
      await reader.cancel();
      sample = value ? new TextDecoder().decode(value.slice(0, sampleBytes)) : "";
    } else {
      await res.body?.cancel();
    }
    return {
      name, url, status: res.status, ok: res.status === 200, ms: Date.now() - t0,
      contentType: res.headers.get("content-type"),
      contentLength: res.headers.get("content-length"),
      sample,
    };
  } catch (e) {
    return { name, url, status: null, ok: false, ms: Date.now() - t0, error: String(e) };
  }
}

// www.nseindia.com APIs usually need cookies set by the homepage first.
async function getNseCookies(): Promise<{ cookie: string; status: number | null }> {
  try {
    const res = await fetch("https://www.nseindia.com/", { headers: { ...BASE_HEADERS, Accept: "text/html" } });
    await res.body?.cancel();
    const raw: string[] = res.headers.getSetCookie();
    const cookie = raw.map((c) => c.split(";")[0]).join("; ");
    return { cookie, status: res.status };
  } catch {
    return { cookie: "", status: null };
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    const d = lastWeekday();
    const yyyymmdd = `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}`;
    const ddmmyy = `${p2(d.getUTCDate())}${p2(d.getUTCMonth() + 1)}${String(d.getUTCFullYear()).slice(2)}`;
    const ddmmyyyy = `${p2(d.getUTCDate())}-${p2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;

    const archive = await Promise.all([
      probe("udiff_bhavcopy", `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${yyyymmdd}_F_0000.csv.zip`),
      probe("pr_bundle", `https://nsearchives.nseindia.com/archives/equities/bhavcopy/pr/PR${ddmmyy}.zip`),
      probe("nifty50_list", "https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv", {}, 120),
      probe("equity_master", "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv", {}, 120),
      probe("announcements_rss", "https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml", {}, 200),
    ]);

    const noCookie = await Promise.all([
      probe("announcements_api_nocookie", "https://www.nseindia.com/api/corporate-announcements?index=equities", { Accept: "application/json" }, 300),
    ]);

    const { cookie, status: homeStatus } = await getNseCookies();
    const ck = { Accept: "application/json", Referer: "https://www.nseindia.com/", Cookie: cookie };
    const withCookie = await Promise.all([
      probe("announcements_api_cookie", "https://www.nseindia.com/api/corporate-announcements?index=equities", ck, 300),
      probe("announcements_hist_cookie", `https://www.nseindia.com/api/corporate-announcements?index=equities&from_date=${ddmmyyyy}&to_date=${ddmmyyyy}`, ck, 200),
    ]);

    // An attachment URL taken from the announcements feed, if we got one.
    const firstPdf = [...noCookie, ...withCookie]
      .map((r) => r.sample?.match(/https:\/\/nsearchives\.nseindia\.com\/corporate\/[^"]+\.pdf/)?.[0])
      .find(Boolean);
    const pdf = firstPdf ? [await probe("announcement_pdf", firstPdf)] : [];

    // Structured-filing endpoints (per company), one at a time with a short gap (log #234).
    const sf: Result[] = [];
    const api = "https://www.nseindia.com/api/";
    const eq = (sym: string) => `index=equities&symbol=${sym}`;
    const sfList: [string, string][] = [
      ["sf_pit_infy", `corporates-pit?${eq("INFY")}`],
      ["sf_sast29_infy", `corporate-sast-reg29?${eq("INFY")}`],
      ["sf_integrated_fin_infy", `integrated-filing-results?${eq("INFY")}&type=Integrated%20Filing-%20Financials`],
      ["sf_shareholding_infy", `corporate-share-holdings-master?${eq("INFY")}`],
      ["sf_governance_infy", `corporate-governance-master?${eq("INFY")}`],
      ["sf_credit_rating", `corporate-credit-rating?${eq("INFY")}`],
      ["sf_board_meetings_infy", `corporate-board-meetings?${eq("INFY")}`],
      ["sf_corp_actions_infy", `corporates-corporateActions?${eq("INFY")}`],
      ["sf_annual_reports_infy", `annual-reports?${eq("INFY")}`],
      ["sf_brsr_infy", `corporate-bussiness-sustainabilitiy?${eq("INFY")}`],
      ["sf_results_q_infy", `corporates-financial-results?${eq("INFY")}&period=Quarterly`],
      ["sf_results_q_hdfcbank", `corporates-financial-results?${eq("HDFCBANK")}&period=Quarterly`],
      ["sf_shareholding_hdfcbank", `corporate-share-holdings-master?${eq("HDFCBANK")}`],
      ["sf_fii_dii", "fiidiiTradeReact"],
    ];
    for (const [n, q] of sfList) {
      sf.push(await probe(n, api + q, ck, 160));
      await new Promise((r) => setTimeout(r, 400));
    }

    const all = [...archive, ...noCookie, ...withCookie, ...pdf, ...sf];
    const report = {
      probed_at_utc: new Date().toISOString(),
      cf_colo: (req as any).cf?.colo ?? null,
      cf_country: (req as any).cf?.country ?? null,
      archive_date_used: yyyymmdd,
      homepage_status: homeStatus,
      cookies_received: cookie ? cookie.split("; ").map((c) => c.split("=")[0]) : [],
      summary: Object.fromEntries(all.map((r) => [r.name, r.status])),
      results: all,
    };
    return new Response(JSON.stringify(report, null, 2), { headers: { "content-type": "application/json" } });
  },
};
