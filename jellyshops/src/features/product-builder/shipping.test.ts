import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, countryOptions, describeShipping, dimensionsToDraft, emptyShipping, formatHsCode, formatWeight, parcelWeight, parseDimensions, parseHsCode, parseWeight, shippingToValues, validateShipping, weightToDraft } from "./shipping";

describe("weight", () => {
  it("converts to whole grams from any unit", () => {
    expect(parseWeight({ weight: "250", weightUnit: "g" }).value).toBe(250);
    expect(parseWeight({ weight: "1.25", weightUnit: "kg" }).value).toBe(1250);
    expect(parseWeight({ weight: "0,5", weightUnit: "kg" }).value).toBe(500);
    expect(parseWeight({ weight: "1", weightUnit: "lb" }).value).toBe(454);
    expect(parseWeight({ weight: "8", weightUnit: "oz" }).value).toBe(227);
    expect(parseWeight({ weight: "0", weightUnit: "g" }).value).toBe(0);
  });
  it("treats blank as not set and explains bad input", () => {
    expect(parseWeight({ weight: "  ", weightUnit: "kg" })).toEqual({ value: null });
    expect(parseWeight({ weight: "abc", weightUnit: "kg" }).error).toMatch(/number/);
    expect(parseWeight({ weight: "-2", weightUnit: "kg" }).error).toMatch(/number/);
    expect(parseWeight({ weight: "1.2345", weightUnit: "kg" }).error).toMatch(/number/);
    expect(parseWeight({ weight: "100001", weightUnit: "kg" }).error).toMatch(/too large/);
  });
  it("shows a stored weight in grams below a kilo and kilos above", () => {
    expect(weightToDraft(250)).toEqual({ weight: "250", weightUnit: "g" });
    expect(weightToDraft(999)).toEqual({ weight: "999", weightUnit: "g" });
    expect(weightToDraft(1000)).toEqual({ weight: "1", weightUnit: "kg" });
    expect(weightToDraft(1250)).toEqual({ weight: "1.25", weightUnit: "kg" });
    expect(weightToDraft(null)).toEqual({ weight: "", weightUnit: "kg" });
    expect(formatWeight(250)).toBe("250 g");
    expect(formatWeight(2500)).toBe("2.5 kg");
  });
  it("round trips what it shows", () => {
    for (const grams of [0, 1, 250, 999, 1000, 1250, 12345, 100_000_000]) {
      const shown = weightToDraft(grams);
      expect(parseWeight(shown).value).toBe(grams);
    }
  });
});

describe("dimensions", () => {
  it("converts to millimetres", () => {
    expect(parseDimensions({ length: "30", width: "20", height: "5", dimensionUnit: "cm" })).toEqual({ lengthMm: 300, widthMm: 200, heightMm: 50 });
    expect(parseDimensions({ length: "12.5", width: "8", height: "1", dimensionUnit: "in" })).toEqual({ lengthMm: 318, widthMm: 203, heightMm: 25 });
    expect(parseDimensions({ length: "120", width: "80", height: "10", dimensionUnit: "mm" })).toEqual({ lengthMm: 120, widthMm: 80, heightMm: 10 });
  });
  it("needs all three or none", () => {
    expect(parseDimensions({ length: "", width: "", height: "", dimensionUnit: "cm" })).toEqual({ lengthMm: null, widthMm: null, heightMm: null });
    expect(parseDimensions({ length: "30", width: "", height: "5", dimensionUnit: "cm" }).error).toMatch(/together/);
    expect(parseDimensions({ length: "x", width: "1", height: "1", dimensionUnit: "cm" }).error).toMatch(/number/);
    expect(parseDimensions({ length: "1000001", width: "1", height: "1", dimensionUnit: "cm" }).error).toMatch(/too large/);
  });
  it("shows stored sizes in centimetres and round trips them", () => {
    expect(dimensionsToDraft(300, 200, 50)).toEqual({ length: "30", width: "20", height: "5", dimensionUnit: "cm" });
    expect(dimensionsToDraft(125, 80, 10)).toEqual({ length: "12.5", width: "8", height: "1", dimensionUnit: "cm" });
    expect(dimensionsToDraft(null, 200, 50)).toEqual({ length: "", width: "", height: "", dimensionUnit: "cm" });
    expect(parseDimensions(dimensionsToDraft(125, 80, 10))).toEqual({ lengthMm: 125, widthMm: 80, heightMm: 10 });
  });
});

describe("HS code", () => {
  it("keeps digits only and requires 6 to 10", () => {
    expect(parseHsCode("6109.10")).toEqual({ value: "610910" });
    expect(parseHsCode("6109 10 0012")).toEqual({ value: "6109100012" });
    expect(parseHsCode("61-09-10")).toEqual({ value: "610910" });
    expect(parseHsCode("")).toEqual({ value: null });
    expect(parseHsCode("6109").error).toMatch(/6 to 10/);
    expect(parseHsCode("61091000123").error).toMatch(/6 to 10/);
    expect(parseHsCode("61a910").error).toMatch(/digits/);
  });
  it("formats for reading", () => {
    expect(formatHsCode("610910")).toBe("6109.10");
    expect(formatHsCode("6109100012")).toBe("6109.10.0012");
  });
});

describe("shippingToValues and validateShipping", () => {
  it("turns the form into what the server stores, clearing blanks", () => {
    expect(shippingToValues({ ...emptyShipping, weight: "250", weightUnit: "g", length: "30", width: "20", height: "5", countryOfOrigin: "IN", hsCode: "6109.10" }))
      .toEqual({ weightGrams: 250, lengthMm: 300, widthMm: 200, heightMm: 50, countryOfOrigin: "IN", hsCode: "610910" });
    expect(shippingToValues(emptyShipping)).toEqual({ weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, countryOfOrigin: null, hsCode: null });
  });
  it("reports each problem against its field", () => {
    expect(validateShipping(emptyShipping)).toEqual({});
    expect(Object.keys(validateShipping({ ...emptyShipping, weight: "x", length: "1", hsCode: "12" })).sort()).toEqual(["dimensions", "hsCode", "weight"]);
  });
});

describe("order display", () => {
  it("describes a line for packing", () => {
    expect(describeShipping({ weightGrams: 250, lengthMm: 300, widthMm: 200, heightMm: 50, countryOfOrigin: "IN", hsCode: "610910" })).toBe("250 g · 30 × 20 × 5 cm · Made in India · HS 6109.10");
    expect(describeShipping({ weightGrams: 0 })).toBe("0 g");
    expect(describeShipping(null)).toBe("");
    expect(describeShipping({})).toBe("");
  });
  it("totals physical lines and counts the ones with no weight", () => {
    expect(parcelWeight([
      { quantity: 2, shippingSnapshot: { weightGrams: 250 } },
      { quantity: 1, shippingSnapshot: { weightGrams: 1000 } },
      { quantity: 3, shippingSnapshot: null },
      { quantity: 1, fulfillmentType: "DIGITAL", shippingSnapshot: null },
    ])).toEqual({ grams: 1500, missing: 1, physical: 3 });
    expect(parcelWeight([{ quantity: 1, fulfilmentType: "DIGITAL" }])).toEqual({ grams: 0, missing: 0, physical: 0 });
  });
});

describe("countries", () => {
  it("lists unique two-letter codes with readable names", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
    const options = countryOptions();
    expect(options.find((option) => option.code === "IN")?.name).toBe("India");
    expect(options.map((option) => option.name)).toEqual([...options.map((option) => option.name)].sort((a, b) => a.localeCompare(b)));
  });
});
