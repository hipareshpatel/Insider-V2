import { describe, expect, it } from "vitest";
import { attachmentKey, attachments } from "../src/discover.js";

describe("attachment discovery (D128)", () => {
  it("results: only periods ending on/after the cut-off; xml only; skips '-' and null links", () => {
    const json = JSON.stringify([
      { toDate: "31-Dec-2024", resultDetailedDataLink: "https://nsearchives.nseindia.com/corporate/xbrl/INDAS_1_2_16012025.xml" },
      { toDate: "31-Mar-2019", resultDetailedDataLink: "https://nsearchives.nseindia.com/corporate/xbrl/INDAS_old.xml" },
      { toDate: "30-Sep-2024", resultDetailedDataLink: "https://nsearchives.nseindia.com/corporate/xbrl/-" },
    ]);
    expect(attachments("results_quarterly", json, "2021-04-01")).toEqual(["https://nsearchives.nseindia.com/corporate/xbrl/INDAS_1_2_16012025.xml"]);
  });
  it("other lists: every xml link", () => {
    const json = '[{"x":"https://nsearchives.nseindia.com/corporate/xbrl/SHP_1_WEB.xml"},{"y":"https://nsearchives.nseindia.com/corporate/null"}]';
    expect(attachments("shareholding", json, "2021-04-01")).toEqual(["https://nsearchives.nseindia.com/corporate/xbrl/SHP_1_WEB.xml"]);
    expect(attachmentKey("https://nsearchives.nseindia.com/corporate/xbrl/SHP_1_WEB.xml")).toBe("att/xbrl/SHP_1_WEB.xml");
  });
});
