// disclo-web: public site v0 (M3, D151) — API under /api/v1 plus the React site (Workers static assets).
// Unlisted: every response carries noindex; robots.txt disallows all; no sitemap (D89). Rate limited per IP.
import { Hono } from "hono";
import type { Sql } from "@disclo/core";
import { dashboard, health, securities, stock, type Dbs } from "./data.js";

export interface Env {
  DB_MARKET: D1Database; DB_FILINGS: D1Database; DB_APP: D1Database;
  ASSETS: Fetcher;
  RATE?: { limit(o: { key: string }): Promise<{ success: boolean }> };
  ENVIRONMENT: string;
}

/** Read-only D1 → Sql (the site never writes). */
function ro(db: D1Database): Sql {
  return {
    async all<T>(sql: string, params: unknown[] = []) { return (await db.prepare(sql).bind(...params).all<T>()).results; },
    async run() { throw new Error("read-only"); },
    async batch() { throw new Error("read-only"); },
  };
}
const dbs = (e: Env): Dbs => ({ market: ro(e.DB_MARKET), filings: ro(e.DB_FILINGS), app: ro(e.DB_APP) });

export const NOINDEX = "noindex, nofollow, noarchive";
export const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Robots-Tag", NOINDEX);
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("Referrer-Policy", "same-origin");
});

app.use("/api/*", async (c, next) => {
  if (c.env.RATE) {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    if (!(await c.env.RATE.limit({ key: ip })).success) return c.json({ error: "rate limited, try again in a minute" }, 429);
  }
  await next();
});

/** Edge cache: EOD data changes a few times a day; `ttl` seconds. */
async function cached(c: { req: { url: string }; executionCtx: { waitUntil(p: Promise<unknown>): void } }, ttl: number, make: (timing: string[]) => Promise<unknown>): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const key = new Request(c.req.url);
  const hit = cache ? await cache.match(key) : undefined;
  if (hit) { const r = new Response(hit.body, hit); r.headers.set("x-cache", "hit"); return r; } // cached headers are immutable
  const t0 = Date.now();
  const timing: string[] = [];
  const body = await make(timing);
  const ms = Date.now() - t0;
  if (body === null) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
  const res = new Response(JSON.stringify(body), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${ttl}` } });
  if (cache) c.executionCtx.waitUntil(cache.put(key, res.clone()));
  res.headers.set("server-timing", [`db;dur=${ms}`, ...timing].join(", ")); // server time for the uncached answer (performance targets, M3)
  res.headers.set("x-cache", "miss");
  return res;
}

app.get("/robots.txt", (c) => c.text("User-agent: *\nDisallow: /\n"));
app.get("/api/v1/dashboard", (c) => cached(c, 600, () => dashboard(dbs(c.env))));
app.get("/api/v1/securities", (c) => cached(c, 3600, () => securities(dbs(c.env).market)));
app.get("/api/v1/stocks/:symbol", (c) => {
  const s = c.req.param("symbol").toUpperCase();
  if (!/^[A-Z0-9&\-_.]{1,20}$/.test(s)) return c.json({ error: "bad symbol" }, 400);
  return cached(c, 600, (tm) => stock(dbs(c.env), s, tm));
});
app.get("/api/v1/health", (c) => cached(c, 60, () => health(dbs(c.env))));
app.all("/api/*", (c) => c.json({ error: "not found" }, 404));
// Everything else: the single-page site (assets binding serves index.html for unknown paths).
app.all("*", async (c) => {
  const r = await c.env.ASSETS.fetch(c.req.raw);
  const out = new Response(r.body, r);
  out.headers.set("X-Robots-Tag", NOINDEX);
  return out;
});

export default app;
