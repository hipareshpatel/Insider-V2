import { describe, expect, it } from "vitest";
import { NSE_API_REFERER, nseHeaders, nseSession, parseSetCookie } from "../src/index.js";

describe("NSE browser session (D160)", () => {
  it("API calls: current Chrome headers, matching Referer, same-origin Sec-Fetch; archive files: same-site, no cookie", () => {
    const api = nseHeaders("api", "a=1");
    expect(api).toMatchObject({ Referer: NSE_API_REFERER, "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", Cookie: "a=1", "sec-ch-ua-mobile": "?0" });
    expect(api["User-Agent"]).toMatch(/Chrome\/\d+\.0\.0\.0 Safari/);
    expect(api["sec-ch-ua"]).toContain('"Google Chrome";v=');
    expect(nseHeaders("archive")).toMatchObject({ "Sec-Fetch-Site": "same-site" });
    expect(nseHeaders("archive").Cookie).toBeUndefined();
    expect(parseSetCookie(["nsit=abc; Path=/; HttpOnly", "bm_sv=xyz; Domain=.nseindia.com"])).toEqual([["nsit", "abc"], ["bm_sv", "xyz"]]);
  });
  it("warms the cookie jar once, reuses it, and re-warms ONCE per run on 401/403 (the request is retried once)", async () => {
    const calls: { url: string; cookie?: string }[] = [];
    let n = 0, apiCalls = 0;
    const fake = async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, cookie: init.headers.Cookie });
      if (url === "https://www.nseindia.com/") return new Response("home", { headers: { "set-cookie": `nsit=v${++n}; Path=/` } });
      apiCalls++;
      return new Response("{}", { status: apiCalls === 2 || apiCalls >= 4 ? 403 : 200 });
    };
    const s = nseSession(fake);
    expect((await s.get("https://www.nseindia.com/api/a")).status).toBe(200);
    expect((await s.get("https://www.nseindia.com/api/b")).status).toBe(200); // 403 → re-warm → retried → 200
    expect(s.rewarmed).toBe(true);
    expect((await s.get("https://www.nseindia.com/api/c")).status).toBe(403); // no second re-warm in the same run
    expect(calls.map((c) => [c.url.replace("https://www.nseindia.com", ""), c.cookie ?? ""])).toEqual([
      ["/", ""], ["/api/a", "nsit=v1"], ["/api/b", "nsit=v1"], ["/", ""], ["/api/b", "nsit=v2"], ["/api/c", "nsit=v2"]]);
    expect(s.cookieNames()).toEqual(["nsit"]);
  });
});
