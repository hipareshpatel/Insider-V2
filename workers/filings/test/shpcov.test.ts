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

describe("D40: promoter groups from shared promoter entities", () => {
  it("companies naming the same promoter company form one group; individuals and other categories do not link", async () => {
    const { promoterGroups, holderKey } = await import("../src/shpcov.js");
    expect(holderKey("Tata Sons Pvt. Ltd.")).toBe("TATA SONS PRIVATE LIMITED");
    const rows = [
      { security_id: 1, category: "holder:IndividualsOrHinduUndividedFamilyPromoter", holder_name: "A Person", pct: "0.1" },
      { security_id: 1, category: "holder:BodiesCorporatePromoter", holder_name: "Tata Sons Private Limited", pct: "0.7" },
      { security_id: 2, category: "holder:BodiesCorporatePromoter", holder_name: "TATA SONS PVT LTD", pct: "0.3" },
      { security_id: 2, category: "holder:BodiesCorporatePromoter", holder_name: "Tata Steel Limited", pct: "0.1" },
      { security_id: 3, category: "holder:BodiesCorporatePromoter", holder_name: "Tata Steel Ltd", pct: "0.2" },
      { security_id: 4, category: "holder:IndividualsOrHinduUndividedFamilyPromoter", holder_name: "A Person", pct: "0.5" },
      { security_id: 5, category: "holder:MutualFunds", holder_name: "Tata Sons Private Limited", pct: "0.02" },
    ];
    const g = promoterGroups(rows, new Map([[1, "TCS"], [2, "TATAMOTORS"], [3, "TATAINVEST"], [4, "X"], [5, "Y"]]));
    expect(g).toEqual([{ companies: ["TATAINVEST", "TATAMOTORS", "TCS"], shared_entities: ["TATA SONS PRIVATE LIMITED", "TATA STEEL LIMITED"] }]);
  });
});
