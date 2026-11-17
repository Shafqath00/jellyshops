import { describe, expect, it } from "vitest";
import { allocateDiscount, applyDiscount, describeDiscount, discountProblem, normaliseDiscountCode, type DiscountRule } from "./rules.js";

const money = (minor: number) => `£${(minor / 100).toFixed(2)}`;
const rule = (overrides: Partial<DiscountRule> = {}): DiscountRule => ({ code: "SAVE", kind: "percent", value: 10, minimumSubtotalMinor: null, usageLimit: null, oncePerCustomer: false, startsAt: null, endsAt: null, active: true, ...overrides });
const context = (overrides = {}) => ({ subtotalMinor: 5000, hasDelivery: true, uses: 0, usesByCustomer: 0, now: new Date("2026-11-18T12:00:00Z"), formatMoney: money, ...overrides });

describe("discount rules", () => {
  it("reads codes without case or spaces and refuses anything else", () => {
    expect(normaliseDiscountCode("  summer-10 ")).toBe("SUMMER-10");
    expect(normaliseDiscountCode("a")).toBeNull();
    expect(normaliseDiscountCode("two words")).toBeNull();
    expect(normaliseDiscountCode(42)).toBeNull();
  });

  it("takes a percentage or an amount off the products, never more than they cost", () => {
    expect(applyDiscount({ kind: "percent", value: 15 }, 3333, 400)).toEqual({ discountMinor: 500, shippingMinor: 400, totalMinor: 3233 });
    expect(applyDiscount({ kind: "fixed", value: 9999 }, 2000, 400)).toEqual({ discountMinor: 2000, shippingMinor: 400, totalMinor: 400 });
    expect(applyDiscount({ kind: "free_shipping", value: 0 }, 2000, 400)).toEqual({ discountMinor: 0, shippingMinor: 0, totalMinor: 2000 });
  });

  it("explains why a code can't be used", () => {
    expect(discountProblem(rule(), context())).toBeNull();
    expect(discountProblem(rule({ active: false }), context())).toBe("This code isn't valid.");
    expect(discountProblem(rule({ startsAt: new Date("2026-12-01") }), context())).toBe("This code isn't valid.");
    expect(discountProblem(rule({ endsAt: new Date("2026-11-01") }), context())).toBe("This code has expired.");
    expect(discountProblem(rule({ usageLimit: 2 }), context({ uses: 2 }))).toBe("This code has been used up.");
    expect(discountProblem(rule({ oncePerCustomer: true }), context({ usesByCustomer: 1 }))).toBe("You've already used this code.");
    expect(discountProblem(rule({ minimumSubtotalMinor: 6000 }), context())).toBe("This code needs an order of £60.00 or more.");
    expect(discountProblem(rule({ kind: "free_shipping", value: 0 }), context({ hasDelivery: false }))).toBe("There's nothing to deliver in this order.");
  });

  it("shares a discount across lines so the shares add up exactly", () => {
    expect(allocateDiscount([1000, 1000, 1000], 100).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(allocateDiscount([3000, 1000], 400)).toEqual([300, 100]);
    expect(allocateDiscount([500], 900)).toEqual([500]);
    expect(allocateDiscount([500, 500], 0)).toEqual([0, 0]);
  });

  it("describes a code in short words", () => {
    expect(describeDiscount({ kind: "percent", value: 10 }, money)).toBe("10% off");
    expect(describeDiscount({ kind: "fixed", value: 500 }, money)).toBe("£5.00 off");
    expect(describeDiscount({ kind: "free_shipping", value: 0 }, money)).toBe("Free delivery");
  });
});
