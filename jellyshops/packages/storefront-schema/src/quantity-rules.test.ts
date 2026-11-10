import { describe, expect, it } from "vitest";
import { allowedQuantity, hasQuantityRule, quantityProblem, quantityRuleProblems, quantityRuleText, readQuantityRule } from "./quantity-rules";

describe("quantity rules", () => {
  it("reads a stored rule, treating anything missing or malformed as no rule", () => {
    expect(readQuantityRule(null)).toEqual({ min: 1, step: 1 });
    expect(readQuantityRule({ step: 6 })).toEqual({ min: 6, step: 6 });
    expect(readQuantityRule({ min: 12, step: 6, max: 48 })).toEqual({ min: 12, step: 6, max: 48 });
    expect(readQuantityRule({ min: "3", step: 0, max: 2.5 })).toEqual({ min: 1, step: 1 });
    expect(hasQuantityRule(readQuantityRule(null))).toBe(false);
  });

  it("finds problems in a merchant's rule", () => {
    expect(quantityRuleProblems({ min: 6, step: 6, max: 48 })).toEqual([]);
    expect(quantityRuleProblems({ min: 4, step: 6 })).toEqual(["The minimum must be a multiple of the step (6)."]);
    expect(quantityRuleProblems({ min: 6, step: 6, max: 3 })).toEqual(["The most per order must be a multiple of the step (6).", "The most per order can't be less than the minimum."]);
    expect(quantityRuleProblems({ min: 0, step: 1 })).toHaveLength(1);
  });

  it("explains why a quantity is not allowed", () => {
    const rule = { min: 12, step: 6, max: 48 };
    expect(quantityProblem(rule, 12)).toBeUndefined();
    expect(quantityProblem(rule, 6, "Glass tumbler")).toBe("Glass tumbler has a minimum order of 12.");
    expect(quantityProblem(rule, 13)).toBe("This product is sold in steps of 6.");
    expect(quantityProblem(rule, 54)).toBe("You can buy at most 48 of this product.");
  });

  it("snaps to the nearest allowed quantity within the stock left", () => {
    const rule = { min: 6, step: 6 };
    expect(allowedQuantity(rule, 1)).toBe(6);
    expect(allowedQuantity(rule, 8)).toBe(6);
    expect(allowedQuantity(rule, 10)).toBe(12);
    expect(allowedQuantity(rule, 40, 20)).toBe(18);
    expect(allowedQuantity(rule, 6, 5)).toBeUndefined();
    expect(allowedQuantity({ min: 1, step: 1, max: 3 }, 9)).toBe(3);
  });

  it("describes the rule in plain words", () => {
    expect(quantityRuleText({ min: 1, step: 1 })).toBe("");
    expect(quantityRuleText({ min: 6, step: 6 })).toBe("Sold in steps of 6");
    expect(quantityRuleText({ min: 12, step: 6, max: 48 })).toBe("Minimum 12 · in steps of 6 · at most 48");
    expect(quantityRuleText({ min: 3, step: 1 })).toBe("Minimum 3");
  });
});
