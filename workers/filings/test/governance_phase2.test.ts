// G8 phase 2: auditor_filing / audit opinion and board_member / governance_filing passes, through the worker's own
// /maint routes on databases built from the real migrations; real stored Integrated Filing XBRL (INFY, HDFCBANK) for
// the auditors, the SYNTHETIC governance XBRL (fictitious directors; tag names of log #405) for the board. HARD RULE
// (owner): no PAN / DIN / date of birth anywhere — sentinel facts are added at run time and must appear in no table
// and no answer.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import worker, { type Env } from "../src/index.js";
import { d1Sql } from "../src/d1.js";
import { boardPass, storedOpinion } from "../src/governance.js";
import { governanceFields, governanceInputs } from "../src/eventfeatures.js";

const MIG = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
const FX = join(import.meta.dirname, "..", "..", "..", "packages", "core", "test", "fixtures", "nse");
const fx = (n: string) => readFileSync(join(FX, n), "utf8");
function d1(domain: string): D1Database & { raw: DatabaseSync } {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const f of readdirSync(join(MIG, domain)).sort()) db.exec(readFileSync(join(MIG, domain, f), "utf8"));
  const norm = (p: unknown[]) => p.map((x) => (x === undefined ? null : x)) as (string | number | null)[];
  const stmt = (sql: string, p: unknown[] = []) => ({
    all: async () => ({ results: db.prepare(sql).all(...norm(p)), meta: { rows_read: 1 } }),
    first: async () => db.prepare(sql).get(...norm(p)) ?? null,
    run: async () => { const n = Number(db.prepare(sql).run(...norm(p)).changes); return { meta: { changes: n, rows_written: n } }; },
    _sql: sql, _p: p,
  });
  return { raw: db, prepare: (sql: string) => ({ bind: (...p: unknown[]) => stmt(sql, p), ...stmt(sql) }),
    batch: async (ss: { _sql: string; _p: unknown[] }[]) => ss.map((s) => ({ meta: { changes: Number(db.prepare(s._sql).run(...norm(s._p)).changes) } })) } as unknown as D1Database & { raw: DatabaseSync };
}

const PII = ["SENTINEL-PAN-VALUE", "SENTINEL-DIN-VALUE", "SENTINEL-DOB-VALUE"];
const cg = fx("xbrl_SYNTH_CG_Q2FY27.xml");
const withPii = (x: string) => {
  for (let i = 1; i <= 5; i++) x = x.replace("</xbrli:xbrl>", `<in-bse-cg:PermanentAccountNumberOfDirector contextRef="D_Dir${i}">${PII[0]}</in-bse-cg:PermanentAccountNumberOfDirector>
<in-bse-cg:DirectorIdentificationNumberOfDirector contextRef="D_Dir${i}">${PII[1]}</in-bse-cg:DirectorIdentificationNumberOfDirector>
<in-bse-cg:DateOfBirthOfDirector contextRef="D_Dir${i}">${PII[2]}</in-bse-cg:DateOfBirthOfDirector>
</xbrli:xbrl>`);
  return x;
};
// the quarter before (Integrated Filing – Governance spelling): Meera Iyer not yet on the board, Rohan Das still on it
const q1 = cg.replace(/in-bse-cg:/g, "in-capmkt:").replace(/2026-07-01/g, "2026-04-01").replace(/2026-09-30/g, "2026-06-30")
  .split("\n").filter((l) => !/contextRef="D_Dir3"/.test(l) && !/DateOfCessation/.test(l)).join("\n").replace(/(contextRef="D_Dir4">)Ceased/, "$1Active");
const R2: Record<string, string> = {
  "att/xbrl/q4.xml": fx("xbrl_INFY_IF_Q4FY26_cons.xml"),
  "att/xbrl/q2.xml": fx("xbrl_INFY_IF_Q2FY27_cons_full.xml").replace(">Deloitte Haskins and Sells LLP<", ">S R Batliboi &amp; Associates LLP<"), // real file, firm replaced
  "att/xbrl/old.xml": fx("xbrl_INFY_Q2FY25_cons.xml"),
  "att/xbrl/hdfc.xml": fx("xbrl_HDFCBANK_IF_Q2FY27_full.xml"),
  "att/cg/q2.xml": withPii(cg),
  "att/cg/q1.xml": withPii(q1),
  "att/cg/2023.xml": cg.replace(/2026-/g, "2023-"),
  "att/cg/new.xml": cg.replace(/2026-07-01/g, "2026-10-01").replace(/2026-09-30/g, "2026-12-31"),
};
const reads: string[] = [];

function env(): Env & { DB_FILINGS: D1Database & { raw: DatabaseSync } } {
  const market = d1("market"), filings = d1("filings");
  market.raw.exec(`
    INSERT INTO security (security_id,name) VALUES (1,'INFOSYS LIMITED'),(2,'HDFC BANK LIMITED'),(3,'OTHER LIMITED');
    INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (1,'nse_symbol','INFY','2024-01-01','t'),(2,'nse_symbol','HDFCBANK','2024-01-01','t'),(3,'nse_symbol','OTHER','2024-01-01','t');
    INSERT INTO index_membership (index_name,security_id,valid_from) VALUES ('NIFTY 50',1,'2024-01-01'),('NIFTY 50',2,'2024-01-01');`);
  const u = (p: string) => `https://nsearchives.nseindia.com/corporate/${p}`;
  filings.raw.exec(`INSERT INTO filing (filing_id,security_id,kind,period_end,period_kind,basis,disclosed_at,source_url,status) VALUES
    (1,1,'integrated_financials','2026-03-31','Q','consolidated','2026-04-17T12:00:00Z','${u("xbrl/q4.xml")}','loaded'),
    (2,1,'integrated_financials','2026-09-30','Q','consolidated','2026-10-23T14:49:37Z','${u("xbrl/q2.xml")}','loaded'),
    (3,1,'results_quarterly','2024-09-30','Q','consolidated','2024-10-17T12:00:00Z','${u("xbrl/old.xml")}','loaded'),
    (4,2,'integrated_financials','2026-09-30','Q','standalone','2026-10-18T12:00:00Z','${u("xbrl/hdfc.xml")}','loaded'),
    (5,1,'results_quarterly','2023-09-30','Q','consolidated','2023-10-17T12:00:00Z','${u("xbrl/pre.xml")}','loaded');
    INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status,attempts) VALUES
    (10,'xbrl_governance','INFY','g10','att/cg/q2.xml','done',1),
    (11,'xbrl_integrated_governance','INFY','g11','att/cg/q1.xml','done',1),
    (12,'xbrl_governance','OTHER','g12','att/cg/other.xml','done',1),
    (13,'xbrl_governance','INFY','g13','att/cg/2023.xml','done',1),
    (14,'xbrl_governance','HDFCBANK','g14','att/cg/missing.xml','failed',3);`);
  const raw = { get: async (k: string) => { reads.push(k); return k in R2 ? { text: async () => R2[k], customMetadata: {} } : null; } } as unknown as R2Bucket;
  return { DB_MARKET: market, DB_FILINGS: filings, RAW: raw, ENVIRONMENT: "test", STATUS_TOKEN: "tok", FOCUS_INDICES: "NIFTY 50" } as Env & { DB_FILINGS: D1Database & { raw: DatabaseSync } };
}
const maint = async (e: Env, name: string) => (await worker.fetch(new Request(`https://x/maint/${name}`, { method: "POST", headers: { authorization: "Bearer tok" } }), e)).json() as Promise<Record<string, any>>;
/** every text value of every table of the filings database */
const dump = (db: DatabaseSync) => (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
  .map((t) => JSON.stringify(db.prepare(`SELECT * FROM "${t.name}"`).all())).join("\n");

describe("G8 phase 2: /maint/auditors_backfill (stored results files from 2024)", () => {
  it("stores each filing's auditor firm(s) and opinion, inserts only; a second walk writes nothing", async () => {
    const e = env();
    const r = await maint(e, "auditors_backfill");
    expect(r).toMatchObject({ done: true, companies: 2, files: 4, census: { with_auditors: 3, opinion_only: 1, neither: 0 } });
    expect(r.cost.rows_written).toBeGreaterThan(0);
    const db = e.DB_FILINGS.raw;
    expect(db.prepare("SELECT filing_id, security_id, basis, period_end, seq, firm, firm_key, peer_review, cert_valid_to FROM auditor_filing ORDER BY filing_id, seq").all().map((x) => ({ ...x }))).toEqual([
      { filing_id: 1, security_id: 1, basis: "consolidated", period_end: "2026-03-31", seq: 1, firm: "Deloitte Haskins and Sells LLP", firm_key: "deloittehaskinsandsells", peer_review: 1, cert_valid_to: expect.any(String) },
      { filing_id: 2, security_id: 1, basis: "consolidated", period_end: "2026-09-30", seq: 1, firm: "S R Batliboi & Associates LLP", firm_key: "srbatliboiandassociates", peer_review: 1, cert_valid_to: "2027-07-31" },
      { filing_id: 4, security_id: 2, basis: "standalone", period_end: "2026-09-30", seq: 1, firm: "B S R & Co. LLP", firm_key: "bsrandco", peer_review: 1, cert_valid_to: "2028-07-31" },
      { filing_id: 4, security_id: 2, basis: "standalone", period_end: "2026-09-30", seq: 2, firm: "Batliboi & Purohit", firm_key: "batliboiandpurohit", peer_review: 1, cert_valid_to: "2028-04-30" }]);
    expect(db.prepare("SELECT filing_id, value FROM governance_fact WHERE key='audit_opinion' ORDER BY filing_id").all().map((x) => ({ ...x }))).toEqual([
      { filing_id: 1, value: "unmodified" }, { filing_id: 2, value: "unmodified" }, { filing_id: 3, value: "not_applicable" }, { filing_id: 4, value: expect.stringMatching(/^(unmodified|not_applicable)$/) }]);
    // the 2023 filing (before the floor) is not read
    expect(reads).not.toContain("att/xbrl/pre.xml");
    // a restart of the walk (cursor cleared) offers the same rows again: nothing is written
    db.exec("DELETE FROM daily_refresh WHERE slot='auditors_backfill'");
    const ours = () => JSON.stringify([db.prepare("SELECT * FROM auditor_filing").all(), db.prepare("SELECT * FROM governance_fact").all()]);
    const before = ours();
    const again = await maint(e, "auditors_backfill");
    expect(again).toMatchObject({ done: true, files: 4, rows: 0 });
    expect(ours()).toBe(before);
  });
  it("storedOpinion: modified opinions and qualification statements are 'modified'", () => {
    expect(storedOpinion("Declaration of unmodified opinion")).toBe("unmodified");
    expect(storedOpinion("Unmodified opinion")).toBe("unmodified");
    expect(storedOpinion("Not applicable")).toBe("not_applicable");
    expect(storedOpinion("Statement on impact of audit qualification")).toBe("modified");
  });
});

describe("G8 phase 2: /maint/board_backfill (stored governance XBRL from 2024) and the cron step", () => {
  it("walks the governance files of the focus companies; other companies' files are not read; before the floor not stored", async () => {
    const e = env();
    reads.length = 0;
    const r = await maint(e, "board_backfill");
    expect(r).toMatchObject({ done: false, files: 3, before_floor: 1, blocked: false });
    expect(reads.sort()).toEqual(["att/cg/2023.xml", "att/cg/q1.xml", "att/cg/q2.xml"]); // OTHER (job 12) and the failed job 14 not read
    expect((await maint(e, "board_backfill"))).toMatchObject({ done: true, files: 0 });
    const db = e.DB_FILINGS.raw;
    expect(db.prepare("SELECT period_end, source_kind, job_id, directors, complaints_pending FROM governance_filing ORDER BY period_end").all().map((x) => ({ ...x }))).toEqual([
      { period_end: "2026-06-30", source_kind: "xbrl_integrated_governance", job_id: 11, directors: 4, complaints_pending: 3 },
      { period_end: "2026-09-30", source_kind: "xbrl_governance", job_id: 10, directors: 5, complaints_pending: 3 }]);
    expect(db.prepare("SELECT name_key, name, category, status, appointed_on, ceased_on FROM board_member WHERE period_end='2026-09-30' ORDER BY name_key").all().map((x) => ({ ...x }))).toEqual([
      { name_key: "asha rao", name: "Asha Rao", category: "Executive Director / Chairperson / Promoter", status: "Active", appointed_on: "2015-04-01", ceased_on: null },
      { name_key: "karan shah", name: "Karan Shah", category: "Non-Executive - Independent Director", status: "Active", appointed_on: "2022-02-01", ceased_on: null },
      { name_key: "meera iyer", name: "Meera Iyer", category: "Non-Executive - Independent Director", status: "Active", appointed_on: "2026-08-15", ceased_on: null },
      { name_key: "rohan das", name: "Rohan Das", category: "Non-Executive - Non Independent Director", status: "Ceased", appointed_on: "2019-01-10", ceased_on: "2026-09-01" },
      { name_key: "vikram sen", name: "Vikram Sen", category: "Non-Executive - Independent Director", status: "Active", appointed_on: "2021-08-01", ceased_on: null }]);
  });

  it("HARD RULE: no PAN / DIN / date of birth in any table, any answer, or the board_member columns", async () => {
    const e = env();
    const answers = JSON.stringify([await maint(e, "board_backfill"), await maint(e, "board_backfill")]);
    const all = dump(e.DB_FILINGS.raw);
    for (const s of PII) { expect(all).not.toContain(s); expect(answers).not.toContain(s); }
    expect(all).toContain("Meera Iyer"); // the rows are there
    const cols = (e.DB_FILINGS.raw.prepare("SELECT name FROM pragma_table_info('board_member')").all() as { name: string }[]).map((c) => c.name);
    expect(cols.filter((c) => /pan|din|birth|dob/i.test(c))).toEqual([]);
  });

  it("the cron step waits for the backfill, then takes newly arriving files on the same cursor", async () => {
    const e = env();
    const deps = { filings: d1Sql(e.DB_FILINGS), market: d1Sql(e.DB_MARKET), getText: async (k: string) => R2[k] ?? null, now: () => new Date("2026-11-06T10:00:00Z"), focus: ["INFY", "HDFCBANK"] };
    expect(await boardPass(deps, { cron: true })).toMatchObject({ skipped: expect.stringMatching(/not caught up/) });
    await boardPass(deps); await boardPass(deps);
    e.DB_FILINGS.raw.exec("INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (20,'xbrl_governance','INFY','g20','att/cg/new.xml','todo')");
    expect(await boardPass(deps, { cron: true })).toMatchObject({ blocked: true, files: 0 }); // not downloaded yet: waits
    e.DB_FILINGS.raw.exec("UPDATE fetch_job SET status='done' WHERE job_id=20");
    expect(await boardPass(deps, { cron: true })).toMatchObject({ files: 1, done: true });
    expect(e.DB_FILINGS.raw.prepare("SELECT count(*) AS n FROM board_member WHERE period_end='2026-12-31'").get()).toEqual({ n: 5 });
  });
});

describe("G8 phase 2: event fields from the stored rows", () => {
  it("auditor, opinion and board fields (today 2026-11-06)", async () => {
    const e = env();
    await maint(e, "auditors_backfill"); await maint(e, "board_backfill"); await maint(e, "board_backfill");
    const f = async (sid: number) => Object.fromEntries(governanceFields(await governanceInputs(d1Sql(e.DB_FILINGS), sid, "2026-11-06"), "2026-11-06").map((x) => [x.field, [x.value, x.reason]]));
    expect(await f(1)).toEqual({
      auditor_latest: ["S R Batliboi & Associates LLP", null],
      auditor_change_12m: ["yes, 2026-10-23: in S R Batliboi & Associates LLP; out Deloitte Haskins and Sells LLP", null],
      auditor_tenure_since: ["2026-09-30", "auditor names are stored from 2026-03-31"],
      audit_opinion_latest: ["unmodified", null],
      board_size_latest: ["4", null],
      independent_director_share_latest: ["75.0", null],
      director_changes_12m: ["2 (1 appointed, 1 ceased)", null],
      investor_complaints_pending_latest: ["3", null],
    });
    const h = await f(2);
    expect(h.auditor_latest).toEqual(["B S R & Co. LLP; Batliboi & Purohit", null]);
    expect(h.auditor_change_12m).toEqual([null, "only one stored filing names its auditors (period 2026-09-30)"]);
    expect(h.board_size_latest).toEqual([null, "no governance filing stored (governance XBRL, from 2024)"]);
    expect(h.investor_complaints_pending_latest![0]).toBeNull();
    const none = await f(3);
    expect(none.auditor_latest).toEqual([null, "no stored results filing names its auditors (Integrated Filing results, from 2024)"]);
    expect(none.audit_opinion_latest).toEqual([null, "no audit opinion stored (results files from 2024)"]);
  });
  it("a file naming its directors without category: share null with reason; tenure follows the unbroken run", () => {
    const g = {
      auditors: [["2025-06-30", "A"], ["2025-09-30", "B"], ["2025-12-31", "B"], ["2026-03-31", "B"]].map(([p, k]) => ({ periodEnd: p!, basis: "consolidated", firm: `Firm ${k}`, firmKey: k!, disclosedAt: `${p}T12:00:00Z` })),
      opinions: [{ periodEnd: "2026-03-31", basis: "consolidated", disclosedAt: "x", value: "not_applicable" }],
      board: [{ periodEnd: "2026-06-30", nameKey: "a", category: null, status: null, appointedOn: null, ceasedOn: null }],
      files: [{ periodEnd: "2026-06-30", sourceKind: "xbrl_governance", directors: 1, complaintsPending: null }],
    };
    const r = Object.fromEntries(governanceFields(g, "2026-11-06").map((x) => [x.field, [x.value, x.reason]]));
    expect(r.auditor_tenure_since).toEqual(["2025-09-30", "auditor names are stored from 2025-06-30"]);
    expect(r.auditor_change_12m).toEqual(["no", null]); // the change (A → B) was first disclosed 2025-09-30, over 12 months ago
    expect(r.audit_opinion_latest).toEqual(["not applicable", null]);
    expect(r.independent_director_share_latest).toEqual([null, "director category not filed"]);
    expect(r.investor_complaints_pending_latest).toEqual([null, "investor complaints pending not filed in the stored governance files"]);
  });
});
