import { describe, expect, it } from "vitest";
import { buildRules, emptyRuleForm, isoToLocalInput, isValidKey, keyFromName, localInputToIso, moneyToText, ruleKinds, sameValue, textToMoney, textToNumber, typeLabel } from "./values";

describe("keys and labels", () => {
  it("makes a key from a name", () => {
    expect(keyFromName("Care guide")).toBe("care_guide");
    expect(keyFromName("  Fabric & weave! ")).toBe("fabric_weave");
    expect(keyFromName("100% cotton")).toBe("f_100_cotton");
    expect(keyFromName("***")).toBe("");
    expect(keyFromName("x".repeat(100))).toHaveLength(64);
    expect(isValidKey(keyFromName("Care guide"))).toBe(true);
    expect(isValidKey("Care")).toBe(false);
    expect(isValidKey("1abc")).toBe(false);
    expect(isValidKey("a".repeat(65))).toBe(false);
  });
  it("names types and lists in plain language", () => {
    expect(typeLabel("integer")).toBe("Whole number");
    expect(typeLabel("list:url")).toBe("List of web link");
    expect(typeLabel("mystery")).toBe("mystery");
  });
  it("compares values the way they are stored", () => {
    expect(sameValue(undefined, null)).toBe(true);
    expect(sameValue(["a"], ["a"])).toBe(true);
    expect(sameValue({ amountMinor: 1, currency: "GBP" }, { amountMinor: 2, currency: "GBP" })).toBe(false);
  });
});

describe("rules", () => {
  it("offers only the rules that fit the type", () => {
    expect(ruleKinds("string")).toEqual(["length", "choices"]);
    expect(ruleKinds("text")).toEqual(["length"]);
    expect(ruleKinds("integer")).toEqual(["range"]);
    expect(ruleKinds("date")).toEqual(["dates"]);
    expect(ruleKinds("list:string")).toEqual(["length", "choices", "items"]);
    expect(ruleKinds("boolean")).toEqual([]);
    expect(ruleKinds("color")).toEqual([]);
  });

  it("builds the rules the API expects, leaving blanks out", () => {
    expect(buildRules("string", emptyRuleForm)).toEqual({});
    expect(buildRules("string", { ...emptyRuleForm, minLength: "2", maxLength: "20", choices: "Cotton\nLinen, Wool\n" }).rules).toEqual({ minLength: 2, maxLength: 20, choices: ["Cotton", "Linen", "Wool"] });
    expect(buildRules("integer", { ...emptyRuleForm, min: "1", max: "5" }).rules).toEqual({ min: 1, max: 5 });
    expect(buildRules("decimal", { ...emptyRuleForm, min: "0.5" }).rules).toEqual({ min: 0.5 });
    expect(buildRules("date", { ...emptyRuleForm, min: "2026-01-01", max: "2026-12-31" }).rules).toEqual({ min: "2026-01-01", max: "2026-12-31" });
    expect(buildRules("list:integer", { ...emptyRuleForm, min: "1", minItems: "1", maxItems: "3" }).rules).toEqual({ min: 1, minItems: 1, maxItems: 3 });
  });

  it("explains rules that cannot work", () => {
    expect(buildRules("string", { ...emptyRuleForm, minLength: "x" }).error).toMatch(/shortest length/);
    expect(buildRules("string", { ...emptyRuleForm, minLength: "9", maxLength: "3" }).error).toMatch(/cannot be longer/);
    expect(buildRules("string", { ...emptyRuleForm, choices: "A\nA" }).error).toMatch(/only be listed once/);
    expect(buildRules("integer", { ...emptyRuleForm, min: "1.5" }).error).toMatch(/whole number/);
    expect(buildRules("integer", { ...emptyRuleForm, min: "9", max: "1" }).error).toMatch(/cannot be higher/);
    expect(buildRules("date", { ...emptyRuleForm, min: "2026-12-31", max: "2026-01-01" }).error).toMatch(/cannot be after/);
    expect(buildRules("list:string", { ...emptyRuleForm, minItems: "3", maxItems: "1" }).error).toMatch(/cannot be more/);
  });
});

describe("typed values", () => {
  it("reads numbers, with blank meaning no value and nonsense meaning invalid", () => {
    expect(textToNumber("42", true)).toBe(42);
    expect(textToNumber("-7", true)).toBe(-7);
    expect(textToNumber("", true)).toBeNull();
    expect(textToNumber("4.5", true)).toBeUndefined();
    expect(textToNumber("abc", true)).toBeUndefined();
    expect(textToNumber("4.5", false)).toBe(4.5);
    expect(textToNumber("4,5", false)).toBe(4.5);
    expect(textToNumber("4.", false)).toBeUndefined();
    expect(textToNumber("1e5", false)).toBeUndefined();
  });

  it("reads money in the store's currency as whole minor units", () => {
    expect(textToMoney("19.99", "GBP")).toEqual({ amountMinor: 1999, currency: "GBP" });
    expect(textToMoney("", "GBP")).toBeNull();
    expect(textToMoney("-1", "GBP")).toBeUndefined();
    expect(textToMoney("abc", "GBP")).toBeUndefined();
    expect(moneyToText({ amountMinor: 1999, currency: "GBP" })).toBe("19.99");
    expect(moneyToText(null)).toBe("");
  });

  it("converts between the browser's date-time input and an ISO time", () => {
    const iso = localInputToIso("2026-10-28T09:30");
    // Read in the viewer's own time zone, whatever that is.
    expect(iso).toBe(new Date("2026-10-28T09:30").toISOString());
    expect(isoToLocalInput(iso)).toBe("2026-10-28T09:30");
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("28/10/2026 09:30")).toBeNull();
    expect(isoToLocalInput("not a date")).toBe("");
    expect(isoToLocalInput(null)).toBe("");
  });
});
