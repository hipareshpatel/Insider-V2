// G8 phase 1: /governance-census — stored governance lists / XBRL and results files naming their auditors, for a page
// of the focus companies. Through the worker's own fetch, on databases built from the real migrations, with real
// stored Integrated Filing XBRL as the R2 objects.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import worker, { type Env } from "../src/index.js";
import { shapeOf } from "../src/governance.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
const FX = join(import.meta.dirname, "..", "..", "..", "packages", "core", "test", "fixtures", "nse");
function d1(domain: string): D1Database & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(MIG, domain)).sort()) db.exec(readFileSync(join(MIG, domain, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return { raw: db, prepare: (sql: string) => {
      const bound = (...p: unknown[]) => ({ all: async () => ({ results: db.prepare(sql).all(...norm(p)), meta: { rows_read: 1 } }), first: async () => db.prepare(sql).get(...norm(p)) ?? null, run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...norm(p)).changes) } }) });
      return { bind: bound, ...bound() };
    } } as unknown as D1Database & { raw: DatabaseSync };
}

const q2 = readFileSync(join(FX, "xbrl_INFY_IF_Q2FY27_cons_full.xml"), "utf8");
const R2: Record<string, string> = {
  "att/q4.xml": readFileSync(join(FX, "xbrl_INFY_IF_Q4FY26_cons.xml"), "utf8"),
  "att/q2.xml": q2.replace(">Deloitte Haskins and Sells LLP<", ">S R Batliboi &amp; Associates LLP<"), // real file, firm replaced
  "att/old.xml": readFileSync(join(FX, "xbrl_INFY_Q2FY25_cons.xml"), "utf8"),
  "att/hdfc.xml": readFileSync(join(FX, "xbrl_HDFCBANK_IF_Q2FY27_full.xml"), "utf8"),
  "api/governance/INFY/full.json": JSON.stringify({ data: [{ symbol: "INFY", a: "x" }] }), // placeholder list: shape only
};

function env(): Env {
  const market = d1("market"), filings = d1("filings");
  market.raw.exec(`
    INSERT INTO security (security_id,name) VALUES (1,'INFOSYS LIMITED'),(2,'HDFC BANK LIMITED');
    INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (1,'nse_symbol','INFY','2024-01-01','t'),(2,'nse_symbol','HDFCBANK','2024-01-01','t');
    INSERT INTO index_membership (index_name,security_id,valid_from) VALUES ('NIFTY 50',1,'2024-01-01'),('NIFTY 50',2,'2024-01-01');`);
  filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES
    (1,'xbrl_integrated_financials','INFY','u1','att/q4.xml','done'),
    (2,'xbrl_integrated_financials','INFY','u2','att/q2.xml','done'),
    (3,'xbrl_results_quarterly','INFY','u3','att/old.xml','done'),
    (4,'xbrl_integrated_financials','INFY','u4','att/gone.xml','done'),
    (5,'governance','INFY','u5','api/governance/INFY/full.json','done'),
    (6,'xbrl_governance','INFY','u6','att/g.xml','failed'),
    (7,'xbrl_integrated_financials','HDFCBANK','u7','att/hdfc.xml','done'),
    (8,'xbrl_results_quarterly','INFY','u8','att/q2.xml','done'),
    (9,'pit','INFY','u9','api/pit/INFY.json','done')`);
  const raw = { get: async (k: string) => (k in R2 ? { text: async () => R2[k], customMetadata: {} } : null) } as unknown as R2Bucket;
  return { DB_MARKET: market, DB_FILINGS: filings, RAW: raw, ENVIRONMENT: "test", STATUS_TOKEN: "tok", FOCUS_INDICES: "NIFTY 50" } as Env;
}
const get = (q: string, token = "tok") => worker.fetch(new Request(`https://x/governance-census${q}`, { headers: { authorization: `Bearer ${token}` } }), env());

describe("G8: /governance-census", () => {
  it("needs the status token; more than 5 named symbols is a 400", async () => {
    expect((await get("", "wrong")).status).toBe(403);
    expect((await get("?symbols=A,B,C,D,E,F")).status).toBe(400);
  });

  it("pages the focus companies by symbol; counts stored jobs, files naming auditors, and the auditor change", async () => {
    const res = await get("?limit=1&offset=1");
    expect(res.status).toBe(200);
    const r = await res.json() as Record<string, any>;
    expect(r).toMatchObject({ companies_total: 2, offset: 1, next_offset: null, symbols: ["INFY"] });
    expect(r.totals).toEqual({ xbrl_integrated_financials: { done: 3 }, xbrl_results_quarterly: { done: 2 }, governance: { done: 1 }, xbrl_governance: { failed: 1 } });
    const [infy] = r.companies;
    // q2 is stored twice (two kinds): one period, collapsed; the FY25 file names no auditor; one object missing in R2
    expect(infy).toMatchObject({ symbol: "INFY", auditor_files: 5, with_auditor: 3, no_auditor_field: 1, missing_in_r2: 1, unreadable: 0,
      opinions: { unmodified: 3, not_applicable: 1 }, first_named: "2026-03-31", latest: { period_end: "2026-09-30", basis: "consolidated", auditors: ["S R Batliboi & Associates LLP"] } });
    expect(infy.events).toEqual([expect.objectContaining({ type: "auditor_change", prevPeriodEnd: "2026-03-31", periodEnd: "2026-09-30", outgoing: ["Deloitte Haskins and Sells LLP"], incoming: ["S R Batliboi & Associates LLP"] })]);
    expect(r).toMatchObject({ auditor_files: 5, with_auditor: 3, events: 1 });
    expect(r.shapes).toEqual([{ kind: "governance", key: "api/governance/INFY/full.json", rows: 1, row_keys: ["a", "symbol"], first_row: { symbol: "INFY", a: "x" } }]);
    expect(r.rows_read).toBeGreaterThan(0);
  });

  it("named symbols; shapes=0 skips the samples", async () => {
    const r = await (await get("?symbols=hdfcbank&shapes=0")).json() as Record<string, any>;
    expect(r).toMatchObject({ companies_total: null, offset: null, symbols: ["HDFCBANK"], shapes: [] });
    expect(r.companies[0]).toMatchObject({ with_auditor: 1, events: [], latest: { auditors: ["B S R & Co. LLP", "Batliboi & Purohit"] } });
  });

  it("shapeOf: XBRL tag counts and axes of a stored file", () => {
    const s = shapeOf("xbrl_integrated_governance", "k", q2);
    expect(s.facts).toBeGreaterThan(100);
    expect(s.tags!["in-capmkt:AuditorsFirmName"]).toBe(1);
    expect(s.axes).toContain("in-capmkt:AuditorAxis");
    expect(shapeOf("governance", "k", "not json").error).toMatch(/^json/);
  });
});
