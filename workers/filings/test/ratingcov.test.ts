// G11 check: /ratings-coverage?symbols= — per company, stored ratings linked to it and how, the latest three, and from
// NSE's stored lists the rows linked to it, those not stored, and same-name rows that link elsewhere. Through the
// worker's own fetch, on databases built from the real migrations.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { parseCreditRatings } from "@disclo/core";
import worker, { type Env } from "../src/index.js";
import { parseSymbolsParam } from "../src/ratingcov.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
function d1(domain: string): D1Database & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(MIG, domain)).sort()) db.exec(readFileSync(join(MIG, domain, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return { raw: db, prepare: (sql: string) => {
      const bound = (...p: unknown[]) => ({ all: async () => ({ results: db.prepare(sql).all(...norm(p)), meta: { rows_read: 1 } }), first: async () => db.prepare(sql).get(...norm(p)) ?? null, run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...norm(p)).changes) } }) });
      return { bind: bound, ...bound() };
    } } as unknown as D1Database & { raw: DatabaseSync };
}

const row = (app: string, company: string, isin: string, rating = "CRISIL AAA", day = "05") => ({ AppID: app, Symbol: "NOTLISTED", CompanyName: company, ISIN: isin, NameOfCRAgency: "CRISIL Ratings Limited",
  CreditRating: rating, Outlook: "Stable", RatingAction: "Reaffirmed", DateofCR: `${day}-10-2026`, BroadcastDateTime: `${day}-OCT-2026 10:00:00` });
const LIST = JSON.stringify([
  row("1", "State Bank of India", "INE062A08223", "CRISIL AAA", "01"), // SBI's own issuer code
  row("2", "State Bank of India", "INE651A08041", "CRISIL AA+", "03"), // SBI bond under another code: by name
  row("3", "Hindustan Zinc Limited", "ZZZ000Z00000"), // placeholder ISIN: by name
  row("4", "TVS Motor Company Ltd.", "FFF000F00000"), // by name, not stored
  row("5", "TVS Motor Company Limited", "INE267A08011"), // TVS's name under Hindustan Zinc's issuer code: links to HINDZINC
]);

function env(): Env {
  const market = d1("market"), filings = d1("filings");
  market.raw.exec(`
    INSERT INTO security (security_id,name) VALUES (1,'STATE BANK OF INDIA'),(2,'HINDUSTAN ZINC LIMITED'),(3,'TVS MOTOR COMPANY LTD');
    INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (1,'nse_symbol','SBIN','2024-01-01','t'),(1,'isin','INE062A01020','2024-01-01','t'),
      (2,'nse_symbol','HINDZINC','2024-01-01','t'),(2,'isin','INE267A01025','2024-01-01','t'),(3,'nse_symbol','TVSMOTOR','2024-01-01','t'),(3,'isin','INE494B01023','2024-01-01','t');
    INSERT INTO index_membership (index_name,security_id,valid_from) VALUES ('NIFTY 50',1,'2024-01-01'),('NIFTY 50',2,'2024-01-01'),('NIFTY 50',3,'2024-01-01');`);
  filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,url,r2_key,status) VALUES (50,'credit_rating','c1','api/credit_rating/all/2026-10.json','done')`);
  const parsed = parseCreditRatings(LIST);
  const ins = filings.raw.prepare("INSERT INTO credit_rating (key,symbol,company,isin,agency,rating,rated_on,disclosed_at) VALUES (?,?,?,?,?,?,?,?)");
  for (const [i, sym] of [[0, "SBIN"], [1, "SBIN"], [2, "HINDZINC"], [4, "HINDZINC"]] as const) {
    const c = parsed[i]!;
    ins.run(c.key, sym, c.company, c.isin, c.agency, c.rating, Number(c.ratedOn!.replace(/-/g, "")), c.disclosedAt);
  }
  const raw = { get: async (k: string) => (k === "api/credit_rating/all/2026-10.json" ? { text: async () => LIST, customMetadata: {} } : null) } as unknown as R2Bucket;
  return { DB_MARKET: market, DB_FILINGS: filings, RAW: raw, ENVIRONMENT: "test", STATUS_TOKEN: "tok", FOCUS_INDICES: "NIFTY 50" } as Env;
}
const get = (q: string, token = "tok") => worker.fetch(new Request(`https://x/ratings-coverage${q}`, { headers: { authorization: `Bearer ${token}` } }), env());

describe("G11: /ratings-coverage?symbols= per-company check", () => {
  it("parses, upper-cases and de-duplicates; refuses none, more than 20 and malformed symbols", () => {
    expect(parseSymbolsParam(" sbin,HINDZINC,,sbin ,M&M")).toEqual(["SBIN", "HINDZINC", "M&M"]);
    expect(parseSymbolsParam(" , ")).toMatch(/one or more/);
    expect(parseSymbolsParam(Array.from({ length: 21 }, (_, i) => `S${i}`).join(","))).toMatch(/at most 20/);
    expect(parseSymbolsParam("SBIN,DROP TABLE")).toMatch(/not an NSE symbol: DROP TABLE/);
  });

  it("needs the status token; a bad list is a 400", async () => {
    expect((await get("?symbols=SBIN", "wrong")).status).toBe(403);
    expect((await get(`?symbols=${Array.from({ length: 21 }, (_, i) => `S${i}`).join(",")}`)).status).toBe(400);
  });

  it("per company: stored rows by link method, latest three, listed rows linked / not stored, same-name rows linked elsewhere", async () => {
    const res = await get("?symbols=SBIN,HINDZINC,TVSMOTOR,NOSUCH");
    expect(res.status).toBe(200);
    const r = await res.json() as { lists_read: number; list_rows: number; rows_read: number; companies: Record<string, any>[] };
    expect(r).toMatchObject({ lists_read: 1, list_rows: 5 });
    expect(r.rows_read).toBeGreaterThan(0);
    const [sbi, hzl, tvs, none] = r.companies;
    expect(sbi).toMatchObject({ symbol: "SBIN", security_id: 1, focus: true, listed_name: "STATE BANK OF INDIA", name_key: "STATE BANK OF INDIA", issuer_codes: ["INE062A"],
      stored: { rows: 2, by_symbol: { SBIN: 2 }, linked_by: { isin_issuer: 1, name: 1, nse_symbol: 0 } }, lists: { rows_linked: 2, linked_by: { isin_issuer: 1, name: 1 }, not_stored_from_floor: 0, unmatched_same_name: 0 } });
    expect(sbi!.stored.latest).toEqual([
      { disclosed_at: expect.stringMatching(/^2026-10-03/), rated_on: "2026-10-03", agency: "CRISIL Ratings Limited", rating: "CRISIL AA+", isin: "INE651A08041", company: "State Bank of India", via: "name" },
      { disclosed_at: expect.stringMatching(/^2026-10-01/), rated_on: "2026-10-01", agency: "CRISIL Ratings Limited", rating: "CRISIL AAA", isin: "INE062A08223", company: "State Bank of India", via: "isin_issuer" },
    ]);
    // HINDZINC: the placeholder ISIN by name, and TVS's own-name row under HZL's issuer code (by issuer code)
    expect(hzl).toMatchObject({ stored: { rows: 2, linked_by: { isin_issuer: 1, name: 1, nse_symbol: 0 } }, lists: { rows_linked: 2, linked_by: { name: 1, isin_issuer: 1 }, unmatched_same_name: 0 } });
    // TVSMOTOR: nothing stored; the list links one row by name (not stored) and has one same-name row linked to HINDZINC
    expect(tvs).toMatchObject({ stored: { rows: 0, latest: [] }, lists: { rows_linked: 1, linked_by: { name: 1 }, not_stored_from_floor: 1, unmatched_same_name: 1 } });
    expect(tvs!.lists.not_stored_sample).toEqual([{ when: expect.stringMatching(/^2026-10-05/), agency: "CRISIL Ratings Limited", rating: "CRISIL AAA", isin: "FFF000F00000", company: "TVS Motor Company Ltd." }]);
    expect(tvs!.lists.unmatched_sample).toEqual([{ when: expect.stringMatching(/^2026-10-05/), company: "TVS Motor Company Limited", isin: "INE267A08011", linked_to: "HINDZINC", reason: null }]);
    expect(none).toEqual({ symbol: "NOSUCH", error: "no security has this NSE symbol" });
  });

  it("lists=0 reads the stored rows only", async () => {
    const r = await (await get("?symbols=SBIN&lists=0")).json() as { lists_read: number; companies: Record<string, any>[] };
    expect(r.lists_read).toBe(0);
    expect(r.companies[0]).toMatchObject({ stored: { rows: 2 }, lists: null });
  });

  it("without symbols the page still gives the totals", async () => {
    const r = await (await get("")).json() as Record<string, unknown>;
    expect(r).toHaveProperty("totals");
    expect(r).not.toHaveProperty("companies");
  });
});
