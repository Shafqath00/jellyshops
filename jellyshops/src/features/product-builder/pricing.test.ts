import { describe, expect, it } from "vitest";
import { emptyUnitPricing, parseUnitPricing, profitSummary, unitPriceMinor } from "./pricing";

describe("profitSummary", () => {
  it("calculates profit and margin from price and cost", () => {
    expect(profitSummary("10.00", "4.00")).toEqual({ profitMinor: 600, marginPercent: 60 });
    expect(profitSummary("30", "20")).toEqual({ profitMinor: 1000, marginPercent: 33.3 });
  });
  it("shows a loss as negative", () => expect(profitSummary("5", "8")).toEqual({ profitMinor: -300, marginPercent: -60 }));
  it("is blank without both numbers or with bad input", () => {
    expect(profitSummary("10", "")).toBeNull();
    expect(profitSummary("", "4")).toBeNull();
    expect(profitSummary("abc", "4")).toBeNull();
  });
  it("has no margin on a free product", () => expect(profitSummary("0", "2")).toEqual({ profitMinor: -200, marginPercent: null }));
});

describe("unit pricing", () => {
  it("prices per base amount across compatible units", () => {
    expect(unitPriceMinor(1000, { totalAmount: 500, totalUnit: "g", baseAmount: 100, baseUnit: "g" })).toBe(200);
    expect(unitPriceMinor(1000, { totalAmount: 500, totalUnit: "g", baseAmount: 1, baseUnit: "kg" })).toBe(2000);
    expect(unitPriceMinor(900, { totalAmount: 750, totalUnit: "ml", baseAmount: 1, baseUnit: "l" })).toBe(1200);
  });
  it("treats an untouched section as no unit pricing", () => expect(parseUnitPricing(emptyUnitPricing)).toEqual({ value: null }));
  it("parses a complete entry", () => expect(parseUnitPricing({ totalAmount: "500", totalUnit: "g", baseAmount: "100", baseUnit: "g" }).value).toEqual({ totalAmount: 500, totalUnit: "g", baseAmount: 100, baseUnit: "g" }));
  it("rejects incomplete or mismatched entries", () => {
    expect(parseUnitPricing({ ...emptyUnitPricing, totalAmount: "" , baseAmount: "50" }).error).toMatch(/contains/);
    expect(parseUnitPricing({ totalAmount: "500", totalUnit: "g", baseAmount: "1", baseUnit: "l" }).error).toMatch(/same thing/);
    expect(parseUnitPricing({ totalAmount: "-1", totalUnit: "g", baseAmount: "1", baseUnit: "g" }).error).toMatch(/contains/);
  });
});
