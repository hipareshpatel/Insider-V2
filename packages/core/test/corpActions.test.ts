import { describe, expect, it } from "vitest";
import { adjustPrice, decideFactor, parsePurpose } from "../src/index.js";

const comps = (...p: string[]) => p.flatMap((x) => parsePurpose(x).components);

describe("corporate-action factors (D6)", () => {
  it("BAJFINANCE 2025-06-16: split 2→1 + bonus 4:1 = 10×, from share counts, matches Bc", () => {
    const d = decideFactor({ exDate: "2025-06-16", components: comps("FV SPLT FRM RS 2 TO RE 1", "BONUS 4:1"), sharesBefore: 619878652, sharesOnEx: 6198786520, prevClose: "9331.00", faceValue: "2" });
    expect(d).toMatchObject({ factor: "0.1", method: "share_ratio", status: "auto" });
  });
  it("Phase 1 test 1: BAJFINANCE adjusted close 2025-06-13 = 933.10, continuous across the ex-date", () => {
    const f = [{ exDate: "2025-06-16", factor: "0.1" }];
    expect(adjustPrice("9331.00", "2025-06-13", f)).toBe("933.1");
    expect(adjustPrice("938.00", "2025-06-16", f)).toBe("938");
  });
  it("share count off by > 0.1% from the Bc text → review, never silently trusted", () => {
    const d = decideFactor({ exDate: "2025-06-16", components: comps("BONUS 1:1"), sharesBefore: 1000000, sharesOnEx: 2050000, prevClose: "100", faceValue: "10" });
    expect(d.status).toBe("review");
  });
  it("January 2024 uses the Bc ratio (no MCAP yet)", () => {
    expect(decideFactor({ exDate: "2024-01-15", components: comps("BONUS 1:1"), sharesBefore: null, sharesOnEx: null, prevClose: "100", faceValue: "10" }))
      .toMatchObject({ factor: "0.5", method: "bc_ratio", status: "auto" });
  });
  it("rights: TERP", () => {
    // prev close 100, 1:4 at FV 10 + premium 70 = 80 → TERP = (4×100 + 1×80)/5 = 96 → factor 0.96
    expect(decideFactor({ exDate: "2025-01-10", components: comps("RIGHTS 1:4 @ PRM RS 70"), sharesBefore: null, sharesOnEx: null, prevClose: "100", faceValue: "10" }))
      .toMatchObject({ factor: "0.96", method: "terp", status: "auto" });
  });
  it("demerger: price-ratio estimate, always reviewed", () => {
    expect(decideFactor({ exDate: "2025-01-10", components: comps("DEMERGER"), sharesBefore: 1, sharesOnEx: 1, prevClose: "200", faceValue: "10", openOnEx: "150" }))
      .toMatchObject({ factor: "0.75", method: "price_ratio", status: "review" });
  });
  it("consolidation multiplies the other way", () => {
    expect(decideFactor({ exDate: "2025-01-10", components: comps("FV SPLT FRM RS 1 TO RS 10"), sharesBefore: 1000, sharesOnEx: 100, prevClose: "5", faceValue: "1" }))
      .toMatchObject({ factor: "10", method: "share_ratio", status: "auto" });
  });
});

describe("split without share counts (first day in MCAP)", () => {
  it("auto when the price move agrees with the Bc ratio within 5%, else review", () => {
    const comps = parsePurpose("FV SPLT FRM RS 10 TO RE 1").components;
    expect(decideFactor({ exDate: "2025-03-10", components: comps, sharesBefore: null, sharesOnEx: null, prevClose: "1000", faceValue: "10", openOnEx: "101" }))
      .toMatchObject({ factor: "0.1", method: "bc_ratio", status: "auto" });
    expect(decideFactor({ exDate: "2025-03-10", components: comps, sharesBefore: null, sharesOnEx: null, prevClose: "1000", faceValue: "10", openOnEx: "500" }).status).toBe("review");
  });
});
