import { describe, expect, it } from "vitest";
import { eventFields, resultsDeadline } from "../src/eventfeatures.js";

describe("§12/§13 event fields", () => {
  const f = (xs: ReturnType<typeof eventFields>, k: string) => xs.find((x) => x.field === k)!;
  it("results timing, LODR deadlines, Friday-late flag", () => {
    expect(resultsDeadline("2026-06-30")).toBe("2026-08-14"); // 45 days
    expect(resultsDeadline("2026-03-31")).toBe("2026-05-30"); // 60 days for the year end
    const r = eventFields({
      today: "2026-11-06",
      results: [
        { periodEnd: "2026-03-31", firstAt: "2026-05-29T11:00:00Z" },   // on time
        { periodEnd: "2026-06-30", firstAt: "2026-08-20T09:00:00Z" },   // late (deadline 14 Aug)
        { periodEnd: "2026-09-30", firstAt: "2026-10-16T12:00:00Z" }],  // Friday 16 Oct, 17:30 IST
      meetings: [{ d: 20261020, purpose: "Financial Results", description: null }, { d: 20270115, purpose: "Board Meeting Intimation", description: "to approve the financial results for Q3" }, { d: 20261110, purpose: "Fund raising", description: "" }],
      ratings: [],
    });
    expect(f(r, "last_result_date").value).toBe("2026-10-16");
    expect(f(r, "next_result_date").value).toBe("2027-01-15");
    expect(f(r, "days_to_next_result").value).toBe("70");
    expect(f(r, "late_results_12m").value).toBe("1");
    expect(f(r, "results_filed_friday_late").value).toBe("1");
    expect(f(r, "credit_rating_latest").reason).toMatch(/no credit rating/);
  });
  it("credit rating: latest and 12-month direction", () => {
    const base = { today: "2026-11-06", results: [], meetings: [] };
    const r = eventFields({ ...base, ratings: [{ agency: "CRISIL", rating: "AA", outlook: "Stable", action: "Reaffirm", ratedOn: 20250101 },
      { agency: "ICRA", rating: "AA+", outlook: "Stable", action: "Upgrade", ratedOn: 20260301 }] });
    expect(f(r, "credit_rating_latest").value).toBe("AA+ (Stable), ICRA, 2026-03-01");
    expect(f(r, "rating_action_12m").value).toBe("up");
    const d = eventFields({ ...base, ratings: [{ agency: "CARE", rating: "A", outlook: null, action: "Downgrade", ratedOn: 20260901 }, { agency: "ICRA", rating: "AA", outlook: null, action: "Upgrade", ratedOn: 20260101 }] });
    expect(f(d, "rating_action_12m").value).toBe("mixed");
    expect(f(d, "next_result_date").reason).toMatch(/no board meeting/);
  });
  it("credit rating: how the latest rating was linked (G11)", () => {
    const base = { today: "2026-11-06", results: [], meetings: [] };
    const company = { isins: ["INE062A01020"], name: "STATE BANK OF INDIA" };
    const old = { agency: "CRISIL", rating: "AAA", outlook: "Stable", action: "Reaffirm", ratedOn: 20250101, isin: "INE062A08223", company: "State Bank of India" };
    const bond = { agency: "ICRA", rating: "AAA", outlook: "Stable", action: "Reaffirm", ratedOn: 20260301, isin: "INE651A08041", company: "State Bank of India" };
    expect(f(eventFields({ ...base, ratings: [old, bond], company }), "credit_rating_linked_by").value).toBe("name");
    expect(f(eventFields({ ...base, ratings: [old], company }), "credit_rating_linked_by").value).toBe("isin_issuer");
    expect(f(eventFields({ ...base, ratings: [], company }), "credit_rating_linked_by").reason).toMatch(/no credit rating/);
    expect(f(eventFields({ ...base, ratings: [old] }), "credit_rating_linked_by").reason).toBe("company identifiers not read");
  });
});
