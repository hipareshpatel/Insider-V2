// D160 (owner #340): NSE browser-session compatibility. NSE's site serves its public disclosure feeds reliably only to
// browser-like sessions, so every NSE request carries a consistent set of current Chrome headers, and API calls carry the
// session cookies NSE sets on its homepage. One cookie jar per Worker run; on 401/403 the jar is re-warmed ONCE per run
// and that request is retried once. No proxies, no IP rotation, no CAPTCHA solving, request rates unchanged (D124).
// Update CHROME_MAJOR about once a quarter (Chrome ships a major version every ~4 weeks).

export const CHROME_MAJOR = 142;
export const NSE_HOME = "https://www.nseindia.com/";
/** The page NSE's own site calls the filings APIs from (matching Referer for API calls). */
export const NSE_API_REFERER = "https://www.nseindia.com/companies-listing/corporate-filings-announcements";

export function chromeHeaders(major = CHROME_MAJOR): Record<string, string> {
  return {
    "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`,
    "Accept-Language": "en-US,en;q=0.9",
    "sec-ch-ua": `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not_A Brand";v="99"`,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  };
}

export type NseRequestKind = "api" | "archive" | "page";

/** Headers for one request: API calls as NSE's own page makes them (same-origin XHR); archive files (another NSE host) as
 *  a download from an NSE page (same-site); the homepage as a top-level visit. */
export function nseHeaders(kind: NseRequestKind, cookie = "", referer = NSE_API_REFERER, major = CHROME_MAJOR): Record<string, string> {
  const h = chromeHeaders(major);
  if (kind === "api") Object.assign(h, { Accept: "application/json, text/plain, */*", Referer: referer, "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" });
  else if (kind === "archive") Object.assign(h, { Accept: "*/*", Referer: NSE_HOME, "Sec-Fetch-Site": "same-site", "Sec-Fetch-Mode": "no-cors", "Sec-Fetch-Dest": "empty" });
  else Object.assign(h, { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Sec-Fetch-Site": "none", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", "Sec-Fetch-User": "?1", "Upgrade-Insecure-Requests": "1" });
  if (cookie) h.Cookie = cookie;
  return h;
}

type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;
export interface NseSession {
  /** One NSE request with the session's headers and cookies; re-warms once per run and retries once on 401/403. */
  get(url: string, kind?: NseRequestKind): Promise<Response>;
  /** Cookie names currently held (for logs; values are never exposed). */
  cookieNames(): string[];
  readonly rewarmed: boolean;
}

/** `name=value` pairs from Set-Cookie headers (attributes dropped). */
export function parseSetCookie(lines: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (const l of lines) {
    const first = l.split(";")[0] ?? "";
    const i = first.indexOf("=");
    if (i > 0) out.push([first.slice(0, i).trim(), first.slice(i + 1).trim()]);
  }
  return out;
}

const setCookies = (r: Response): string[] => {
  const h = r.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") return h.getSetCookie();
  const one = r.headers.get("set-cookie");
  return one ? [one] : [];
};

export function nseSession(fetchFn: FetchLike = (u, i) => fetch(u, i), major = CHROME_MAJOR): NseSession {
  const jar = new Map<string, string>();
  let warmed = false, rewarmed = false;
  const keep = (r: Response) => { for (const [k, v] of parseSetCookie(setCookies(r))) jar.set(k, v); };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const warm = async () => {
    warmed = true;
    try { const r = await fetchFn(NSE_HOME, { headers: nseHeaders("page", cookie(), NSE_HOME, major) }); keep(r); await r.body?.cancel(); } catch { /* no cookies: requests still go out */ }
  };
  const once = async (url: string, kind: NseRequestKind) => {
    const r = await fetchFn(url, { headers: nseHeaders(kind, kind === "archive" ? "" : cookie(), NSE_API_REFERER, major) });
    keep(r);
    return r;
  };
  return {
    async get(url, kind = new URL(url).hostname === "www.nseindia.com" ? "api" : "archive") {
      if (kind === "api" && !warmed) await warm();
      const r = await once(url, kind);
      if ((r.status === 401 || r.status === 403) && kind === "api" && !rewarmed) {
        rewarmed = true;
        await r.body?.cancel();
        jar.clear();
        await warm();
        return once(url, kind);
      }
      return r;
    },
    cookieNames: () => [...jar.keys()],
    get rewarmed() { return rewarmed; },
  };
}
