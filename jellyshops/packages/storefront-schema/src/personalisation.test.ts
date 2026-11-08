import { describe, expect, it } from "vitest";
import { cleanPersonalisationValue, normalisePersonalisation, personalisationKey, personalisationPriceMinor, readPersonalisationFields, validatePersonalisation } from "./personalisation";

const fields = readPersonalisationFields([
  { id: "engraving", label: "Engraving", required: true, maxLength: 12, priceAdjustmentMinor: 500 },
  { id: "note", label: "Gift message", required: false, maxLength: 200, multiline: true },
  { id: "engraving", label: "Duplicate" },
  { label: "No id" },
  "junk",
]);

describe("personalisation", () => {
  it("reads only well-formed fields, once each", () => {
    expect(fields.map((field) => field.id)).toEqual(["engraving", "note"]);
    expect(readPersonalisationFields([{ id: "x", label: "X", maxLength: 9999 }])[0].maxLength).toBe(500);
  });

  it("cleans text: one line for short fields, kept line breaks for long ones", () => {
    expect(cleanPersonalisationValue("  A\u0000B\t C  ")).toBe("A B C");
    expect(cleanPersonalisationValue("Dear Sam,\r\n\r\n\r\n\r\nLove\u0007", true)).toBe("Dear Sam,\n\nLove");
  });

  it("asks for required fields, refuses unknown fields and text that is too long", () => {
    expect(validatePersonalisation(fields, []).map((problem) => problem.code)).toEqual(["required"]);
    expect(validatePersonalisation(fields, [{ fieldId: "engraving", value: "   " }]).map((problem) => problem.code)).toEqual(["required"]);
    expect(validatePersonalisation(fields, [{ fieldId: "engraving", value: "A".repeat(13) }])[0]).toMatchObject({ code: "too_long", message: "Engraving can be at most 12 characters." });
    expect(validatePersonalisation(fields, [{ fieldId: "engraving", value: "AB" }, { fieldId: "other", value: "x" }]).map((problem) => problem.code)).toEqual(["unknown_field"]);
    expect(validatePersonalisation(fields, [{ fieldId: "engraving", value: "AB" }])).toEqual([]);
  });

  it("prices filled-in fields and keys lines by their text without showing it", () => {
    const entries = normalisePersonalisation(fields, [{ fieldId: "note", value: "  Happy birthday " }, { fieldId: "engraving", value: "SAM" }]);
    expect(entries).toEqual([{ fieldId: "engraving", value: "SAM" }, { fieldId: "note", value: "Happy birthday" }]);
    expect(personalisationPriceMinor(fields, entries)).toBe(500);
    const key = personalisationKey(entries);
    expect(key).toMatch(/^p:[0-9a-f]{8}$/);
    expect(key).not.toContain("SAM");
    expect(personalisationKey([...entries].reverse())).toBe(key);
    expect(personalisationKey([{ fieldId: "engraving", value: "SAL" }])).not.toBe(key);
    expect(personalisationKey([])).toBe("");
  });
});
