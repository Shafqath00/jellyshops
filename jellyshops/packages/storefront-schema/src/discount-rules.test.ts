import { describe, expect, it } from "vitest";
import {
  ALL_ITEMS, allocateAmount, buyXGetYAmounts, calculateDiscounts, discountStatus, generateDiscountCode, summariseDiscount,
  type DiscountCandidate, type DiscountCart, type DiscountCustomer, type DiscountDefinition,
} from "./discount-rules.js";
import { validateDiscountInput } from "./discounts.js";

const gbp = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
const now = new Date("2026-12-10T12:00:00Z");
const options = { now, formatMoney: gbp };
const guest: DiscountCustomer = { email: "sam@example.test", tags: [], previousOrders: 0 };

let seq = 0;
function discount(overrides: Partial<DiscountDefinition> = {}): DiscountDefinition {
  seq += 1;
  return {
    id: `d${seq}`, title: `Discount ${seq}`, method: "code", code: `CODE${seq}`, type: "order_amount", valueType: "percent", value: 10,
    appliesTo: ALL_ITEMS, appliesOncePerOrder: false, minimum: { type: "none" }, eligibility: { scope: "everyone" },
    combinesWith: { product: false, order: false, shipping: false }, maxShippingMinor: null, buyXGetY: null,
    usageLimit: null, oncePerCustomer: false, startsAt: null, endsAt: null, active: true,
    createdAt: new Date(Date.UTC(2026, 0, seq)), ...overrides,
  };
}
const typed = (d: DiscountDefinition, uses = 0, usesByCustomer = 0): DiscountCandidate => ({ discount: d, code: d.code, uses, usesByCustomer });
const auto = (d: DiscountDefinition): DiscountCandidate => ({ discount: { ...d, method: "automatic", code: null }, code: null, uses: 0, usesByCustomer: 0 });

const cart: DiscountCart = {
  lines: [
    { key: "shirt", productId: "p-shirt", collectionIds: ["summer"], unitPriceMinor: 2000, quantity: 2 },
    { key: "hat", productId: "p-hat", collectionIds: ["summer", "hats"], unitPriceMinor: 1500, quantity: 1 },
    { key: "mug", productId: "p-mug", collectionIds: [], unitPriceMinor: 999, quantity: 1 },
  ],
  shippingMinor: 495, hasDelivery: true,
};
// Subtotal 6499.

describe("amount off order", () => {
  it("takes a percentage off and spreads it across lines exactly", () => {
    const result = calculateDiscounts(cart, [typed(discount({ value: 10 }))], guest, options);
    expect(result.discountMinor).toBe(650); // 649.9 rounds to 650
    expect(Object.values(result.lineDiscounts).reduce((a, b) => a + b, 0)).toBe(650);
    expect(result.totalMinor).toBe(6499 - 650 + 495);
  });
  it("never takes more than the order is worth", () => {
    const result = calculateDiscounts(cart, [typed(discount({ valueType: "fixed", value: 100_000 }))], guest, options);
    expect(result.discountMinor).toBe(6499);
    expect(result.totalMinor).toBe(495);
  });
  it("checks the minimum spend and says how much", () => {
    const result = calculateDiscounts(cart, [typed(discount({ minimum: { type: "amount", amountMinor: 7000 } }))], guest, options);
    expect(result.applied).toEqual([]);
    expect(result.problems[0]!.message).toBe("Spend £70.00 or more to use this code.");
  });
  it("checks a minimum number of items", () => {
    const result = calculateDiscounts(cart, [typed(discount({ minimum: { type: "quantity", quantity: 5 } }))], guest, options);
    expect(result.problems[0]!.message).toBe("Add 5 or more items to use this code.");
    expect(calculateDiscounts(cart, [typed(discount({ minimum: { type: "quantity", quantity: 4 } }))], guest, options).discountMinor).toBe(650);
  });
});

describe("amount off products", () => {
  it("only discounts the chosen collection", () => {
    const result = calculateDiscounts(cart, [typed(discount({ type: "product_amount", value: 20, appliesTo: { scope: "collections", productIds: [], collectionIds: ["hats"] } }))], guest, options);
    expect(result.lineDiscounts).toEqual({ hat: 300 });
  });
  it("takes a fixed amount off each item, never below free", () => {
    const result = calculateDiscounts(cart, [typed(discount({ type: "product_amount", valueType: "fixed", value: 1200, appliesTo: { scope: "products", productIds: ["p-shirt", "p-mug"], collectionIds: [] } }))], guest, options);
    expect(result.lineDiscounts).toEqual({ shirt: 2400, mug: 999 });
  });
  it("can take a fixed amount once per order, shared by value", () => {
    const result = calculateDiscounts(cart, [typed(discount({ type: "product_amount", valueType: "fixed", value: 1000, appliesOncePerOrder: true, appliesTo: { scope: "collections", productIds: [], collectionIds: ["summer"] } }))], guest, options);
    expect(result.discountMinor).toBe(1000);
    expect(result.lineDiscounts.shirt! + result.lineDiscounts.hat!).toBe(1000);
  });
  it("says when nothing in the bag is covered", () => {
    const result = calculateDiscounts(cart, [typed(discount({ type: "product_amount", appliesTo: { scope: "products", productIds: ["p-other"], collectionIds: [] } }))], guest, options);
    expect(result.problems[0]!.message).toBe("This code doesn't apply to anything in your bag.");
  });
  it("counts the minimum only on the covered items", () => {
    const d = discount({ type: "product_amount", minimum: { type: "amount", amountMinor: 2000 }, appliesTo: { scope: "collections", productIds: [], collectionIds: ["hats"] } });
    expect(calculateDiscounts(cart, [typed(d)], guest, options).problems[0]!.message).toBe("Spend £20.00 or more on the items this code covers to use it.");
  });
});

describe("buy X get Y", () => {
  const lines = [
    { key: "a", productId: "a", collectionIds: ["socks"], unitPriceMinor: 800, quantity: 2 },
    { key: "b", productId: "b", collectionIds: ["socks"], unitPriceMinor: 500, quantity: 2 },
  ];
  const socks = { scope: "collections" as const, productIds: [], collectionIds: ["socks"] };
  it("buy 1 get 1 free gives away the cheaper items", () => {
    expect(buyXGetYAmounts({ buys: { type: "quantity", quantity: 1 }, buysItems: socks, getsQuantity: 1, getsItems: socks, getsValue: { type: "free" }, maxUsesPerOrder: null }, lines)).toEqual({ b: 1000 });
  });
  it("respects uses per order", () => {
    expect(buyXGetYAmounts({ buys: { type: "quantity", quantity: 1 }, buysItems: socks, getsQuantity: 1, getsItems: socks, getsValue: { type: "free" }, maxUsesPerOrder: 1 }, lines)).toEqual({ b: 500 });
  });
  it("buy 2 get 1 at half price", () => {
    expect(buyXGetYAmounts({ buys: { type: "quantity", quantity: 2 }, buysItems: socks, getsQuantity: 1, getsItems: socks, getsValue: { type: "percent", percent: 50 }, maxUsesPerOrder: null }, lines)).toEqual({ b: 250 });
  });
  it("needs the bought items before giving anything", () => {
    const rule = { buys: { type: "quantity" as const, quantity: 3 }, buysItems: socks, getsQuantity: 2, getsItems: socks, getsValue: { type: "free" as const }, maxUsesPerOrder: null };
    expect(buyXGetYAmounts(rule, lines.slice(0, 1))).toEqual({});
    const result = calculateDiscounts({ lines: lines.slice(0, 1), shippingMinor: 0, hasDelivery: false }, [typed(discount({ type: "buy_x_get_y", valueType: null, value: 0, buyXGetY: rule }))], guest, options);
    expect(result.problems[0]!.message).toBe("Add 3 qualifying items and the item you get to use this code.");
  });
  it("spend £20, get a mug free (the mug doesn't count towards the spend)", () => {
    const rule = { buys: { type: "amount" as const, amountMinor: 2000 }, buysItems: ALL_ITEMS, getsQuantity: 1, getsItems: { scope: "products" as const, productIds: ["p-mug"], collectionIds: [] }, getsValue: { type: "free" as const }, maxUsesPerOrder: null };
    expect(buyXGetYAmounts(rule, cart.lines)).toEqual({ mug: 999 });
    expect(buyXGetYAmounts(rule, [cart.lines[2]!, { ...cart.lines[1]!, unitPriceMinor: 1500 }])).toEqual({});
  });
});

describe("free shipping", () => {
  it("makes delivery free", () => {
    const result = calculateDiscounts(cart, [typed(discount({ type: "free_shipping", valueType: null, value: 0 }))], guest, options);
    expect(result).toMatchObject({ shippingMinor: 0, discountMinor: 0, totalMinor: 6499 });
    expect(result.applied[0]!.shippingMinor).toBe(495);
  });
  it("won't cover a charge above its limit or a bag with nothing to deliver", () => {
    const capped = discount({ type: "free_shipping", valueType: null, value: 0, maxShippingMinor: 400 });
    expect(calculateDiscounts(cart, [typed(capped)], guest, options).problems[0]!.message).toBe("This code doesn't cover this delivery charge.");
    expect(calculateDiscounts({ ...cart, hasDelivery: false }, [typed(discount({ type: "free_shipping", valueType: null, value: 0 }))], guest, options).problems[0]!.message).toBe("There's nothing to pay for delivery in this order.");
  });
});

describe("limits, dates and who can use it", () => {
  it("explains expired, used-up, not started and switched-off codes", () => {
    const message = (d: DiscountDefinition, uses = 0) => calculateDiscounts(cart, [typed(d, uses)], guest, options).problems[0]?.message;
    expect(message(discount({ endsAt: new Date("2026-12-01") }))).toBe("This code has expired.");
    expect(message(discount({ usageLimit: 3 }), 3)).toBe("This code has been used up.");
    expect(message(discount({ startsAt: new Date("2027-01-01") }))).toBe("This code isn't valid.");
    expect(message(discount({ active: false }))).toBe("This code isn't valid.");
  });
  it("allows one use per customer", () => {
    const d = discount({ oncePerCustomer: true });
    expect(calculateDiscounts(cart, [typed(d, 4, 1)], guest, options).problems[0]!.message).toBe("You've already used this code.");
    expect(calculateDiscounts(cart, [typed(d, 4, 0)], { ...guest, email: null }, options).problems[0]!.message).toBe("Enter your email address first to use this code.");
  });
  it("checks first orders, tags and chosen customers", () => {
    expect(calculateDiscounts(cart, [typed(discount({ eligibility: { scope: "first_order" } }))], { ...guest, previousOrders: 1 }, options).problems[0]!.message).toBe("This code is for first orders only.");
    expect(calculateDiscounts(cart, [typed(discount({ eligibility: { scope: "tags", tags: ["VIP"] } }))], { ...guest, tags: ["vip"] }, options).discountMinor).toBe(650);
    expect(calculateDiscounts(cart, [typed(discount({ eligibility: { scope: "customers", emails: ["other@example.test"] } }))], guest, options).problems[0]!.message).toBe("This code isn't available for your account.");
  });
  it("works out the state for the list", () => {
    expect(discountStatus(discount(), 0, now)).toBe("active");
    expect(discountStatus(discount({ startsAt: new Date("2027-01-01") }), 0, now)).toBe("scheduled");
    expect(discountStatus(discount({ endsAt: new Date("2026-12-01") }), 0, now)).toBe("expired");
    expect(discountStatus(discount({ usageLimit: 1 }), 1, now)).toBe("used_up");
    expect(discountStatus(discount({ active: false }), 0, now)).toBe("disabled");
  });
});

describe("combining", () => {
  const productTen = () => discount({ type: "product_amount", value: 10 });
  it("an automatic and a code that don't combine: the shopper gets whichever saves more, and is told why", () => {
    const small = typed(discount({ value: 5, title: "Five off" }));
    const big = auto(discount({ value: 20, title: "Winter sale" }));
    const result = calculateDiscounts(cart, [small, big], guest, options);
    expect(result.applied.map((a) => a.title)).toEqual(["Winter sale"]);
    expect(result.problems[0]!.message).toBe('This code can\'t be used with "Winter sale", which saves you more.');
  });
  it("stacks when both allow it: product first, then order on what is left, then shipping", () => {
    const product = { ...productTen(), combinesWith: { product: false, order: true, shipping: true } };
    const order = discount({ valueType: "fixed", value: 1000, combinesWith: { product: true, order: false, shipping: true } });
    const ship = discount({ type: "free_shipping", valueType: null, value: 0, combinesWith: { product: true, order: true, shipping: false } });
    const result = calculateDiscounts(cart, [typed(product), auto(order), auto(ship)], guest, options);
    expect(result.applied.map((a) => a.type)).toEqual(["product_amount", "order_amount", "free_shipping"]);
    expect(result.discountMinor).toBe(650 + 1000);
    expect(result.shippingMinor).toBe(0);
    expect(result.totalMinor).toBe(6499 - 1650);
  });
  it("one-way permission is not enough", () => {
    const product = { ...productTen(), combinesWith: { product: false, order: true, shipping: false } };
    const order = discount({ value: 10, combinesWith: { product: false, order: false, shipping: false } });
    expect(calculateDiscounts(cart, [auto(product), auto(order)], guest, options).applied).toHaveLength(1);
  });
  it("two product discounts never stack on the same line: the larger one wins it", () => {
    const all = { ...discount({ type: "product_amount", value: 10 }), combinesWith: { product: true, order: false, shipping: false } };
    const hats = { ...discount({ type: "product_amount", value: 50, appliesTo: { scope: "collections" as const, productIds: [], collectionIds: ["hats"] } }), combinesWith: { product: true, order: false, shipping: false } };
    const result = calculateDiscounts(cart, [auto(all), auto(hats)], guest, options);
    expect(result.lineDiscounts).toEqual({ shirt: 400, hat: 750, mug: 100 });
  });
  it("is deterministic: equal savings go to the older discount", () => {
    const first = auto(discount({ value: 10, title: "First" }));
    const second = auto(discount({ value: 10, title: "Second" }));
    expect(calculateDiscounts(cart, [second, first], guest, options).applied[0]!.title).toBe("First");
    expect(calculateDiscounts(cart, [first, second], guest, options).applied[0]!.title).toBe("First");
  });
  it("applies the minimum of an order discount after product discounts", () => {
    const product = { ...discount({ type: "product_amount", value: 50 }), combinesWith: { product: false, order: true, shipping: false } };
    const order = { ...discount({ valueType: "fixed", value: 500, minimum: { type: "amount", amountMinor: 5000 } }), combinesWith: { product: true, order: false, shipping: false } };
    const result = calculateDiscounts(cart, [auto(product), auto(order)], guest, options);
    // Half off leaves 3249, under the £50 minimum, so only the larger product discount applies.
    expect(result.applied.map((a) => a.type)).toEqual(["product_amount"]);
  });
});

describe("helpers", () => {
  it("allocates with no pennies lost", () => {
    expect(allocateAmount([333, 333, 334], 100)).toEqual([33, 33, 34]);
    expect(allocateAmount([1, 1, 1], 2).reduce((a, b) => a + b)).toBe(2);
  });
  it("generates readable codes", () => {
    let n = 0;
    const code = generateDiscountCode(() => (n++ % 32) / 32, 8, "vip-");
    expect(code).toMatch(/^VIP-[A-Z2-9]{8}$/);
    expect(code.slice(4)).not.toMatch(/[01OI]/);
  });
  it("summarises a discount in one sentence", () => {
    const d = discount({ type: "product_amount", value: 20, appliesTo: { scope: "collections", productIds: [], collectionIds: ["summer"] }, minimum: { type: "amount", amountMinor: 5000 }, startsAt: new Date("2026-12-01T00:00:00Z"), endsAt: new Date("2027-01-01T00:00:00Z"), usageLimit: 100, code: "SUMMER20" });
    expect(summariseDiscount(d, { formatMoney: gbp, timeZone: "Europe/London", names: { collections: { summer: "Summer Collection" } } }))
      .toBe("20% off products in Summer Collection, when the customer spends at least £50.00 on those items, from 1 Dec to 31 Dec 2026, limited to 100 uses, with code SUMMER20");
    expect(summariseDiscount(discount({ type: "free_shipping", valueType: null, value: 0, method: "automatic", code: null, minimum: { type: "amount", amountMinor: 5000 } }), { formatMoney: gbp, timeZone: "Europe/London" }))
      .toBe("Free shipping, when the customer spends at least £50.00, applied automatically");
    expect(summariseDiscount(discount({ type: "buy_x_get_y", valueType: null, value: 0, method: "automatic", buyXGetY: { buys: { type: "quantity", quantity: 1 }, buysItems: ALL_ITEMS, getsQuantity: 1, getsItems: ALL_ITEMS, getsValue: { type: "free" }, maxUsesPerOrder: null } }), { formatMoney: gbp, timeZone: "UTC" }))
      .toBe("Buy 1 item, get 1 more free, applied automatically");
  });
});

describe("save-time checks", () => {
  it("accepts a code discount and normalises it", () => {
    const result = validateDiscountInput({ method: "code", code: " summer20 ", type: "order_amount", valueType: "percent", value: 20 });
    expect(result).toMatchObject({ ok: true, value: { code: "SUMMER20", title: "SUMMER20", appliesTo: ALL_ITEMS } });
  });
  it("names each problem by field", () => {
    const result = validateDiscountInput({ method: "automatic", type: "product_amount", valueType: "percent", value: 150, appliesTo: { scope: "collections", productIds: [], collectionIds: [] }, startsAt: "2026-12-02", endsAt: "2026-12-01" });
    expect(result.ok).toBe(false);
    const problems = result.ok ? [] : result.problems;
    expect(problems).toEqual(expect.arrayContaining([
      { path: "title", message: "Give the discount a title. Customers see it in their bag and at checkout." },
      { path: "value", message: "Use a whole percentage from 1 to 100." },
      { path: "appliesTo.collectionIds", message: "Choose at least one collection." },
      { path: "endsAt", message: "The end must be after the start." },
    ]));
  });
  it("refuses a bad code and unknown fields", () => {
    expect(validateDiscountInput({ method: "code", code: "has space", type: "free_shipping" })).toMatchObject({ ok: false, problems: [{ path: "code" }] });
    expect(validateDiscountInput({ method: "code", code: "OK", type: "free_shipping", sneaky: 1 })).toMatchObject({ ok: false });
  });
});
