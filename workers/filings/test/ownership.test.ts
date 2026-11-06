import { describe, expect, it } from "vitest";
import { ownershipFields } from "../src/ownership.js";

describe("§11 ownership fields from two shareholding snapshots", () => {
  const now = { asOf: "2026-09-30", shares: { total: 1000, non_promoter_non_public: 0, promoter: 600, public: 400, fii: 150, dii: 120, mutual_funds: 80 }, pledged: 60 };
  const prev = { asOf: "2026-06-30", shares: { total: 1000, non_promoter_non_public: 0, promoter: 620, public: 380, fii: 140, dii: 120, mutual_funds: 70 }, pledged: 31 };
  const v = (rows: ReturnType<typeof ownershipFields>, f: string) => rows.find((r) => r.field === f)!;
  it("holding % on the SCRR base, pledge % of promoter holding, changes in percentage points", () => {
    const r = ownershipFields(now, prev);
    expect(v(r, "promoter_holding_pct").value).toBe("60.00");
    expect(v(r, "promoter_holding_change_qoq").value).toBe("-2.00");
    expect(v(r, "promoter_pledged_pct").value).toBe("10.00"); // 60 of 600
    expect(v(r, "pledge_change_qoq").value).toBe("5.00");     // 31 of 620 = 5 %
    expect(v(r, "mf_holding_change_qoq").value).toBe("1.00");
  });
  it("the non-promoter-non-public block is outside the base; missing data says why", () => {
    const r = ownershipFields({ ...now, shares: { ...now.shares, total: 1100, non_promoter_non_public: 100 } }, null);
    expect(v(r, "public_holding_pct").value).toBe("40.00");
    expect(v(r, "promoter_holding_change_qoq").reason).toMatch(/no earlier shareholding filing/);
    expect(v(ownershipFields({ ...now, pledged: null }, null), "promoter_pledged_pct").reason).toMatch(/promoter pledge not filed/);
  });
});
