import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "migrations");
const domains = ["market", "filings", "announce", "memory", "graph", "app"];

function apply(domain: string): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const f of readdirSync(join(root, domain)).filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(root, domain, f), "utf8"));
  }
  return db;
}

describe("D1 migrations (§5: one database per domain)", () => {
  it.each(domains)("%s applies cleanly", (d) => {
    const db = apply(d);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.length).toBeGreaterThan(2);
  });

  it("market: identity history allows a symbol to be reused only with a new valid_from", () => {
    const db = apply("market");
    db.exec("INSERT INTO security (security_id, name) VALUES (1,'A'), (2,'B')");
    const ins = db.prepare(
      "INSERT INTO security_identifier (security_id,id_type,value,valid_from,source) VALUES (?,?,?,?,?)",
    );
    ins.run(1, "nse_symbol", "ABC", "2024-01-01", "t");
    expect(() => ins.run(2, "nse_symbol", "ABC", "2024-01-01", "t")).toThrow();
    ins.run(2, "nse_symbol", "ABC", "2025-06-01", "t");
  });

  it("filings: a canonical value needs a value or a null reason (D52)", () => {
    const db = apply("filings");
    db.exec("INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (1,1,'results_xbrl','2026-10-23T14:49:37Z','u')");
    const ins = db.prepare(`INSERT INTO fin_value (security_id,template,statement,line,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,origin,extractor_version)
      VALUES (1,'industrial','pl','revenue','2026-09-30','Q','consolidated','original',?,?,'2026-10-23T14:49:37Z',1,'reported','x1')`);
    expect(() => ins.run(null, null)).toThrow();
    ins.run(null, "not_reported");
  });

  it("filings: a derived figure can never be stored (owner #347)", () => {
    const db = apply("filings");
    db.exec("INSERT INTO filing (filing_id,security_id,kind,disclosed_at,source_url) VALUES (1,1,'results_xbrl','2026-10-23T14:49:37Z','u')");
    const ins = db.prepare(`INSERT INTO fin_value (security_id,template,statement,line,period_end,period_kind,basis,version,value,null_reason,disclosed_at,filing_id,origin,extractor_version)
      VALUES (1,'industrial','pl',?,'2026-09-30','Q','consolidated','original','1',NULL,'2026-10-23T14:49:37Z',1,?,'x1')`);
    expect(() => ins.run("revenue", "computed")).toThrow(/never stored/);
    ins.run("revenue", "reported");
    ins.run("pat", "extracted");
    expect(() => db.exec("UPDATE fin_value SET origin='computed' WHERE line='pat'")).toThrow(/never stored/);
  });

  it("market: corporate actions dedupe across series (§5.2)", () => {
    const db = apply("market");
    db.exec("INSERT INTO security (security_id, name) VALUES (1,'A')");
    const ins = db.prepare("INSERT INTO corp_action (security_id,ex_date,type,raw_purpose,status) VALUES (1,'2025-06-16','split',?, 'parsed')");
    ins.run("FV SPLIT RS 2 TO RE 1");
    expect(() => ins.run("FV SPLIT RS 2 TO RE 1")).toThrow();
  });
});
