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
  it("companies with a ≥ 5 % stake held by the same company form one group; individuals, institutions and small stakes do not link", async () => {
    const { promoterGroups, holderKey } = await import("../src/shpcov.js");
    expect(holderKey("Tata Sons Pvt. Ltd.")).toBe("TATA SONS PRIVATE LIMITED");
    const rows = [
      { security_id: 1, category: "holder:IndividualsOrHinduUndividedFamilyPromoter", holder_name: "A Person", pct: "0.1" },
      { security_id: 1, category: "holder:BodiesCorporatePromoter", holder_name: "Tata Sons Private Limited", pct: "0.724" },
      { security_id: 2, category: "holder:BodiesCorporatePromoter", holder_name: "TATA SONS PVT LTD", pct: "0.437" },
      { security_id: 2, category: "holder:BodiesCorporatePromoter", holder_name: "Tata Steel Limited", pct: "0.052" },
      { security_id: 3, category: "holder:BodiesCorporatePromoter", holder_name: "Tata Steel Ltd", pct: "0.081" },
      { security_id: 4, category: "holder:IndividualsOrHinduUndividedFamilyPromoter", holder_name: "A Person", pct: "0.5" },
      { security_id: 5, category: "holder:MutualFundsOrUTI", holder_name: "Tata Sons Private Limited", pct: "0.091" },
      { security_id: 6, category: "holder:OthersIndianShareholders", holder_name: "Tata Sons Private Limited", pct: "0.012" },
    ];
    const g = promoterGroups(rows, new Map([[1, "TCS"], [2, "TATAMOTORS"], [3, "TATAINVEST"], [4, "X"], [5, "Y"], [6, "Z"]]));
    expect(g).toEqual([{ companies: ["TATAINVEST", "TATAMOTORS", "TCS"], shared_entities: ["TATA SONS PRIVATE LIMITED", "TATA STEEL LIMITED"] }]);
  });
});

describe("D40: exact promoter flag and parent companies", () => {
  it("rows flagged public never link; a parent named like a promoter entity joins its group", async () => {
    const { promoterGroups } = await import("../src/shpcov.js");
    const rows = [
      { security_id: 1, category: "holder:OthersIndianShareholders", holder_name: "Larsen & Toubro Ltd", pct: "0.68", promoter: 1 },
      { security_id: 2, category: "holder:OthersIndianShareholders", holder_name: "LARSEN AND TOUBRO LIMITED", pct: "0.73", promoter: 1 },
      { security_id: 4, category: "holder:BodiesCorporate", holder_name: "Larsen and Toubro Limited", pct: "0.09", promoter: 0 },
    ];
    const g = promoterGroups(rows, new Map([[1, "LTIM"], [2, "LTTS"], [3, "LT"], [4, "X"]]), new Map([[3, "Larsen & Toubro Limited"]]));
    expect(g).toEqual([{ companies: ["LT", "LTIM", "LTTS"], shared_entities: ["LARSEN AND TOUBRO LIMITED"] }]);
  });
});

describe("D40: a sliver held by a group entity does not chain groups", () => {
  it("an entity under 1 % in one company does not link it", async () => {
    const { promoterGroups } = await import("../src/shpcov.js");
    const rows = [
      { security_id: 1, category: "holder:OthersIndianShareholders", holder_name: "Tata Sons Private Limited", pct: "0.72", promoter: 1 },
      { security_id: 2, category: "holder:OthersIndianShareholders", holder_name: "Tata Sons Private Limited", pct: "0.44", promoter: 1 },
      { security_id: 2, category: "holder:OthersIndianShareholders", holder_name: "Some Shared LLP", pct: "0.0001", promoter: 1 },
      { security_id: 3, category: "holder:OthersIndianShareholders", holder_name: "Some Shared LLP", pct: "0.30", promoter: 1 },
    ];
    expect(promoterGroups(rows, new Map([[1, "TCS"], [2, "TATAMOTORS"], [3, "OTHER"]]))).toEqual([{ companies: ["TATAMOTORS", "TCS"], shared_entities: ["TATA SONS PRIVATE LIMITED"] }]);
  });
});
