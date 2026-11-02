import { describe, expect, it } from "vitest";
import {
  add, cmp, dec, diffIdentities, div, fiscalPeriod, formatCrore, ingest, mul, resolveAsOf, reviewUpsert,
  round, sha256Hex, toRupees, toText, withinRatio, type IdentifierRow, type Ledger, type SourceSpec,
} from "../src/index.js";

describe("decimal", () => {
  it("parses and prints exactly", () => {
    expect(toText(dec("9331.00"))).toBe("9331");
    expect(toText(dec("-0.05"))).toBe("-0.05");
    expect(toText(add(dec("0.1"), dec("0.2")))).toBe("0.3");
    expect(toText(mul(dec("1.5"), dec("2")))).toBe("3");
  });
  it("divides with rounding (BAJFINANCE split: 6,198,786,520 / 619,878,652 = 10)", () => {
    expect(toText(div(dec("6198786520"), dec("619878652"), 6))).toBe("10");
    expect(toText(div(dec("1"), dec("3"), 4))).toBe("0.3333");
    expect(toText(div(dec("2"), dec("3"), 4))).toBe("0.6667");
    expect(toText(round(dec("2.345"), 2))).toBe("2.35");
    expect(toText(round(dec("-2.345"), 2))).toBe("-2.35");
  });
  it("checks a ratio tolerance (0.1% rule, D6)", () => {
    expect(withinRatio(dec("10.005"), dec("10"), dec("0.001"))).toBe(true);
    expect(withinRatio(dec("9.948"), dec("10"), dec("0.001"))).toBe(false);
    expect(cmp(dec("1.10"), dec("1.1"))).toBe(0);
  });
  it("rejects junk", () => {
    expect(() => dec("12a")).toThrow();
    expect(() => dec("")).toThrow();
  });
});

describe("fiscal periods (D51)", () => {
  it("labels Indian FY quarters", () => {
    expect(fiscalPeriod("2026-09-30", "Q").label).toBe("Q2 FY27");
    expect(fiscalPeriod("2026-06-30", "Q").label).toBe("Q1 FY27");
    expect(fiscalPeriod("2027-03-31", "Q").label).toBe("Q4 FY27");
    expect(fiscalPeriod("2026-12-31", "9M").label).toBe("9M FY27");
    expect(fiscalPeriod("2026-09-30", "H").label).toBe("H1 FY27");
    expect(fiscalPeriod("2026-03-31", "FY").label).toBe("FY26");
  });
  it("handles a December year-end company", () => {
    expect(fiscalPeriod("2026-12-31", "FY", 12).label).toBe("FY26");
    expect(fiscalPeriod("2026-03-31", "Q", 12).label).toBe("Q1 FY26");
  });
  it("rejects a date that isn't a period end of that kind", () => {
    expect(() => fiscalPeriod("2026-08-31", "Q")).toThrow();
    expect(() => fiscalPeriod("2026-12-31", "H")).toThrow();
  });
});

describe("units (D5)", () => {
  it("formats ₹ crore with Indian grouping, no decimals", () => {
    expect(formatCrore(dec("5698064342.95"))).toBe("570");
    expect(formatCrore(dec("13180890000000"))).toBe("13,18,089");
    expect(formatCrore(toRupees(dec("1234.56"), "crores"))).toBe("1,235");
  });
});

describe("identity (B1)", () => {
  const rows: IdentifierRow[] = [
    { securityId: 1, idType: "nse_symbol", value: "BAJFINANCE", validFrom: "2024-01-01", validTo: null },
    { securityId: 1, idType: "isin", value: "INE296A01024", validFrom: "2024-01-01", validTo: "2025-06-13" },
    { securityId: 2, idType: "nse_symbol", value: "INFY", validFrom: "2024-01-01", validTo: null },
    { securityId: 2, idType: "isin", value: "INE009A01021", validFrom: "2024-01-01", validTo: null },
  ];
  it("resolves as of a date", () => {
    expect(resolveAsOf(rows, "isin", "INE296A01024", "2025-06-13")).toBe(1);
    expect(resolveAsOf(rows, "isin", "INE296A01024", "2025-06-16")).toBeNull();
  });
  it("detects an ISIN change, a rename, a new listing and a conflict", () => {
    const changes = diffIdentities(rows, [
      { symbol: "BAJFINANCE", isin: "INE296A01032", date: "2025-06-16" },
      { symbol: "INFOSYS", isin: "INE009A01021", date: "2025-06-16" },
      { symbol: "NEWCO", isin: "INE000X01011", date: "2025-06-16" },
      { symbol: "INFY", isin: "INE296A01032", date: "2025-06-16" },
      { symbol: "INFY", isin: "INE009A01021", date: "2025-06-16" },
    ]);
    expect(changes.map((c) => c.kind)).toEqual(["isin_change", "symbol_change", "new_security", "isin_change"]);
    const withConflict = diffIdentities(rows, [{ symbol: "INFY", isin: "INE296A01024", date: "2025-01-01" }]);
    expect(withConflict[0]?.kind).toBe("conflict");
  });
});

describe("review queue (B5)", () => {
  it("builds an idempotent upsert that never touches decided items", () => {
    const q = reviewUpsert({ kind: "bc_unparsed", subjectDb: "market", subjectRef: "X|2025-06-16", summary: "s" }, "t");
    expect(q.sql).toContain("ON CONFLICT");
    expect(q.sql).toContain("status = 'open'");
    expect(q.params).toHaveLength(7);
  });
});

describe("ingestion framework (B4)", () => {
  function harness(responses: Record<string, { status: number; body: string }>) {
    const loadedByKey = new Map<string, string>();
    const files: string[] = [];
    const runs: string[] = [];
    const ledger: Ledger = {
      loadedHash: async (s, d) => loadedByKey.get(`${s}|${d}`) ?? null,
      recordFile: async (r) => { loadedByKey.set(`${r.source}|${r.fileDate}`, r.sha256); files.push(r.rawKey); return files.length; },
      runStart: async (p, k) => { runs.push(`${p}:${k}`); return runs.length; },
      runEnd: async () => {},
    };
    const deps = {
      fetch: async (url: string) => {
        const r = responses[url] ?? { status: 404, body: "" };
        return { status: r.status, bytes: new TextEncoder().encode(r.body), contentType: "text/csv" };
      },
      raw: { put: async () => {} },
      ledger,
      now: () => "2026-11-03T00:00:00Z",
    };
    return { deps, files, responses };
  }
  const spec: SourceSpec<string> = {
    name: "demo",
    url: (d) => `https://x/${d}.csv`,
    missingIsNormal: true,
    parse: (b) => new TextDecoder().decode(b).split("\n").filter(Boolean),
    validate: (rows) => (rows.length ? [] : ["empty file"]),
  };

  it("loads once, skips identical bytes, reloads revised bytes", async () => {
    const h = harness({ "https://x/2026-10-30.csv": { status: 200, body: "a\nb\n" } });
    const loaded: string[][] = [];
    const load = async (rows: string[]) => { loaded.push(rows); };
    expect((await ingest(spec, "2026-10-30", h.deps, load)).status).toBe("loaded");
    expect((await ingest(spec, "2026-10-30", h.deps, load)).status).toBe("unchanged");
    h.responses["https://x/2026-10-30.csv"] = { status: 200, body: "a\nb\nc\n" };
    const third = await ingest(spec, "2026-10-30", h.deps, load);
    expect(third.status === "loaded" && third.revised).toBe(true);
    expect(loaded).toEqual([["a", "b"], ["a", "b", "c"]]);
  });
  it("treats 404 as a normal missing file, other errors as failures, and rejects failed gates", async () => {
    const h = harness({ "https://x/e.csv": { status: 200, body: "" }, "https://x/f.csv": { status: 403, body: "" } });
    const noop = async () => {};
    expect((await ingest(spec, "2026-11-01", h.deps, noop)).status).toBe("missing");
    expect((await ingest(spec, "f", h.deps, noop)).status).toBe("failed");
    expect((await ingest(spec, "e", h.deps, noop)).status).toBe("rejected");
    expect(h.files).toHaveLength(0);
  });
  it("hashes with SHA-256", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
