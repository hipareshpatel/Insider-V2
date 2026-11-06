import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseShareholding, parseXbrl } from "../src/index.js";

describe("D40: promoter flag on named holders (TypeOfPromoterShareholding present)", () => {
  it("VEDL Sep 2026: promoter group holders flagged, public holders not", () => {
    const x = readFileSync(join(import.meta.dirname, "fixtures/nse/shp_VEDL_2026-09.xml"), "utf8");
    const h = parseShareholding(parseXbrl(x), { totalOverride: 1 }).namedHolders;
    const by = (n: string) => h.find((x) => x.name.startsWith(n))!;
    expect(by("TWIN STAR HOLDINGS").promoter).toBe(true);
    expect(by("ANIL AGARWAL").promoter).toBe(true);
    expect(by("LIFE INSURANCE CORPORATION").promoter).toBe(false);
    expect(by("PTC CABLES").promoter).toBe(false);
    expect(h.filter((x) => x.promoter).length).toBe(30);
  });
});
