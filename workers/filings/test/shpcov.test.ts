import { describe, expect, it } from "vitest";
import { shpListed } from "../src/shpcov.js";

describe("shareholding coverage (work list 2.8)", () => {
  it("reads each listed XBRL with its quarter-end as-of date, whatever the date field is called; rows without XBRL counted", () => {
    const list = JSON.stringify([
      { symbol: "INFY", date: "30-SEP-2026", submissionDate: "15-OCT-2026", xbrl: "https://nsearchives.nseindia.com/corporate/xbrl/SHP_1.xml" },
      { symbol: "INFY", date: "30-JUN-2026", xbrl: "https://nsearchives.nseindia.com/corporate/xbrl/SHP_1.xml" }, // same file twice
      { symbol: "INFY", date: "31-MAR-2026", xbrl: "-" },
    ]);
    const r = shpListed([list]);
    expect(r.rows).toEqual([{ url: "https://nsearchives.nseindia.com/corporate/xbrl/SHP_1.xml", asOf: "2026-09-30" }]);
    expect(r.noXbrl).toEqual(["2026-03-31"]);
    expect(r.keys).toEqual(["symbol", "date", "submissionDate", "xbrl"]);
  });
});
