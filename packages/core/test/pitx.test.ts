// C53: insider trades from NSE's PIT XBRL (system since 3 May 2026).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePitXbrl, parseXbrl } from "../src/index.js";

const inst = parseXbrl(readFileSync(join(import.meta.dirname, "fixtures", "nse", "pitx_ACEVECTOR_20261103.xml"), "utf8"));
describe("PIT XBRL reader (C53)", () => {
  it("one trade per disclosed person; values as filed; broadcast time from the list; identification number never read", () => {
    const t = parsePitXbrl(inst, { appId: "4155", broadcast: "03-Nov-2026 22:09:12" });
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ key: "pitx:4155:Disclosure1", symbol: "ACEVECTOR", person: "Kunal Bahl", category: "Promoter and Director", secType: "Equity", txn: "Buy",
      mode: "Market Purchase", qty: 50000, beforeQty: 57093520, afterQty: 57143520, fromDate: "2026-11-02", toDate: "2026-11-02", exchange: "NSE", disclosedAt: "2026-11-03T22:09:12" });
    expect(JSON.stringify(t)).not.toContain("PLACEHOLDER");
    expect(t[1]).toMatchObject({ person: "Second Person", txn: "Sell", qty: 1000 });
  });
});
