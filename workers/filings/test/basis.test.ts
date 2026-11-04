// D50/D51: primary basis and basis-switch breaks.
import { describe, expect, it } from "vitest";
import { decideBasis } from "../src/basis.js";

const q = (end: string, basis: string, income: number | null = 100) => ({ period_end: end, basis, income });
describe("primary basis (D50)", () => {
  it("bank → standalone, whatever it files", () => {
    expect(decideBasis({ template: "bank", quarters: [q("2026-06-30", "consolidated"), q("2026-06-30", "standalone")] }).basis).toBe("standalone");
  });
  it("operating company → consolidated; standalone-only company → standalone", () => {
    expect(decideBasis({ template: "industrial", quarters: [q("2026-06-30", "consolidated", 100), q("2026-06-30", "standalone", 80)] })).toMatchObject({ basis: "consolidated" });
    expect(decideBasis({ template: "industrial", quarters: [q("2026-06-30", "standalone")] })).toMatchObject({ basis: "standalone", reason: "no consolidated results filed" });
  });
  it("holding company (standalone income < 20% of consolidated) → both", () => {
    expect(decideBasis({ template: "industrial", quarters: [q("2026-06-30", "consolidated", 1000), q("2026-06-30", "standalone", 50)] })).toMatchObject({ basis: "both", saShare: 0.05 });
  });
  it("consolidated starting or stopping after the first quarter is a series break", () => {
    const d = decideBasis({ template: "industrial", quarters: [q("2025-06-30", "standalone"), q("2025-09-30", "standalone"), q("2025-09-30", "consolidated"), q("2025-12-31", "standalone")] });
    expect(d.breaks).toEqual([{ period_end: "2025-09-30", change: "consolidated starts" }, { period_end: "2025-12-31", change: "consolidated stops" }]);
  });
  it("a consolidated quarter that NSE lists but we did not load is a coverage gap, not a basis switch", () => {
    const quarters = [q("2022-03-31", "consolidated"), q("2022-06-30", "standalone"), q("2022-09-30", "consolidated")];
    expect(decideBasis({ template: "industrial", quarters }).breaks.length).toBe(2);
    expect(decideBasis({ template: "industrial", quarters, nseConsolidated: new Set(["2022-06-30"]) }).breaks).toEqual([]);
  });
  it("NSE list rows → (quarter, basis): Integrated Filing qe_Date and results toDate; annual rows skipped", async () => {
    const { nseListed } = await import("../src/basis.js");
    const s = nseListed([JSON.stringify({ data: [{ qe_Date: "31-MAR-2026", consolidated: "Consolidated" }, { qe_Date: "31-MAR-2026", consolidated: "Standalone" }] }),
      JSON.stringify([{ toDate: "31-Dec-2024", consolidated: "Non-Consolidated", period: "Quarterly" }, { toDate: "31-Mar-2024", consolidated: "Consolidated", period: "Annual" }])]);
    expect([...s].sort()).toEqual(["2024-12-31|standalone", "2026-03-31|consolidated", "2026-03-31|standalone"]);
  });
});

describe("coverage gap classes (work list item 2)", () => {
  it("names why a listed quarter is not loaded, preferring the most advanced file", async () => {
    const { gapClass } = await import("../src/basis.js");
    expect(gapClass([])).toBe("no XBRL link on NSE's list");
    expect(gapClass([{ url: "u" }])).toBe("linked file never queued");
    expect(gapClass([{ url: "u", job: { status: "failed", http_status: 404, kind: "x" } }])).toBe("download failed (HTTP 404)");
    expect(gapClass([{ url: "u", job: { status: "done", http_status: 200, kind: "x" }, load: { status: "review", detail: "scale guard: revenue 12 vs 1,200" } }])).toBe("review: scale guard: revenue # vs #");
    expect(gapClass([{ url: "a", job: { status: "todo", http_status: null, kind: "x" } }, { url: "b", job: { status: "done", http_status: 200, kind: "x" }, load: { status: "loaded", detail: "" } }]))
      .toBe("loaded, but under another period or basis");
  });
  it("classifies one company's gaps from its stored lists and the ledger", async () => {
    const { classifyGaps } = await import("../src/basis.js");
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { DatabaseSync } = await import("node:sqlite");
    const mk = (d: string) => { const db = new DatabaseSync(":memory:"); const M = join(import.meta.dirname, "..", "..", "..", "db", "migrations", d); for (const f of readdirSync(M).sort()) db.exec(readFileSync(join(M, f), "utf8"));
      return { raw: db, async all<T>(s: string, p: unknown[] = []) { return db.prepare(s).all(...(p as (string | number | null)[])) as T[]; }, async run(s: string, p: unknown[] = []) { return { changes: Number(db.prepare(s).run(...(p as (string | number | null)[])).changes) }; }, async batch(st: { sql: string; params: unknown[] }[]) { for (const x of st) db.prepare(x.sql).run(...(x.params as (string | number | null)[])); return st.length; } }; };
    const f = mk("filings"), m = mk("market");
    m.raw.exec("INSERT INTO security (security_id,name) VALUES (7,'X'); INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (7,'nse_symbol','INFY','2024-01-01','t')");
    const U = "https://nsearchives.nseindia.com/corporate/xbrl/A.xml";
    f.raw.exec(`INSERT INTO fetch_job (job_id,kind,symbol,url,r2_key,status) VALUES (1,'integrated_financials','INFY','l','k/l','done'), (2,'xbrl_integrated_financials','INFY','${U}','att/a','failed');
      UPDATE fetch_job SET http_status=404 WHERE job_id=2;
      INSERT INTO coverage_gap (security_id, period_end, basis) VALUES (7,'2026-06-30','consolidated'), (7,'2026-03-31','standalone')`);
    const list = JSON.stringify({ data: [{ qe_Date: "30-JUN-2026", consolidated: "Consolidated", xbrl: U }, { qe_Date: "31-MAR-2026", consolidated: "Standalone" }] });
    expect(await classifyGaps(f, m, async (k) => (k === "k/l" ? list : null))).toMatchObject({ after: 7, done: true, companies: 1 });
    expect(await f.all("SELECT period_end, status FROM coverage_gap ORDER BY period_end")).toEqual([
      { period_end: "2026-03-31", status: "no XBRL link on NSE's list" }, { period_end: "2026-06-30", status: "download failed (HTTP 404)" }]);
  });
});
