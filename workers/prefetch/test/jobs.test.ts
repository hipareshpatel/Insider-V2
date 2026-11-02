import { describe, expect, it } from "vitest";
import { bulkJobs, companyJobs } from "../src/jobs.js";

describe("prefetch jobs (D128)", () => {
  it("12 endpoints per company, keys by kind/symbol/date", () => {
    const j = companyJobs(["INFY", "M&M"], "2026-11-03");
    expect(j).toHaveLength(24);
    expect(j.find((x) => x.kind === "shareholding" && x.symbol === "M&M")?.url).toBe("https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=M%26M");
    expect(j[0]?.key).toBe("api/results_quarterly/INFY/2026-11-03.json");
  });
  it("bulk: ratings once + announcements month by month from Jan 2024", () => {
    const b = bulkJobs("2026-11-03");
    expect(b[0]?.kind).toBe("credit_rating");
    const ann = b.filter((x) => x.kind === "announcements");
    expect(ann).toHaveLength(35);
    expect(ann[1]?.url).toContain("from_date=01-02-2024&to_date=29-02-2024");
  });
});
