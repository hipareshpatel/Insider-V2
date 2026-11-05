import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Sql, Stmt } from "@disclo/core";
import { buildFeatures, featuresStep, valuationsStep } from "../src/features.js";
import { backfillBsCf, nbfcBalanceSheets, broadcastFor, loadBatch, loadQuarterOfHalf, nseIstToUtc, quarterBounds, submissionFor, versionPeriod } from "../src/load.js";

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
// owner #353: a scale-guard hold now stands only when the file's own profit ÷ shares does not match its EPS (an amount
// filed in the wrong unit). These tests hold, so their file carries an EPS ×100 off, as a units error would leave it.
const xmlUnits = xml.replace(/(BasicEarningsLossPerShareFromContinuingOperations contextRef="OneD"[^>]*>)15\.31/, "$11531.00").replace(/(BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations contextRef="OneD"[^>]*>)15\.31/, "$11531.00");

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
    const jump = setup({ "att/xbrl/a.xml": xmlUnits, "api/results_quarterly/INFY/x.json": list });
    jump.filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (99,7,'results_quarterly','2024-10-17T00:00:00Z','old');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version)
      VALUES (7,'industrial','pl','revenue','','2024-09-30','Q','standalone','original','3409000000','2024-10-17T00:00:00Z',99,'reported','t')`);
    const o = (await loadBatch(jump.deps))[0]!;
    expect(o.status).toBe("review");
    expect(o.detail).toContain("scale guard");
    expect((await jump.filings.all<{ n: number }>("SELECT count(*) AS n FROM fin_value WHERE period_end='2024-12-31'"))[0]!.n).toBe(0);
  });
});

describe("skipped jobs do not block the queue (C43)", () => {
  it("a job skipped for missing identity is retried only after 6 hours; new jobs go first", async () => {
    const { filings, market, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    market.raw.exec("DELETE FROM security_identifier");
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "skipped" });
    expect(await loadBatch(deps)).toEqual([]); // not re-read on the next run
    market.raw.exec("INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (7,'nse_symbol','INFY','2024-01-01','t')");
    const later = { ...deps, now: () => new Date("2026-11-03T08:01:00Z") };
    expect((await loadBatch(later))[0]).toMatchObject({ status: "loaded" });
    expect((await filings.all<{ status: string }>("SELECT status FROM fin_load"))).toEqual([{ status: "loaded" }]);
  });
});

describe("FY22 old-format March-quarter file (contexts referenced but undefined): full year loads (D90, C4 for the year)", () => {
  it("INFY Mar 2022 consolidated: quarter and FY22 both stored", async () => {
    const URL22 = "https://nsearchives.nseindia.com/corporate/xbrl/INDAS_83516_634679_13042022084838_WEB.xml";
    const filings = sqlite("filings"), market = sqlite("market");
    market.raw.exec("DELETE FROM job_lock; INSERT INTO security (security_id,name) VALUES (7,'Infosys'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (7,'nse_symbol','INFY','2020-01-01','t')");
    const list22 = JSON.stringify([{ broadCastDate: "13-Apr-2022 20:48:38", resultDetailedDataLink: URL22 }]);
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (1,'results_quarterly','INFY','u1','api/results_quarterly/INFY/x.json','done');
      INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (2,'xbrl_results_quarterly','INFY','${URL22}','att/xbrl/fy22.xml','done',1)`);
    const x22 = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_Q4FY22_cons_undefinedctx.xml"), "utf8");
    const base = { filings, market, getText: async (k: string) => (k === "att/xbrl/fy22.xml" ? x22 : list22), now: () => new Date("2026-11-03T02:00:00Z") };
    // D168: in production a Mar 2022 file is before the coverage floor and is excluded, nothing loaded
    expect((await loadBatch(base))[0]).toMatchObject({ status: "excluded", detail: expect.stringContaining("coverage floor (D168)") });
    expect(await filings.all("SELECT 1 FROM fin_value")).toEqual([]);
    // the reader itself (C4 for the year) is still checked, with an earlier floor
    filings.raw.exec("DELETE FROM fin_load; DELETE FROM daily_refresh WHERE slot='loader_cursor'");
    const deps = { ...base, floor: "2000-01-01" };
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "loaded", detail: expect.stringContaining("FY22 loaded") });
    expect(await filings.all("SELECT period_kind, value FROM fin_value WHERE line='revenue' ORDER BY period_kind")).toEqual([{ period_kind: "FY", value: "1216410000000" }, { period_kind: "Q", value: "322760000000" }]);
  });
});

describe("revised filing of a half year: balance sheet and cash flow versioned and flagged (owner #334)", () => {
  it("INFY Sep 2026 filed twice, the second with every balance-sheet figure 2% larger: H-period rows original/restated, BS lines flagged", async () => {
    const UA = "https://nsearchives.nseindia.com/corporate/xbrl/IF_A.xml", UB = "https://nsearchives.nseindia.com/corporate/xbrl/IF_B.xml";
    const filings = sqlite("filings"), market = sqlite("market");
    market.raw.exec("DELETE FROM job_lock; INSERT INTO security (security_id,name) VALUES (7,'Infosys'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (7,'nse_symbol','INFY','2024-01-01','t')");
    const list = JSON.stringify({ data: [{ symbol: "INFY", broadcast_Date: "16-Oct-2026 16:40:00", xbrl: UA }, { symbol: "INFY", broadcast_Date: "20-Oct-2026 10:00:00", xbrl: UB }] });
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (1,'integrated_financials','INFY','u1','api/l.json','done');
      INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (2,'xbrl_integrated_financials','INFY','${UA}','att/A.xml','done',1), (3,'xbrl_integrated_financials','INFY','${UB}','att/B.xml','done',1)`);
    const a = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_IF_Q2FY27_cons_full.xml"), "utf8");
    const b = a.replace(/(<in-capmkt:[A-Za-z]+\b[^>]*contextRef="OneI"[^>]*unitRef="INR"[^>]*>)(-?\d+(?:\.\d+)?)/g, (_m, h, v) => h + String(Math.round(Number(v) * 1.02)));
    const files: Record<string, string> = { "att/A.xml": a, "att/B.xml": b, "api/l.json": list };
    await loadBatch({ filings, market, bscf: true, getText: async (k: string) => files[k] ?? null, now: () => new Date("2026-11-03T02:00:00Z") });
    const v = await filings.all<{ version: string }>("SELECT DISTINCT version FROM fin_value WHERE statement='bs' AND line='total_assets' AND period_kind='H' ORDER BY disclosed_at");
    expect(v.map((x) => x.version)).toEqual(["original", "restated"]);
    const flags = await filings.all<{ statement: string; period_kind: string; change_pct: string }>("SELECT statement, period_kind, change_pct FROM restatement_flag WHERE statement='bs'");
    expect(flags.length).toBeGreaterThan(5);
    expect(flags.every((f) => f.period_kind === "H" && Math.abs(Math.abs(Number(f.change_pct)) - 2) < 0.1)).toBe(true);
  });
});

describe("complete statements (D154): every reported balance-sheet and cash-flow line", () => {
  it("INFY Sep 2026 consolidated: ~59 balance-sheet and 88 cash-flow detail lines stored next to the named lines", async () => {
    const URLH = "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_INFY_H1FY27_WEB.xml";
    const filings = sqlite("filings"), market = sqlite("market");
    market.raw.exec("DELETE FROM job_lock; INSERT INTO security (security_id,name) VALUES (7,'Infosys'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (7,'nse_symbol','INFY','2024-01-01','t')");
    const listH = JSON.stringify({ data: [{ symbol: "INFY", broadcast_Date: "16-Oct-2026 16:40:00", creation_Date: "16-Oct-2026 16:40:00", xbrl: URLH }] });
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (1,'integrated_financials','INFY','u1','api/integrated_financials/INFY/x.json','done');
      INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (2,'xbrl_integrated_financials','INFY','${URLH}','att/xbrl/h1.xml','done',1)`);
    const h1 = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_IF_Q2FY27_cons_full.xml"), "utf8");
    const deps = { filings, market, bscf: true, getText: async (k: string) => (k === "att/xbrl/h1.xml" ? h1 : listH), now: () => new Date("2026-11-03T02:00:00Z") };
    const [o] = await loadBatch(deps);
    expect(o).toMatchObject({ status: "loaded" });
    expect(o!.detail).not.toContain("detail not loaded");
    const n = await filings.all<{ statement: string; n: number }>("SELECT statement, count(*) AS n FROM fin_value WHERE substr(line,1,2)='x:' GROUP BY statement ORDER BY statement");
    expect(n).toEqual([{ statement: "bs", n: 59 }, { statement: "cf", n: 88 }]);
    const capex = await filings.all<{ value: string; period_kind: string }>("SELECT value, period_kind FROM fin_value WHERE line='x:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'");
    expect(capex).toEqual([{ value: "15850000000", period_kind: "H" }]);
  });
});

describe("backfill survives storage read errors (C48)", () => {
  it("a failing read pauses the backfill at that file; after 3 runs it is skipped and listed, and the position moves on", async () => {
    const { filings, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "loaded" });
    const broken = { ...deps, bscf: true, getText: async (k: string) => { if (k === "att/xbrl/a.xml") throw new Error("get: Please look at https://www.cloudflarestatus.com for issues"); return null; } };
    const cur = async () => JSON.parse((await filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE slot='bscf_backfill'"))[0]!.detail);
    await backfillBsCf(broken, 10);
    expect(await cur()).toMatchObject({ after: 0, stuck: 2, tries: 1, done: false });
    await backfillBsCf(broken, 10);
    await backfillBsCf(broken, 10);
    expect(await cur()).toMatchObject({ after: 2, skipped: [2], done: true });
  });
});

describe("focus companies (D155)", () => {
  it("loads only the focus symbols' files; the rest wait untouched", async () => {
    const a = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    expect(await loadBatch({ ...a.deps, focus: ["TCS", "HDFCBANK"] })).toEqual([]);
    expect((await a.filings.all<{ n: number }>("SELECT count(*) AS n FROM fin_load"))[0]!.n).toBe(0);
    expect((await loadBatch({ ...a.deps, focus: ["INFY"] }))[0]).toMatchObject({ status: "loaded" });
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

describe("scale-guard release by the file's own EPS (owner #353)", () => {
  it("a 100x jump against history loads when profit ÷ shares matches the filed EPS (a real step, e.g. a dividend quarter)", async () => {
    const { epsConsistent } = await import("../src/load.js");
    expect(epsConsistent(parseXbrl(xml), canonicalResult(parseXbrl(xml)))).toBe(true);
    expect(epsConsistent(parseXbrl(xmlUnits), canonicalResult(parseXbrl(xmlUnits)))).toBe(false);
    const jump = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    jump.filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (99,7,'results_quarterly','2024-10-17T00:00:00Z','old');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version)
      VALUES (7,'industrial','pl','revenue','','2024-09-30','Q','standalone','original','3409000000','2024-10-17T00:00:00Z',99,'reported','t')`);
    expect((await loadBatch(jump.deps))[0]).toMatchObject({ status: "loaded" });
  });
});

describe("C65: a quarterly file whose own contexts carry mis-typed dates (SIEMENS Q2 FY25, owner #353)", () => {
  const F = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_IF_Q2FY27_cons_full.xml"), "utf8");
  // OneD and the reporting-start fact both say 2025-07-01: a 15-month "quarter"
  const bad = F.replace('DateOfStartOfReportingPeriod contextRef="OneD">2026-07-01', 'DateOfStartOfReportingPeriod contextRef="OneD">2025-07-01')
    .replace(/(<xbrli:context id="OneD">.*?<xbrli:startDate>)2026-07-01/s, "$12025-07-01");
  const run = async (q1: (k: string) => string) => {
    const { filings, deps } = setup({ "att/xbrl/a.xml": bad, "api/results_quarterly/INFY/x.json": list });
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (49,7,'integrated_financials','2026-07-17T00:00:00Z','q1');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version) VALUES
      (7,'industrial','pl','revenue','','2026-06-30','Q','consolidated','original','${q1("revenue")}','2026-07-17T00:00:00Z',49,'reported','t'),
      (7,'industrial','pl','pat','','2026-06-30','Q','consolidated','original','${q1("pat")}','2026-07-17T00:00:00Z',49,'reported','t')`);
    return { filings, out: (await loadBatch(deps))[0]! };
  };
  const inst = parseXbrl(F), q = canonicalResult(inst), y = canonicalResult(inst, { span: "ytd" });
  it("is loaded as the quarter when the filed Q1 + this column = the file's year to date", async () => {
    const { filings, out } = await run((k) => String(BigInt(y.lines[k]!) - BigInt(q.lines[k]!))); // fixture: the consistent filed Q1
    expect(out).toMatchObject({ status: "loaded" });
    expect(await filings.all("SELECT value, period_kind FROM fin_value WHERE line='revenue' AND period_end='2026-09-30'")).toEqual([{ value: q.lines.revenue, period_kind: "Q" }]);
  });
  it("stays in review when the proof fails", async () => {
    const { out } = await run(() => "1");
    expect(out).toMatchObject({ status: "review", detail: expect.stringContaining("C65") });
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

describe("scale-guard holds are re-checked (C45)", () => {
  it("held against too few neighbours; after 6 hours, with its neighbouring periods on record, it loads and the hold is dropped", async () => {
    const { filings, deps } = setup({ "att/xbrl/a.xml": xmlUnits, "api/results_quarterly/INFY/x.json": list });
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (99,7,'results_quarterly','2024-07-17T00:00:00Z','old');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version)
      VALUES (7,'industrial','pl','revenue','','2024-06-30','Q','standalone','original','3409000000','2024-07-17T00:00:00Z',99,'reported','t')`);
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "review", detail: expect.stringContaining("scale guard") });
    expect(await loadBatch(deps)).toEqual([]); // not re-read on the next run
    // later periods at the filing's level arrive (a lasting change, e.g. a merger)
    filings.raw.exec(`INSERT INTO fin_held (security_id,line,basis,period_kind,period_end,value,job_id) VALUES (7,'revenue','standalone','Q','2025-03-31','350000000000',8), (7,'revenue','standalone','Q','2025-06-30','355000000000',9)`);
    const later = { ...deps, now: () => new Date("2026-11-03T08:01:00Z") };
    expect((await loadBatch(later))[0]).toMatchObject({ status: "loaded" });
    expect((await filings.all<{ n: number }>("SELECT count(*) AS n FROM fin_held WHERE period_end='2024-12-31'"))[0]!.n).toBe(0);
  });
  it("an isolated outlier stays held when re-checked", async () => {
    const { deps } = setup({ "att/xbrl/a.xml": xmlUnits, "api/results_quarterly/INFY/x.json": list });
    const f = deps.filings as unknown as { raw: { exec(s: string): void } };
    f.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (99,7,'results_quarterly','2024-07-17T00:00:00Z','old');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version)
      VALUES (7,'industrial','pl','revenue','','2024-06-30','Q','standalone','original','3409000000','2024-07-17T00:00:00Z',99,'reported','t'),
             (7,'industrial','pl','revenue','','2025-03-31','Q','standalone','original','3500000000','2024-07-17T00:00:00Z',99,'reported','t')`);
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "review" });
    expect((await loadBatch({ ...deps, now: () => new Date("2026-11-03T08:01:00Z") }))[0]).toMatchObject({ status: "review", detail: expect.stringContaining("scale guard") });
  });
});

describe("series audit (FMEA B7/C6)", () => {
  it("flags a ×10 jump between neighbouring periods regardless of load order", async () => {
    const { auditJumps } = await import("../src/audit.js");
    const { filings } = setup({});
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (1,7,'r','t','a');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version) VALUES
      (7,'industrial','pl','revenue','','2024-12-31','Q','standalone','original','1200000000','t',1,'reported','t'),
      (7,'industrial','pl','revenue','','2024-06-30','Q','standalone','original','1100000000','t',1,'reported','t'),
      (7,'industrial','pl','revenue','','2024-09-30','Q','standalone','original','110000000','t',1,'reported','t')`);
    const j = await auditJumps(filings);
    expect(j.map((x) => `${x.from}->${x.to}`)).toEqual(["2024-06-30->2024-09-30", "2024-09-30->2024-12-31"]);
  });
});

describe("expense breakdown missing in the filing (FMEA C7)", () => {
  it("totals load; breakdown lines are null with a reason", async () => {
    const broken = xml.replace(/(<in-bse-fin:OtherExpenses contextRef="OneD"[^>]*>)([0-9.]+)/, (_m, a: string, v: string) => a + String(Number(v) - 1000000000));
    const { filings, deps } = setup({ "att/xbrl/a.xml": broken, "api/results_quarterly/INFY/x.json": list });
    const o = (await loadBatch(deps))[0]!;
    expect(o.status).toBe("loaded");
    expect(o.detail).toContain("breakdown");
    const v = await filings.all<{ line: string; value: string | null; null_reason: string | null }>("SELECT line, value, null_reason FROM fin_value WHERE line IN ('revenue','pat','other_expenses') ORDER BY line");
    expect(v).toEqual([
      { line: "other_expenses", value: null, null_reason: "breakdown does not add up to total expenses in the filing" },
      { line: "pat", value: "63580000000", null_reason: null },
      { line: "revenue", value: "349150000000", null_reason: null },
    ]);
  });
});

describe("item 4 batch (V1 hints #276, D145)", () => {
  it("median anchor: one odd earlier quarter does not hold a normal filing when its other neighbours are normal", async () => {
    const { filings, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (99,7,'results_quarterly','2024-07-17T00:00:00Z','old');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version) VALUES
      (7,'industrial','pl','revenue','','2024-09-30','Q','standalone','original','264000','2024-10-17T00:00:00Z',99,'reported','t'),
      (7,'industrial','pl','revenue','','2025-03-31','Q','standalone','original','405000000000','2025-04-17T00:00:00Z',99,'reported','t'),
      (7,'industrial','pl','revenue','','2025-06-30','Q','standalone','original','410000000000','2025-07-17T00:00:00Z',99,'reported','t')`);
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "loaded" }); // old rule: held at ×1.5 million vs 264,000
  });
  it("a file with no reporting period is excluded (D145), not reviewed", async () => {
    const noPeriod = xml.replace(/<[^>]*DateOfStartOfReportingPeriod[^>]*>[^<]*<\/[^>]+>/g, "").replace(/<[^>]*DateOfEndOfReportingPeriod[^>]*>[^<]*<\/[^>]+>/g, "");
    const { deps } = setup({ "att/xbrl/a.xml": noPeriod, "api/results_quarterly/INFY/x.json": list });
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "excluded" });
  });
});

import { canonicalResult, parseXbrl } from "@disclo/core";
describe("quarter vs year-to-date context with the same dates (C29)", () => {
  it("takes OneD even when FourD comes first in the file", () => {
    const base = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_AFFORDABLE_nonIndAS.xml"), "utf8");
    const want = canonicalResult(parseXbrl(base)).lines.revenue;
    // move the FourD context before OneD and give it the quarter's dates
    const one = /<xbrli:context id="OneD">[\s\S]*?<\/xbrli:context>/.exec(base)![0];
    const four = /<xbrli:context id="FourD">[\s\S]*?<\/xbrli:context>/.exec(base)![0];
    const fourSame = four.replace(/<xbrli:startDate>[^<]+<\/xbrli:startDate>/, /<xbrli:startDate>[^<]+<\/xbrli:startDate>/.exec(one)![0]);
    const swapped = base.replace(one, "@@ONE@@").replace(four, one).replace("@@ONE@@", fourSame);
    const inst = parseXbrl(swapped);
    expect([...inst.contexts.keys()].indexOf("FourD")).toBeLessThan([...inst.contexts.keys()].indexOf("OneD"));
    expect(canonicalResult(inst).lines.revenue).toBe(want);
  });
});

describe("full-year figures from a March-quarter file (D90, INFY Mar 2026 Integrated Filing, real file)", () => {
  it("loads the quarter and the full year (FY26) from the same filing; versions and disclosed_at shared", async () => {
    const URLQ = "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1658040_23042026090154_WEB.xml";
    const filings = sqlite("filings"), market = sqlite("market");
    market.raw.exec("DELETE FROM job_lock; INSERT INTO security (security_id,name) VALUES (7,'Infosys'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (7,'nse_symbol','INFY','2024-01-01','t')");
    const listQ = JSON.stringify({ data: [{ symbol: "INFY", broadcast_Date: "23-Apr-2026 21:01:54", creation_Date: "23-Apr-2026 21:01:54", xbrl: URLQ }] });
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (1,'integrated_financials','INFY','u1','api/integrated_financials/INFY/x.json','done');
      INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (2,'xbrl_integrated_financials','INFY','${URLQ}','att/xbrl/q4.xml','done',1)`);
    const q4 = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_IF_Q4FY26_cons.xml"), "utf8");
    const deps = { filings, market, getText: async (k: string) => (k === "att/xbrl/q4.xml" ? q4 : listQ), now: () => new Date("2026-11-03T02:00:00Z") };
    const [o] = await loadBatch(deps);
    expect(o).toMatchObject({ status: "loaded", detail: expect.stringContaining("FY26 loaded") });
    const v = await filings.all<{ period_kind: string; value: string; disclosed_at: string }>("SELECT period_kind, value, disclosed_at FROM fin_value WHERE line='revenue' ORDER BY period_kind");
    expect(v).toEqual([{ period_kind: "FY", value: "1786500000000", disclosed_at: "2026-04-23T15:31:54.000Z" }, { period_kind: "Q", value: "464020000000", disclosed_at: "2026-04-23T15:31:54.000Z" }]);
  });
});

describe("general insurer (GODIGIT Q1 FY27 Integrated Filing, real file)", () => {
  it("loads with the insurance template: gross premium, PAT, claims; was held as 'industrial: core lines missing revenue,pat'", async () => {
    const URLG = "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_GI_1700338_23072026071853_WEB.xml";
    const filings = sqlite("filings"), market = sqlite("market");
    market.raw.exec("DELETE FROM job_lock; INSERT INTO security (security_id,name) VALUES (5,'Go Digit General Insurance'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (5,'nse_symbol','GODIGIT','2024-05-23','t')");
    const listG = JSON.stringify({ data: [{ symbol: "GODIGIT", broadcast_Date: "23-Jul-2026 19:18:53", creation_Date: "23-Jul-2026 19:18:53", xbrl: URLG }] });
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (1,'integrated_financials','GODIGIT','u1','api/integrated_financials/GODIGIT/x.json','done');
      INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (2,'xbrl_integrated_financials','GODIGIT','${URLG}','att/xbrl/g.xml','done',1)`);
    const gi = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_GODIGIT_Q1FY27_gi.xml"), "utf8");
    const deps = { filings, market, getText: async (k: string) => (k === "att/xbrl/g.xml" ? gi : listG), now: () => new Date("2026-11-03T02:00:00Z") };
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "loaded" });
    const v = await filings.all<{ template: string; line: string; value: string }>("SELECT template, line, value FROM fin_value WHERE line IN ('gross_premium','pat','claims_incurred') ORDER BY line");
    expect(v.map((x) => [x.template, x.line])).toEqual([["insurance", "claims_incurred"], ["insurance", "gross_premium"], ["insurance", "pat"]]);
    expect(v.find((x) => x.line === "pat")!.value).toBe("863900000");
  });
});

describe("BSE Ltd shareholding: wrong/missing filed total, Integrated Filing taxonomy (17 held filings)", () => {
  const fx = (n: string) => readFileSync(join(ROOT, "packages/core/test/fixtures/nse", n), "utf8");
  const URLB = "https://nsearchives.nseindia.com/corporate/xbrl/SHP_192048_1271707_16102024121524_WEB.xml";
  function setupBse(file: string, issue: number | null) {
    const filings = sqlite("filings"), market = sqlite("market");
    market.raw.exec("DELETE FROM job_lock; INSERT INTO security (security_id,name) VALUES (9,'BSE Limited'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (9,'nse_symbol','BSE','2017-01-01','t')");
    if (issue) market.raw.exec(`INSERT INTO shares_daily (security_id,d,issue_size,mcap_paise,mcap_source,face_value_paise) VALUES (9,20240927,${issue},NULL,'nse',200)`);
    const list = JSON.stringify([{ symbol: "BSE", broadcastDate: "16-Oct-2024 12:15:24", xbrl: URLB }]);
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (1,'shareholding','BSE','u1','api/shareholding/BSE/x.json','done');
      INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (2,'xbrl_shareholding','BSE','${URLB}','att/xbrl/b.xml','done',1)`);
    return { filings, deps: { filings, market, getText: async (k: string) => (k === "att/xbrl/b.xml" ? fx(file) : list), now: () => new Date("2026-11-03T02:00:00Z") } };
  }
  it("loads with the category sum as total when NSE's issue size confirms it", async () => {
    const { deps } = setupBse("shp_BSE_2024-09_badtotal.xml", 135376359);
    const [o] = await loadBatch(deps);
    expect(o).toMatchObject({ status: "loaded" });
    expect(o!.detail).toContain("total from categories 135376359");
  });
  it("stays held when no independent share count agrees", async () => {
    const { deps } = setupBse("shp_BSE_2024-09_badtotal.xml", 140000000);
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "review" });
  });
  it("reads the Integrated Filing taxonomy (in-capmkt) prefix", async () => {
    const { parseShareholding, parseXbrl } = await import("@disclo/core");
    const r = parseShareholding(parseXbrl(fx("shp_BSE_2026-06_incapmkt.xml")), { totalOverride: 1 });
    expect(r.categories.find((c) => c.category === "public")!.shares).toBeGreaterThan(100_000_000);
  });
});

describe("balance sheet + cash flow loading (M2)", () => {
  it("INFY Sep 2024 consolidated: P&L plus balance sheet (H, 2024-09-30) and April–September cash flow rows", async () => {
    const file = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_Q2FY25_cons.xml"), "utf8");
    const { filings, deps } = setup({ "att/xbrl/a.xml": file, "api/results_quarterly/INFY/x.json": list });
    const [o] = await loadBatch({ ...deps, bscf: true });
    expect(o).toMatchObject({ status: "loaded" });
    const st = await filings.all<{ statement: string; period_kind: string; n: number }>("SELECT statement, period_kind, count(*) AS n FROM fin_value GROUP BY statement, period_kind ORDER BY statement");
    expect(st.find((x) => x.statement === "bs")).toMatchObject({ period_kind: "H" });
    expect(st.find((x) => x.statement === "cf")).toMatchObject({ period_kind: "H" });
    const [cfo] = await filings.all<{ value: string; period_end: string }>("SELECT value, period_end FROM fin_value WHERE statement='cf' AND line='cfo'");
    expect(cfo).toEqual({ value: "164580000000", period_end: "2024-09-30" });
  });
});

import { loadEvents } from "../src/events.js";
describe("M2 event loader (PIT, SAST, board meetings, credit ratings)", () => {
  it("loads lists in ledger order, collapses NSE's duplicate rows, stops at a list not yet downloaded", async () => {
    const filings = sqlite("filings");
    const fxd = (n: string) => readFileSync(join(ROOT, "packages/core/test/fixtures/nse", n), "utf8");
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES
      (10,'pit','INFY','p1','k/pit','done'), (11,'sast29','INFY','s1','k/sast','done'), (12,'board_meetings',NULL,'b1','k/bm','todo'), (13,'credit_rating',NULL,'c1','k/cr','done')`);
    const files: Record<string, string> = { "k/pit": fxd("api_pit_INFY_2024Q1.json"), "k/sast": fxd("api_sast_INFY.json"), "k/bm": fxd("api_board_meetings_2026-10.json"), "k/cr": fxd("api_credit_rating_2024-01.json") };
    const get = async (k: string) => files[k] ?? null;
    const a = await loadEvents(filings, get);
    expect(a).toMatchObject({ lists: 2, after: 11 }); // stopped at job 12 (not downloaded)
    expect((await filings.all<{ n: number }>("SELECT count(*) AS n FROM insider_trade"))[0]!.n).toBe(36); // 40 rows, 4 exact duplicates
    expect((await filings.all<{ n: number }>("SELECT count(*) AS n FROM sast_disclosure"))[0]!.n).toBe(54);
    filings.raw.exec("UPDATE fetch_job SET status='done' WHERE job_id=12");
    const b = await loadEvents(filings, get);
    expect(b).toMatchObject({ lists: 2, after: 13 });
    expect((await filings.all<{ n: number }>("SELECT count(*) AS n FROM board_meeting"))[0]!.n).toBe(60);
    // a second read of the same PIT list adds nothing
    filings.raw.exec("INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (14,'pit','INFY','p2','k/pit','done')");
    await loadEvents(filings, get);
    expect((await filings.all<{ n: number }>("SELECT count(*) AS n FROM insider_trade"))[0]!.n).toBe(36);
  });
});

describe("restatement and basis rules on known cases (M2 gate, D48/D50)", () => {
  function twoFilings(fileA: string, fileB: string, atA: string, atB: string, order: [number, number]) {
    const filings = sqlite("filings"), market = sqlite("market");
    market.raw.exec("DELETE FROM job_lock; INSERT INTO security (security_id,name) VALUES (7,'Infosys'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (7,'nse_symbol','INFY','2020-01-01','t')");
    const UA = "https://nsearchives.nseindia.com/corporate/xbrl/A.xml", UB = "https://nsearchives.nseindia.com/corporate/xbrl/B.xml";
    const listJ = JSON.stringify([{ broadCastDate: atA, resultDetailedDataLink: UA }, { broadCastDate: atB, resultDetailedDataLink: UB }]);
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (1,'results_quarterly','INFY','u1','api/l.json','done');
      INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (${order[0]},'xbrl_results_quarterly','INFY','${UA}','att/A.xml','done',1), (${order[1]},'xbrl_results_quarterly','INFY','${UB}','att/B.xml','done',1)`);
    const files: Record<string, string> = { "att/A.xml": fileA, "att/B.xml": fileB, "api/l.json": listJ };
    return { filings, deps: { filings, market, getText: async (k: string) => files[k] ?? null, now: () => new Date("2026-11-03T02:00:00Z") } };
  }
  const base = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_Q3FY25.xml"), "utf8");
  // a revision of the same quarter with revenue 2% higher (other income adjusted so the file's own sums still hold)
  // every rupee figure of the quarter scaled by 2%: a consistent revision whose own sums still hold
  const rev = base.replace(/(<in-bse-fin:[A-Za-z]+\b[^>]*contextRef="OneD"[^>]*unitRef="INR"[^>]*>)(-?\d+(?:\.\d+)?)/g, (_m, a, v) => a + String(Math.round(Number(v) * 1.02)));
  it("earliest disclosure = original, later = restated, > 0.5% change flagged — in either load order", async () => {
    for (const order of [[2, 3], [3, 2]] as [number, number][]) {
      const { filings, deps } = twoFilings(base, rev, "16-Jan-2025 19:42:10", "20-Feb-2025 10:00:00", order);
      await loadBatch(deps);
      const v = await filings.all<{ version: string; disclosed_at: string }>("SELECT DISTINCT version, disclosed_at FROM fin_value WHERE line='pat' ORDER BY disclosed_at");
      expect(v.map((x) => x.version)).toEqual(["original", "restated"]);
      const flags = await filings.all<{ line: string; change_pct: string }>("SELECT line, change_pct FROM restatement_flag");
      expect(flags.length).toBeGreaterThanOrEqual(2); // revenue, total income, PAT changed by 2% > 0.5%
      const off = flags.filter((f) => Math.abs(Math.abs(Number(f.change_pct)) - 2) >= 0.1); // negative lines move by −2%
      expect(off).toEqual([]);
      // owner #334: every changed line is flagged, not only 4 core lines (expenses, tax, EPS-free rupee lines …)
      expect(flags.length).toBeGreaterThan(4);
      expect(flags.some((f) => !["revenue", "total_income", "pat", "interest_earned"].includes(f.line))).toBe(true);
    }
  });
  it("standalone and consolidated for the same quarter stay two series (INFY Sep 2024, real files)", async () => {
    const st = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_Q2FY25_standalone.xml"), "utf8");
    const co = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_Q2FY25_cons.xml"), "utf8");
    const { filings, deps } = twoFilings(st, co, "17-Oct-2024 19:44:02", "17-Oct-2024 19:45:50", [2, 3]);
    await loadBatch(deps);
    const r = await filings.all<{ basis: string; version: string; value: string }>("SELECT basis, version, value FROM fin_value WHERE line='revenue' AND statement='pl' ORDER BY basis");
    expect(r.map((x) => x.basis)).toEqual(["consolidated", "standalone"]);
    expect(r.every((x) => x.version === "original")).toBe(true); // different basis = not a restatement
    expect(r[0]!.value).not.toBe(r[1]!.value);
  });
});

describe("submission type and revision remark (owner #334)", () => {
  it("Union Bank Q4 FY26 revision (list row shape as stored): type and remark kept; original rows have no remark", () => {
    const U = "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_BANKING_1730436_29092026050823_WEB.xml";
    const list = JSON.stringify({ data: [
      { qe_Date: "31-MAR-2026", consolidated: "Consolidated", revised_Date: "29-SEP-2026 17:08:12", type_Sub: "Revision", xbrl: U,
        revision_Remark: "Informed by BSE to insert the figures of cash and cash equivalents cash flow statement at beginning of period for both standalone and consolidated" },
      { qe_Date: "31-MAR-2026", consolidated: "Consolidated", broadcast_Date: "23-Apr-2026 19:23:02", type_Sub: "Original", xbrl: "https://nsearchives.nseindia.com/corporate/xbrl/X.xml" }] });
    expect(submissionFor(list, U)).toEqual({ submission: "Revision", remark: expect.stringContaining("Informed by BSE to insert the figures of cash") });
    expect(submissionFor(list, "https://nsearchives.nseindia.com/corporate/xbrl/X.xml")).toEqual({ submission: "Original", remark: null });
    expect(broadcastFor(list, U)).toBe("2026-09-29T11:38:12.000Z"); // revisions carry no broadcast time: the revision date (IST → UTC)
  });
});

describe("version pass with twin rows (4 Nov: UNIQUE constraint stopped the pass)", () => {
  it("a figure stored under both labels for the same filing is kept once, correctly labelled", async () => {
    const filings = sqlite("filings");
    filings.raw.exec("INSERT INTO filing (filing_id, security_id, kind, period_end, period_kind, basis, disclosed_at, source_url, status) VALUES (1, 7, 'integrated_financials', '2026-09-30', 'H', 'consolidated', '2026-10-16T11:10:00Z', 'u', 'loaded')");
    const ins = (version: string, at: string, value: string) => filings.raw.exec(`INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version)
      VALUES (7,'industrial','bs','total_assets','','2026-09-30','H','consolidated','${version}','${value}','${at}',1,'reported','t')`);
    ins("original", "2026-10-16T11:10:00Z", "1000000000"); ins("restated", "2026-10-16T11:10:00Z", "1000000000"); // twin of the first filing
    ins("restated", "2026-10-20T04:30:00Z", "1100000000"); ins("original", "2026-10-20T04:30:00Z", "1100000000"); // twin of the revision
    await versionPeriod(filings, 7, "2026-09-30", "H", "consolidated");
    expect(await filings.all("SELECT version, disclosed_at, value FROM fin_value ORDER BY disclosed_at")).toEqual([
      { version: "original", disclosed_at: "2026-10-16T11:10:00Z", value: "1000000000" }, { version: "restated", disclosed_at: "2026-10-20T04:30:00Z", value: "1100000000" }]);
    expect(await filings.all("SELECT statement, change_pct FROM restatement_flag")).toEqual([{ statement: "bs", change_pct: "10.00" }]);
  });
});

describe("file selection without scanning the ledger (audit P0)", () => {
  it("the cursor waits at a file not downloaded yet, later files still load, nothing is read twice", async () => {
    const { filings, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    // job 3: an earlier-queued file still waiting for the GitHub download (todo), job 2 done
    filings.raw.exec("UPDATE fetch_job SET job_id=4 WHERE job_id=2; INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,parent_id) VALUES (3,'xbrl_results_quarterly','INFY','u3','att/xbrl/c.xml','todo',1)");
    expect((await loadBatch(deps)).map((o) => o.jobId)).toEqual([4]);
    expect(JSON.parse((await filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE slot='loader_cursor'"))[0]!.detail).after).toBe(0); // waits before 3 (job 1 is a list, not a file)
    expect(await loadBatch(deps)).toEqual([]); // 4 is not read again
    filings.raw.exec("UPDATE fetch_job SET status='failed', attempts=3 WHERE job_id=3"); // final: no more downloads
    expect(await loadBatch(deps)).toEqual([]);
    expect(JSON.parse((await filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE slot='loader_cursor'"))[0]!.detail).after).toBe(4);
  });
  it("a retryable outcome backs off (6 h, 12 h, …) and stops after MAX_TRIES", async () => {
    const { MAX_TRIES } = await import("../src/load.js");
    const { filings, market, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    market.raw.exec("DELETE FROM security_identifier"); // skipped every time
    let t = Date.parse("2026-11-03T02:00:00Z");
    const at = () => ({ ...deps, now: () => new Date(t) });
    expect((await loadBatch(at()))[0]).toMatchObject({ status: "skipped" });
    const row = async () => (await filings.all<{ tries: number; retry_after: string | null }>("SELECT tries, retry_after FROM fin_load"))[0]!;
    expect(await row()).toEqual({ tries: 1, retry_after: "2026-11-03T08:00:00.000Z" });
    t += 6 * 3600_000 - 60_000; expect(await loadBatch(at())).toEqual([]); // not due yet
    t += 60_000; expect(await loadBatch(at())).toHaveLength(1);
    expect((await row()).retry_after).toBe("2026-11-03T20:00:00.000Z"); // +12 h
    for (let k = 3; k <= MAX_TRIES; k++) { t = Date.parse((await row()).retry_after!); expect(await loadBatch(at())).toHaveLength(1); }
    expect(await row()).toEqual({ tries: MAX_TRIES, retry_after: null }); // given up: listed as skipped, never re-read
    t += 400 * 86400_000; expect(await loadBatch(at())).toEqual([]);
  });
  it("C63: a due retry outside the focus leaves the retry queue instead of blocking focus retries behind it", async () => {
    const { filings, market, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    market.raw.exec("DELETE FROM security_identifier"); // skipped: becomes a retry
    let t = Date.parse("2026-11-03T02:00:00Z");
    expect((await loadBatch({ ...deps, now: () => new Date(t) }))[0]).toMatchObject({ status: "skipped" });
    t += 7 * 3600_000; // due now; INFY is not in this run's focus
    expect(await loadBatch({ ...deps, now: () => new Date(t), focus: ["TCS"] })).toEqual([]);
    expect(await filings.all("SELECT status, retry_after FROM fin_load")).toEqual([{ status: "skipped", retry_after: null }]);
  });
});

describe("robustness (audit P1)", () => {
  it("an unreadable list or a missing file is recorded, not silently passed; a storage error waits at the file (3 runs)", async () => {
    const { loadEvents } = await import("../src/events.js");
    const filings = sqlite("filings");
    filings.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES
      (20,'sast29',NULL,'s1','k/bad','done'), (21,'board_meetings',NULL,'b1','k/gone','done'), (22,'pit',NULL,'p1','k/flaky','done')`);
    let flaky = true;
    const get = async (k: string) => { if (k === "k/flaky" && flaky) throw new Error("get: storage unavailable"); return k === "k/bad" ? "{not json" : null; };
    expect(await loadEvents(filings, get)).toMatchObject({ after: 21 }); // waits at 22
    expect(await filings.all("SELECT job_id, status, substr(detail, 1, 15) AS d FROM event_load ORDER BY job_id")).toEqual([
      { job_id: 20, status: "failed", d: "unreadable list" }, { job_id: 21, status: "failed", d: "file not in R2" }]);
    await loadEvents(filings, get);
    expect(await loadEvents(filings, get)).toMatchObject({ after: 22 }); // third run: recorded and passed
    expect((await filings.all<{ d: string }>("SELECT detail AS d FROM event_load WHERE job_id=22"))[0]!.d).toContain("storage read error");
    flaky = false;
  });
  it("a run past its deadline starts no new file and the cursor does not pass the files left; counters move", async () => {
    const { filings, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    expect(await loadBatch({ ...deps, deadline: Date.now() - 1 })).toEqual([]);
    const cur = await filings.all<{ detail: string }>("SELECT detail FROM daily_refresh WHERE slot='loader_cursor'");
    expect(JSON.parse(cur[0]?.detail ?? '{"after":0}').after).toBeLessThan(2); // file 2 was not read, so the cursor stays before it
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "loaded" });
    const c = Object.fromEntries((await filings.all<{ name: string; n: number }>("SELECT name, n FROM stat_counter")).map((r) => [r.name, r.n]));
    expect(c["fin_load:loaded"]).toBe(1); expect(c["filing:results"]).toBe(1); expect(c["fin_value:pl"]).toBeGreaterThan(10);
  });
});

describe("feed watermarks and the focus version pass (owner #343)", () => {
  it("a loaded file moves the results watermark; reading it needs no scan", async () => {
    const { filings, deps } = setup({ "att/xbrl/a.xml": xml, "api/results_quarterly/INFY/x.json": list });
    await loadBatch(deps);
    expect(await filings.all("SELECT feed, newest, rows FROM feed_fresh WHERE feed='results'")).toEqual([{ feed: "results", newest: "2025-01-16T14:12:10.000Z", rows: 1 }]);
  });
  it("version pass goes company by company over the focus list and saves its position after each", async () => {
    const { versionBackfillFocus } = await import("../src/load.js");
    const filings = sqlite("filings");
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,period_end,period_kind,basis,disclosed_at,source_url) VALUES
      (1,7,'integrated_financials','2026-09-30','Q','consolidated','2026-10-16T00:00:00Z','a'), (2,7,'integrated_financials','2026-09-30','Q','consolidated','2026-10-20T00:00:00Z','b'), (3,9,'results_quarterly','2026-09-30','Q','standalone','2026-10-16T00:00:00Z','c')`);
    expect(await versionBackfillFocus(filings, [9, 7], 1)).toMatchObject({ after: 7, done: false, companies: 1, groups: 1 });
    expect(await versionBackfillFocus(filings, [9, 7], 1)).toMatchObject({ after: 9, done: true, companies: 2, groups: 1 });
  });
});

describe("renamed companies (work list item 2)", () => {
  it("reload puts named focus files left in review back on the retry queue, due now", async () => {
    const { reloadJobs } = await import("../src/load.js");
    const { deps, filings } = setup({});
    filings.raw.exec("INSERT INTO fin_load (job_id, status, detail, at, tries, retry_after) VALUES (2,'review','no context','2026-11-01T00:00:00Z',1,NULL)");
    expect(await reloadJobs({ ...deps, focus: ["TCS"] }, [2])).toMatchObject({ queued: 0 });
    expect(await reloadJobs({ ...deps, focus: ["INFY"] }, [2, 99])).toMatchObject({ asked: 2, queued: 1 });
    expect(await filings.all("SELECT retry_after FROM fin_load WHERE job_id=2")).toEqual([{ retry_after: "2026-11-03T02:00:00.000Z" }]);
  });
  it("requeue_404 resets only named failed-404 XBRL jobs of the focus companies", async () => {
    const { requeue404 } = await import("../src/load.js");
    const { deps, filings } = setup({});
    filings.raw.exec("UPDATE fetch_job SET status='failed', http_status=404, url='https://nsearchives.nseindia.com/x.xml' WHERE job_id=2");
    expect(await requeue404({ ...deps, focus: ["TCS"] }, [2])).toMatchObject({ requeued: 0 });
    expect(await requeue404({ ...deps, focus: ["INFY"] }, [1, 2])).toMatchObject({ asked: 2, requeued: 1 });
    expect(await filings.all("SELECT status FROM fetch_job WHERE job_id=2")).toEqual([{ status: "todo" }]);
  });
  it("a file carrying a pre-rename symbol loads under the company whose list linked it", async () => {
    const renamed = xml.replace(/(<in-bse-fin:Symbol\b[^>]*>)[^<]*/, "$1INFOSYSOLD");
    expect(renamed).not.toBe(xml);
    const { deps } = setup({ "att/xbrl/a.xml": renamed, "api/results_quarterly/INFY/x.json": list });
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "loaded" });
  });
  it("a file carrying another company's symbol loads under the company whose list linked it, not that company (C61)", async () => {
    const wrong = xml.replace(/(<in-bse-fin:Symbol\b[^>]*>)[^<]*/, "$1NUCLEUS");
    const { deps, filings, market } = setup({ "att/xbrl/a.xml": wrong, "api/results_quarterly/INFY/x.json": list });
    market.raw.exec("INSERT INTO security (security_id,name) VALUES (8,'Nucleus'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (8,'nse_symbol','NUCLEUS','2024-01-01','t')");
    expect((await loadBatch(deps))[0]).toMatchObject({ status: "loaded" });
    expect(await filings.all("SELECT DISTINCT security_id FROM filing")).toEqual([{ security_id: 7 }]);
  });
  it("misattributed pass: reports, then moves a filing and its rows to the company whose list linked it (C61)", async () => {
    const { misattributed } = await import("../src/load.js");
    const { deps, filings, market } = setup({});
    market.raw.exec("INSERT INTO security (security_id,name) VALUES (8,'Nucleus'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (8,'nse_symbol','NUCLEUS','2024-01-01','t')");
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,period_end,period_kind,basis,disclosed_at,source_url) VALUES (60,8,'results_quarterly','2025-12-31','Q','consolidated','2026-01-22T00:00:00Z','${URL1}');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version)
      VALUES (8,'industrial','pl','revenue','','2025-12-31','Q','consolidated','original','1','2026-01-22T00:00:00Z',60,'reported','x')`);
    const d = { ...deps, focus: ["INFY"] };
    expect(await misattributed(d, false)).toMatchObject({ found: 1, moved: 0 });
    expect(await filings.all("SELECT security_id FROM fin_value")).toEqual([{ security_id: 8 }]);
    expect(await misattributed(d, true)).toMatchObject({ found: 1, moved: 1, sids: [7] });
    expect(await filings.all("SELECT security_id FROM fin_value UNION ALL SELECT security_id FROM filing")).toEqual([{ security_id: 7 }, { security_id: 7 }]);
    expect(await misattributed(d, true)).toMatchObject({ found: 0 });
  });
});

describe("half-year-only files (D169): the quarter from its own column, else half-year minus the previous quarter", () => {
  const F = readFileSync(join(ROOT, "packages/core/test/fixtures/nse/xbrl_INFY_IF_Q2FY27_cons_full.xml"), "utf8");
  // a file whose own reporting period is the half-year (Apr–Sep), as COFORGE / COALINDIA filed
  const halfMeta = F.replace('DateOfStartOfReportingPeriod contextRef="OneD">2026-07-01<', 'DateOfStartOfReportingPeriod contextRef="OneD">2026-04-01<');
  // ... and with no 3-month column at all (the quarter's context turned into a second half-year one)
  const halfOnly = halfMeta.replace(/(<xbrli:context id="OneD">.*?<xbrli:startDate>)2026-07-01/, "$12026-04-01");
  const prepare = () => {
    const filings = sqlite("filings"), market = sqlite("market");
    filings.raw.exec("INSERT INTO filing (filing_id,security_id,kind,period_end,period_kind,basis,disclosed_at,source_url) VALUES (50,7,'integrated_financials','2026-09-30','H','consolidated','2026-10-16T11:10:00.000Z','u')");
    return { filings, deps: { filings, market, getText: async () => null, now: () => new Date("2026-11-03T02:00:00Z") } };
  };
  it("quarter bounds", () => {
    expect(quarterBounds("2026-09-30")).toEqual({ start: "2026-07-01", prevEnd: "2026-06-30" });
    expect(quarterBounds("2025-03-31")).toEqual({ start: "2025-01-01", prevEnd: "2024-12-31" });
    expect(quarterBounds("2025-12-31")).toEqual({ start: "2025-10-01", prevEnd: "2025-09-30" });
    expect(quarterBounds("2026-02-28")).toEqual({ start: "2025-12-01", prevEnd: "2025-11-30" });
  });
  it("(a) the file has a 3-month column: the quarter is loaded as reported", async () => {
    const { filings, deps } = prepare();
    const inst = parseXbrl(halfMeta), h = canonicalResult(inst);
    expect(h.periodKind).toBe("H");
    const r = await loadQuarterOfHalf(inst, h, 7, "2026-10-16T11:10:00.000Z", 50, deps);
    expect(r.note).toContain("loaded from its own column");
    const rev = await filings.all<Record<string, unknown>>("SELECT value, period_kind, origin FROM fin_value WHERE line='revenue'");
    expect(rev).toEqual([{ value: "492440000000", period_kind: "Q", origin: "reported" }]);
    expect((await loadQuarterOfHalf(inst, h, 7, "2026-10-16T11:10:00.000Z", 50, deps)).rows).toBe(0); // already stored
  });
  it("(b) no quarter column: nothing is derived from the half-year (owner #345), even with the previous quarter stored", async () => {
    const { filings, deps } = prepare();
    const inst = parseXbrl(halfOnly), h = canonicalResult(inst);
    expect(h.periodKind).toBe("H");
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (49,7,'integrated_financials','2026-07-17T00:00:00Z','q1');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version) VALUES
      (7,'industrial','pl','revenue','','2026-06-30','Q','consolidated','original','200000000000','2026-07-17T00:00:00Z',49,'reported','t'),
      (7,'industrial','pl','pat','','2026-06-30','Q','consolidated','original','50000000000','2026-07-17T00:00:00Z',49,'reported','t')`);
    const r = await loadQuarterOfHalf(inst, h, 7, "2026-10-16T11:10:00.000Z", 50, deps);
    expect(r).toMatchObject({ rows: 0 });
    expect(r.note).toContain("never derived");
    expect((await filings.all<{ n: number }>("SELECT count(*) AS n FROM fin_value WHERE period_end='2026-09-30'"))[0]!.n).toBe(0);
  });
  it("(c) C62: a half-year-dated column proven to hold the quarter (filed Q1 + it = the file's year to date) is relabelled, not recomputed", async () => {
    const { filings, deps } = prepare();
    const inst = parseXbrl(halfOnly), h = canonicalResult(inst), y = canonicalResult(inst, { span: "ytd" });
    const q1 = (k: string) => String(BigInt(y.lines[k]!) - BigInt(h.lines[k]!)); // fixture setup only: the filed Q1 that makes the file consistent
    const hRows = Object.entries(h.lines).map(([l, v]) => `(7,'industrial','pl','${l}','','2026-09-30','H','consolidated','original','${v}','2026-10-16T11:10:00.000Z',50,'reported','results-v1')`).join(",");
    filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (49,7,'integrated_financials','2026-07-17T00:00:00Z','q1');
      INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,disclosed_at,filing_id,origin,extractor_version) VALUES
      (7,'industrial','pl','revenue','','2026-06-30','Q','consolidated','original','${q1("revenue")}','2026-07-17T00:00:00Z',49,'reported','t'),
      (7,'industrial','pl','pat','','2026-06-30','Q','consolidated','original','${q1("pat")}','2026-07-17T00:00:00Z',49,'reported','t'), ${hRows}`);
    const r = await loadQuarterOfHalf(inst, h, 7, "2026-10-16T11:10:00.000Z", 50, deps);
    expect(r.note).toContain("relabelled as the quarter (C62)");
    expect(r.rows).toBe(Object.keys(h.lines).length);
    const rev = await filings.all<Record<string, unknown>>("SELECT value, period_kind, origin FROM fin_value WHERE line='revenue' AND period_end='2026-09-30'");
    expect(rev).toEqual([{ value: h.lines.revenue, period_kind: "Q", origin: "reported" }]); // the filed cell, unchanged
    expect(await filings.all("SELECT period_kind FROM filing WHERE filing_id=50")).toEqual([{ period_kind: "Q" }]);
  });
});

describe("item 5: NBFC Division III balance-sheet pass", () => {
  it("re-reads the focus NBFC's stored files and adds the Division III lines; existing rows untouched; a second call does nothing", async () => {
    // an INFY results file with a Division III balance sheet put in its OneI context (BAJFINANCE-shaped figures, in ₹)
    const bs: Record<string, string> = { Loans: "900", Investments: "60", CashAndCashEquivalents: "40", FinanicalAssets: "1000", PropertyPlantAndEquipment: "30",
      OtherNonFinancialAssets: "20", NonFinancialAssets: "50", Assets: "1050", DebtSecurities: "500", Borrowings: "300", FinancialLiabilities: "800",
      Provisions: "50", NonFinancialLiabilities: "50", Liabilities: "850", EquityShareCapital: "10", OtherEquity: "190", EquityAttributableToOwnersOfParent: "200",
      Equity: "200", EquityAndLiabilities: "1050" };
    const nbfc = xml.replace("</xbrli:xbrl>", Object.entries(bs).map(([t, v]) => `<in-bse-fin:${t} contextRef="OneI" unitRef="INR" decimals="0">${v}</in-bse-fin:${t}>`).join("") + "</xbrli:xbrl>");
    const url = "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_NBFC_INDAS_1_WEB.xml";
    const { filings, deps } = setup({ "att/xbrl/INTEGRATED_FILING_NBFC_INDAS_1_WEB.xml": nbfc });
    filings.raw.exec(`INSERT INTO filing (filing_id, security_id, kind, period_end, period_kind, basis, disclosed_at, source_url) VALUES (5, 7, 'integrated_financials', '2024-12-31', 'Q', 'consolidated', '2025-01-16T14:12:10.000Z', '${url}')`);
    filings.raw.exec(`INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)
      VALUES (7,'industrial','bs','x:Assets','','2024-12-31','9M','consolidated','original','1050',NULL,'2025-01-16T14:12:10.000Z',5,'Assets','reported','detail-v1')`);
    const r = await nbfcBalanceSheets({ ...deps, focus: ["INFY"] });
    expect(r).toMatchObject({ done: true, companies: 1, files: 1 });
    const got = Object.fromEntries((filings.raw.prepare("SELECT line, value FROM fin_value WHERE statement='bs' AND line LIKE 'x:%'").all() as { line: string; value: string }[]).map((x) => [x.line, x.value]));
    expect(got["x:Loans"]).toBe("900");
    expect(got["x:DebtSecurities"]).toBe("500");
    expect(got["x:FinanicalAssets"]).toBe("1000");
    const again = await nbfcBalanceSheets({ ...deps, focus: ["INFY"] });
    expect(again.done).toBe(true);
    expect(again.files).toBe(1);
  });
});

describe("D171: feature table build", () => {
  it("stores computed values with their inputs; a rebuild writes nothing; a restatement changes only what it touches; fin_value untouched", async () => {
    const { filings, deps } = setup({});
    filings.raw.exec("INSERT INTO filing (filing_id, security_id, kind, period_end, period_kind, basis, disclosed_at, source_url) VALUES (9, 7, 'results_quarterly', '2026-09-30', 'Q', 'consolidated', '2026-10-15T00:00:00Z', 'u9')");
    const ins = filings.raw.prepare(`INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)
      VALUES (7,'industrial','pl',?,'',?,'Q','consolidated',?,?,NULL,?,9,'t','reported','results-v1')`);
    const ends = ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"];
    ends.forEach((e, i) => { for (const [k, x] of Object.entries({ revenue: 100 + 10 * i, pat: 20 + i, total_expenses: 70, finance_cost: 2, depreciation: 3 })) ins.run(k, e, "original", String(x), `${e}T12:00:00Z`); });
    const before = (filings.raw.prepare("SELECT count(*) AS n FROM fin_value").get() as { n: number }).n;
    const r = await buildFeatures({ ...deps, focus: ["INFY"] }, 25, true);
    expect(r).toMatchObject({ done: true, companies: 1 });
    const get = (f: string, e: string) => filings.raw.prepare("SELECT value, reason, inputs FROM feature_value WHERE security_id=7 AND field=? AND period_end=?").get(f, e) as { value: string | null; reason: string | null; inputs: string };
    expect(get("revenue_ttm", "2026-09-30")).toMatchObject({ value: "540", inputs: JSON.stringify(["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"]) });
    // too few quarters before Sep 2025: stored as unavailable, with the reason (never a sentinel)
    expect(get("revenue_ttm", "2025-09-30")).toMatchObject({ value: null, reason: "quarter 2025-03-31 (consolidated) has no filed revenue" });
    expect(filings.raw.prepare("SELECT count(*) AS n FROM feature_value WHERE period_end < '2024-01-01'").get()).toEqual({ n: 0 });
    // rebuild: nothing changes
    const t0 = (filings.raw.prepare("SELECT max(computed_at) AS t FROM feature_value").get() as { t: string }).t;
    const later = { ...deps, focus: ["INFY"], now: () => new Date("2026-11-04T02:00:00Z") };
    await buildFeatures(later, 25, true);
    expect((filings.raw.prepare("SELECT max(computed_at) AS t FROM feature_value").get() as { t: string }).t).toBe(t0);
    // a restated Sep 2026 revenue changes the TTM and growth of that quarter only
    ins.run("revenue", "2026-09-30", "restated", "160", "2026-10-30T12:00:00Z");
    await buildFeatures(later, 25, true);
    expect(get("revenue_ttm", "2026-09-30").value).toBe("550");
    const changed = (filings.raw.prepare("SELECT count(*) AS n FROM feature_value WHERE computed_at = ?").get("2026-11-04T02:00:00.000Z") as { n: number }).n;
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(10);
    // fin_value holds filed rows only: the feature build added nothing there (D170)
    expect((filings.raw.prepare("SELECT count(*) AS n FROM fin_value").get() as { n: number }).n).toBe(before + 1);
  });
});

describe("D171: feature table kept current by the cron step", () => {
  it("first run starts at the newest filing; a later results filing rebuilds only its company", async () => {
    const { filings, deps } = setup({});
    filings.raw.exec("INSERT INTO filing (filing_id, security_id, kind, period_end, period_kind, basis, disclosed_at, source_url) VALUES (20, 7, 'results_quarterly', '2026-06-30', 'Q', 'consolidated', '2026-07-15T00:00:00Z', 'a')");
    const first = await featuresStep(deps, new Set([7]));
    expect(first).toEqual({ companies: 0, after: 20 });
    filings.raw.exec("INSERT INTO filing (filing_id, security_id, kind, period_end, period_kind, basis, disclosed_at, source_url) VALUES (21, 7, 'results_quarterly', '2026-09-30', 'Q', 'consolidated', '2026-10-15T00:00:00Z', 'b')");
    filings.raw.exec(`INSERT INTO fin_value (security_id,template,statement,line,dims,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,source_tag,origin,extractor_version)
      VALUES (7,'industrial','pl','revenue','','2026-09-30','Q','consolidated','original','150',NULL,'2026-10-15T00:00:00Z',21,'t','reported','results-v1')`);
    expect(await featuresStep(deps, new Set([7]))).toEqual({ companies: 1, after: 21 });
    expect(filings.raw.prepare("SELECT value FROM feature_value WHERE field='revenue_q' AND period_end='2026-09-30'").get()).toEqual({ value: "150" });
    expect(await featuresStep(deps, new Set([7]))).toEqual({ companies: 0, after: 21 });
    // a company outside the focus list is not rebuilt
    filings.raw.exec("INSERT INTO filing (filing_id, security_id, kind, period_end, period_kind, basis, disclosed_at, source_url) VALUES (22, 99, 'results_quarterly', '2026-09-30', 'Q', 'consolidated', '2026-10-15T00:00:00Z', 'c')");
    expect(await featuresStep(deps, new Set([7]))).toEqual({ companies: 0, after: 22 });
  });
});

describe("D171: valuations once per trading day", () => {
  it("uses NSE's market cap on the latest close with the feature table's TTM and balance-sheet values; second run the same day does nothing", async () => {
    const { filings, market, deps } = setup({});
    market.raw.exec("INSERT INTO trading_calendar (trade_date, is_session) VALUES ('2026-11-04', 1)");
    market.raw.exec("INSERT INTO shares_daily (security_id, d, issue_size, mcap_paise, mcap_source) VALUES (7, 20261104, 4150000000, 650000000000000, 'nse')"); // ₹6.5 lakh cr
    const fv = filings.raw.prepare("INSERT INTO feature_value (security_id, basis, field, period_end, value, reason, inputs, computed_at) VALUES (7, 'consolidated', ?, ?, ?, NULL, ?, 't')");
    const q4 = '["2025-12-31","2026-03-31","2026-06-30","2026-09-30"]', b = '["balance sheet 2026-09-30"]';
    fv.run("pat_owners_ttm", "2026-09-30", "260000000000", q4); fv.run("revenue_ttm", "2026-09-30", "1890000000000", q4); fv.run("ebitda_ttm", "2026-09-30", "460000000000", q4);
    fv.run("equity_owners", "2026-09-30", "990000000000", b); fv.run("net_debt", "2026-09-30", "-240000000000", b); fv.run("nci", "2026-09-30", "5000000000", b);
    fv.run("layout", "latest", "industrial", "[]");
    expect(await valuationsStep(deps, new Set([7]))).toEqual({ day: "2026-11-04", companies: 1, done: true });
    const get = (f: string, e = "latest") => filings.raw.prepare("SELECT value, reason FROM feature_value WHERE field=? AND period_end=?").get(f, e) as { value: string | null; reason: string | null };
    expect(get("pe_ttm_rep").value).toBe("25"); // 6,50,000 cr ÷ 26,000 cr
    expect(get("pe_ttm_rep", "2026-11-04").value).toBe("25"); // daily history (owner #360)
    expect(get("pb").value).toBe("6.57"); // 6,50,000 ÷ 99,000 = 6.566
    expect(get("ev_ebitda_ttm").value).toBe("13.62"); // (6,50,000 − 24,000 + 500) ÷ 46,000 = 13.619
    expect(await valuationsStep(deps, new Set([7]))).toEqual({ day: "2026-11-04", companies: 0, done: true });
  });
});
