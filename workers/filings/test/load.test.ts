import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import { broadcastFor, loadBatch, nseIstToUtc } from "../src/load.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
function sqlite(domain: string): Sql & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(ROOT, "db", "migrations", domain)).sort()) db.exec(readFileSync(join(ROOT, "db", "migrations", domain, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  return {
    raw: db,
    async all<T>(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...norm(params)) as T[]; },
    async run(sql: string, params: unknown[] = []) { return { changes: Number(db.prepare(sql).run(...norm(params)).changes) }; },
    async batch(stmts: Stmt[]) { let n = 0; for (const s of stmts) n += Number(db.prepare(s.sql).run(...norm(s.params)).changes); return n; },
  };
}
const xml = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_Q3FY25.xml"), "utf8");
const URL1 = "https://nsearchives.nseindia.com/corporate/xbrl/INDAS_117294_1348219_16012025074210.xml";
const list = JSON.stringify([{ broadCastDate: "16-Jan-2025 19:42:10", resultDetailedDataLink: URL1 }]);

function setup(files: Record<string, string>) {
  const filings = sqlite("filings"), market = sqlite("market");
  market.raw.exec("DELETE FROM job_lock; INSERT INTO security (security_id,name) VALUES (7,'Infosys'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (7,'nse_symbol','INFY','2024-01-01','t')");
  filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (1,'results_quarterly','INFY','u1','api/results_quarterly/INFY/x.json','done');
    INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (2,'xbrl_results_quarterly','INFY','${URL1}','att/xbrl/a.xml','done',1)`);
  return { filings, market, deps: { filings, market, getText: async (k: string) => files[k] ?? null, now: () => new Date("2026-11-03T02:00:00Z") } };
}

describe("results loader (M2)", () => {
  it("dates: IST broadcast -> UTC", () => {
    expect(nseIstToUtc("16-Jan-2025 19:42:10")).toBe("2025-01-16T14:12:10.000Z");
    expect(broadcastFor(list, URL1)).toBe("2025-01-16T14:12:10.000Z");
  });
  it("loads INFY Q3 FY25 standalone: lines with basis, period and disclosed_at; re-run adds nothing", async () => {
    const { filings, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    const out = await loadBatch(deps);
    expect(out).toMatchObject([{ status: "loaded" }]);
    const rev = await filings.all<Record<string, unknown>>("SELECT value, basis, period_end, period_kind, version, disclosed_at FROM fin_value WHERE line='revenue'");
    expect(rev).toEqual([{ value: "349150000000", basis: "standalone", period_end: "2024-12-31", period_kind: "Q", version: "original", disclosed_at: "2025-01-16T14:12:10.000Z" }]);
    expect(await loadBatch(deps)).toEqual([]);
  });
  it("truncated file, missing list time, and a 10x jump all go to review/failed — nothing loaded (FMEA B7, B11, D32)", async () => {
    const cut = setup({ "att/xbrl/a.xml": xml.slice(0, xml.length - 200), "api/results_quarterly/INFY/x.json": list });
    expect((await loadBatch(cut.deps))[0]).toMatchObject({ status: "failed" });
    const noTime = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": "[]" });
    expect((await loadBatch(noTime.deps))[0]).toMatchObject({ status: "review" });
    const jump = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    jump.filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (99,7,'results_quarterly','2024-10-17T00:00:00Z','old');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version)
      VALUES (7,'industrial','pl','revenue','','2024-09-30','Q','standalone','original','3409000000','2024-10-17T00:00:00Z',99,'reported','t')`);
    const o = (await loadBatch(jump.deps))[0]!;
    expect(o.status).toBe("review");
    expect(o.detail).toContain("scale guard");
    expect((await jump.filings.all<{ n: number }>("SELECT count(*) AS n FROM fin_value WHERE period_end='2024-12-31'"))[0]!.n).toBe(0);
  });
});

describe("disclosure time fallbacks", () => {
  it("Integrated Filing revision rows: creation_Date when broadcast_Date is empty", () => {
    const l = JSON.stringify({ data: [{ broadcast_Date: null, creation_Date: "23-May-2025 18:05:57", xbrl: "https://x/a.xml" }] });
    expect(broadcastFor(l, "https://x/a.xml")).toBe("2025-05-23T12:35:57.000Z");
    expect(nseIstToUtc("23-MAY-2025 18:05:57")).toBe("2025-05-23T12:35:57.000Z");
  });
});

describe("shareholding loader", () => {
  it("loads INFY Sep 2026: total, categories (filed % and % of all shares), named holders; disclosed_at from the list", async () => {
    const shp = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/shp_INFY_2026-09.xml"), "utf8");
    const U = "https://nsearchives.nseindia.com/corporate/xbrl/SHP_1742200_20102026120732_WEB.xml";
    const { filings, deps } = setup({ "att/xbrl/s.xml": shp, "api/shareholding/INFY/x.json": JSON.stringify([{ broadcastDate: "20-OCT-2026 12:07:37", xbrl: U }]) });
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (3,'shareholding','INFY','u3','api/shareholding/INFY/x.json','done');
      INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (4,'xbrl_shareholding','INFY','${U}','att/xbrl/s.xml','done',3)`);
    const out = await loadBatch(deps);
    expect(out.find((o) => o.jobId === 4)).toMatchObject({ status: "loaded" });
    const p = await filings.all<Record<string, unknown>>("SELECT shares, pct, pct_all_shares FROM shareholding WHERE category='promoter'");
    expect(p).toEqual([{ shares: 516677914, pct: "0.139", pct_all_shares: "0.1273" }]);
    expect((await filings.all<{ n: number }>("SELECT count(*) AS n FROM shareholding WHERE holder_name='NANDAN M NILEKANI'"))[0]!.n).toBe(1);
  });
});

describe("scale guard anchor (FMEA C6)", () => {
  it("a held value anchors the next filing, so a lasting step change holds only its first period", async () => {
    const { filings, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    // earlier period was held at a similar level to this filing -> this filing loads
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (99,7,'results_quarterly','2024-07-17T00:00:00Z','old');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version)
      VALUES (7,'industrial','pl','revenue','','2024-06-30','Q','standalone','original','3409000000','2024-07-17T00:00:00Z',99,'reported','t');
      INSERT INTO fin_held (security_id,line,basis,period_kind,period_end,value,job_id) VALUES (7,'revenue','standalone','Q','2024-09-30','340000000000',1)`);
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "loaded" });
  });
});

describe("series audit (FMEA B7/C6)", () => {
  it("flags a ×10 jump between neighbouring periods regardless of load order", async () => {
    const { auditJumps } = await import("../src/audit.js");
    const { filings } = setup({});
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (1,7,'r','t','a');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version) VALUES
      (7,'industrial','pl','revenue','','2024-12-31','Q','standalone','original','1000000000','t',1,'reported','t'),
      (7,'industrial','pl','revenue','','2024-06-30','Q','standalone','original','1100000000','t',1,'reported','t'),
      (7,'industrial','pl','revenue','','2024-09-30','Q','standalone','original','110000000','t',1,'reported','t')`);
    const j = await auditJumps(filings);
    expect(j.map((x) => `${x.from}->${x.to}`)).toEqual(["2024-06-30->2024-09-30", "2024-09-30->2024-12-31"]);
  });
});
