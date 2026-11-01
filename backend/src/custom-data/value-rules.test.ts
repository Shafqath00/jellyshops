import { describe, expect, it } from "vitest";
import { definitionRulesProblem, isRealDate, valueProblem } from "./value-rules.js";

describe("valueProblem", () => {
  const ok = (type: string, value: unknown, rules?: Record<string, unknown>) => expect(valueProblem(type, value, rules)).toBeNull();
  const bad = (type: string, value: unknown, rules?: Record<string, unknown>) => expect(valueProblem(type, value, rules)).toEqual(expect.any(String));

  it("checks text length, in the type's own limit and in the rules", () => {
    ok("string", "Cotton"); ok("text", "x".repeat(10_000)); ok("rich_text", "x".repeat(100_000));
    bad("string", "x".repeat(256)); bad("text", "x".repeat(10_001)); bad("string", 5); bad("text", null);
    ok("string", "ab", { minLength: 2, maxLength: 4 });
    bad("string", "a", { minLength: 2 }); bad("string", "abcde", { maxLength: 4 });
  });

  it("restricts a string to its choices", () => {
    ok("string", "Cotton", { choices: ["Cotton", "Linen"] });
    expect(valueProblem("string", "Silk", { choices: ["Cotton", "Linen"] })).toBe("Choose one of the allowed values.");
  });

  it("accepts real numbers and booleans only, within min and max", () => {
    ok("integer", 3); ok("integer", -3); ok("integer", 5, { min: 1, max: 5 });
    bad("integer", 3.5); bad("integer", "3"); bad("integer", NaN); bad("integer", 0, { min: 1 }); bad("integer", 6, { max: 5 });
    ok("decimal", 3.5); bad("decimal", Infinity); bad("decimal", "3.5"); bad("decimal", 0.5, { min: 1 });
    ok("boolean", false); bad("boolean", "true"); bad("boolean", 1);
  });

  it("accepts money as whole minor units and a three-letter currency", () => {
    ok("money", { amountMinor: 1999, currency: "GBP" });
    bad("money", { amountMinor: 19.99, currency: "GBP" }); bad("money", { amountMinor: -1, currency: "GBP" });
    bad("money", { amountMinor: 100, currency: "gbp" }); bad("money", { amountMinor: 100 }); bad("money", "19.99");
  });

  it("accepts colours as #rrggbb", () => {
    ok("color", "#1a2b3c"); ok("color", "#FFFFFF");
    bad("color", "red"); bad("color", "#fff"); bad("color", "1a2b3c"); bad("color", "#12345g");
  });

  it("accepts http and https web addresses only", () => {
    ok("url", "https://example.com/care?x=1"); ok("url", "http://example.com");
    bad("url", "javascript:alert(1)"); bad("url", "ftp://example.com"); bad("url", "example.com"); bad("url", "https://exa mple.com"); bad("url", "https://x.com/" + "a".repeat(2048));
  });

  it("accepts real dates and date-times, and applies min and max", () => {
    ok("date", "2026-10-28"); ok("date", "2028-02-29");
    bad("date", "2026-02-30"); bad("date", "2026-13-01"); bad("date", "28/10/2026"); bad("date", "2026-10-28T10:00:00Z");
    ok("date", "2026-06-01", { min: "2026-01-01", max: "2026-12-31" });
    bad("date", "2025-12-31", { min: "2026-01-01" }); bad("date", "2027-01-01", { max: "2026-12-31" });
    ok("datetime", "2026-10-28T09:30:00Z"); ok("datetime", "2026-10-28T09:30:00.250+01:00"); ok("datetime", "2026-10-28T09:30Z");
    bad("datetime", "2026-10-28T09:30:00"); bad("datetime", "2026-10-28"); bad("datetime", "2026-02-30T09:30:00Z");
    bad("datetime", "2026-10-28T09:30:00Z", { max: "2026-10-28T09:00:00Z" });
  });

  it("accepts an id for images, files and references", () => {
    for (const type of ["image", "file", "product_reference", "collection_reference", "page_reference", "metaobject_reference"]) { ok(type, "abc-123"); bad(type, ""); bad(type, 5); bad(type, "x".repeat(201)); }
  });

  it("checks every item of a list, and its size", () => {
    ok("list:string", []); ok("list:integer", [1, 2, 3]);
    bad("list:integer", [1, "2"]); bad("list:string", "a"); bad("list:string", [1]);
    expect(valueProblem("list:integer", [1, 2.5], {})).toBe("Item 2: Enter a whole number.");
    bad("list:string", ["a"], { minItems: 2 }); bad("list:string", ["a", "b", "c"], { maxItems: 2 }); ok("list:string", ["a", "b"], { minItems: 2, maxItems: 2 });
    bad("list:string", Array.from({ length: 101 }, () => "x"));
    bad("list:string", ["Silk"], { choices: ["Cotton"] });
  });

  it("refuses an unknown type", () => {
    expect(valueProblem("telepathy", "x", {})).toMatch(/not supported/);
  });
});

describe("isRealDate", () => {
  it("knows leap years", () => {
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isRealDate("2026-02-29")).toBe(false);
    expect(isRealDate("2100-02-29")).toBe(false);
  });
});

describe("definitionRulesProblem", () => {
  const problem = (type: string, rules: Record<string, unknown> | undefined) => definitionRulesProblem(type, rules);

  it("accepts no rules and sensible ones", () => {
    expect(problem("string", undefined)).toBeNull();
    expect(problem("string", {})).toBeNull();
    expect(problem("string", { minLength: 1, maxLength: 80, choices: ["A", "B"] })).toBeNull();
    expect(problem("integer", { min: 0, max: 10 })).toBeNull();
    expect(problem("date", { min: "2026-01-01", max: "2026-12-31" })).toBeNull();
    expect(problem("list:string", { minItems: 1, maxItems: 5, maxLength: 20 })).toBeNull();
    expect(problem("color", {})).toBeNull();
  });

  it("refuses rules that do not belong to the type", () => {
    expect(problem("integer", { maxLength: 5 })).toMatch(/does not apply/);
    expect(problem("string", { min: 1 })).toMatch(/does not apply/);
    expect(problem("boolean", { min: 1 })).toMatch(/does not apply/);
    expect(problem("text", { choices: ["a"] })).toMatch(/does not apply/);
    expect(problem("string", { minItems: 1 })).toMatch(/does not apply/);
    expect(problem("string", { pattern: ".*" })).toMatch(/does not apply/);
  });

  it("refuses mistyped or contradictory rules", () => {
    expect(problem("string", { maxLength: -1 })).toMatch(/whole number/);
    expect(problem("string", { maxLength: "5" })).toMatch(/whole number/);
    expect(problem("string", { minLength: 9, maxLength: 3 })).toMatch(/cannot be larger/);
    expect(problem("integer", { min: "1" })).toMatch(/must be a number/);
    expect(problem("integer", { min: 5, max: 1 })).toMatch(/cannot be larger/);
    expect(problem("date", { min: "soon" })).toMatch(/valid date/);
    expect(problem("date", { min: "2026-12-31", max: "2026-01-01" })).toMatch(/cannot be later/);
    expect(problem("list:string", { minItems: 3, maxItems: 1 })).toMatch(/cannot be larger/);
    expect(problem("string", { choices: [] })).toMatch(/choices/);
    expect(problem("string", { choices: ["a", "a"] })).toMatch(/choices/);
    expect(problem("string", { choices: [""] })).toMatch(/choices/);
    expect(problem("string", { choices: "a,b" })).toMatch(/choices/);
  });
});
