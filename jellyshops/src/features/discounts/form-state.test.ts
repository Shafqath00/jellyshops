import { describe, expect, it } from "vitest";
import type { MerchantDiscount } from "./api";
import { blankDraft, draftFromChoice, draftFromDiscount, draftToInput, draftWarnings, fieldForPath, parseMoney, utcToZoned, zonedToUtc } from "./form-state";
import { findTemplate } from "./templates";

const now = new Date("2026-11-27T10:00:00Z");
const tz = "Europe/London";

describe("time zones", () => {
  it("reads wall-clock times in the shop's zone, summer time included", () => {
    expect(zonedToUtc("2026-12-01", "09:00", tz)?.toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(zonedToUtc("2026-07-01", "09:00", tz)?.toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "09:00", "Asia/Kolkata")?.toISOString()).toBe("2026-12-01T03:30:00.000Z");
    expect(zonedToUtc("not a date", "09:00", tz)).toBeNull();
    expect(utcToZoned("2026-07-01T08:00:00Z", tz)).toEqual({ date: "2026-07-01", time: "09:00" });
  });
});

describe("money", () => {
  it("reads amounts as typed", () => {
    expect(parseMoney("5")).toBe(500);
    expect(parseMoney("£5.50")).toBe(550);
    expect(parseMoney("1,200")).toBe(120000);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("5.555")).toBeNaN();
  });
});

describe("draft to input", () => {
  it("builds an amount off products for a collection", () => {
    const draft = { ...blankDraft("product_amount", "code", tz, now), code: " summer20 ", percent: "20", appliesTo: { scope: "collections" as const, productIds: [], collectionIds: ["c1"] }, minimumType: "amount" as const, minimumAmount: "50", hasEnd: true, endDate: "2026-12-31", endTime: "23:59" };
    const { input, problems } = draftToInput(draft, tz);
    expect(problems).toEqual({});
    expect(input).toMatchObject({ method: "code", code: "SUMMER20", type: "product_amount", valueType: "percent", value: 20, appliesTo: { scope: "collections", collectionIds: ["c1"] }, minimum: { type: "amount", amountMinor: 5000 }, startsAt: "2026-11-27T10:00:00.000Z", endsAt: "2026-12-31T23:59:00.000Z" });
  });

  it("names every problem by field", () => {
    const draft = { ...blankDraft("product_amount", "automatic", tz, now), appliesTo: { scope: "collections" as const, productIds: [], collectionIds: [] }, percent: "150", minimumType: "amount" as const, minimumAmount: "abc", limitTotal: true, usageLimit: "0", hasEnd: true, endDate: "2026-11-01", endTime: "00:00" };
    const { input, problems } = draftToInput(draft, tz);
    expect(input).toBeUndefined();
    expect(problems).toMatchObject({
      title: "Give the discount a title. Customers see it in their bag and at checkout.",
      value: "Enter a whole percentage from 1 to 100.",
      appliesTo: "Choose at least one collection.",
      minimum: "Enter the minimum amount like 5 or 5.50.",
      usageLimit: "Enter the total number of uses as a whole number, 1 or more.",
      endsAt: "The end must be after the start.",
    });
  });

  it("starts from values that can be saved as they are", () => {
    for (const type of ["product_amount", "order_amount", "buy_x_get_y", "free_shipping"] as const) {
      expect(draftToInput({ ...blankDraft(type, "code", tz, now), code: "START" }, tz).problems).toEqual({});
      expect(draftToInput({ ...blankDraft(type, "automatic", tz, now), title: "Sale" }, tz).problems).toEqual({});
    }
  });

  it("builds buy X get Y and free shipping", () => {
    const bogo = { ...blankDraft("buy_x_get_y", "code", tz, now), code: "BOGO", buysItems: { scope: "products" as const, productIds: ["mug"], collectionIds: [] }, getsItems: { scope: "products" as const, productIds: ["mug"], collectionIds: [] } };
    expect(draftToInput(bogo, tz).input).toMatchObject({ buyXGetY: { buys: { type: "quantity", quantity: 1 }, getsQuantity: 1, getsValue: { type: "free" }, maxUsesPerOrder: 1 }, minimum: { type: "none" } });
    expect(draftToInput({ ...bogo, buysItems: { scope: "products", productIds: [], collectionIds: [] } }, tz).problems.buysItems).toBe("Choose at least one product.");
    const ship = { ...blankDraft("free_shipping", "automatic", tz, now), title: "Free delivery", limitShipping: true, maxShipping: "6.95" };
    expect(draftToInput(ship, tz).input).toMatchObject({ type: "free_shipping", maxShippingMinor: 695, combinesWith: { product: true, order: true, shipping: false } });
  });

  it("maps server problem paths to fields", () => {
    expect(fieldForPath("buyXGetY.buys.amountMinor")).toBe("buysAmount");
    expect(fieldForPath("appliesTo.productIds")).toBe("appliesTo");
    expect(fieldForPath("eligibility.emails.2")).toBe("eligibility");
    expect(fieldForPath("somethingElse")).toBe("form");
  });
});

describe("drafts from templates and saved discounts", () => {
  it("fills the form from a template", () => {
    const template = findTemplate("first-order-10")!;
    const draft = draftFromChoice({ type: template.type, method: "code", template }, tz, now);
    expect(draft).toMatchObject({ code: "WELCOME10", title: "10% off your first order", percent: "10", eligibility: "first_order", oncePerCustomer: true });
    expect(draftToInput(draft, tz).problems).toEqual({});
  });

  it("round-trips a saved discount", () => {
    const saved = {
      id: "d1", title: "Summer", method: "code", code: "SUMMER", type: "order_amount", valueType: "fixed", value: 1050,
      appliesTo: { scope: "all", productIds: [], collectionIds: [] }, appliesOncePerOrder: false, minimum: { type: "quantity", quantity: 3 },
      eligibility: { scope: "tags", tags: ["vip"] }, combinesWith: { product: true, order: false, shipping: true }, maxShippingMinor: null, buyXGetY: null,
      usageLimit: 50, oncePerCustomer: true, startsAt: "2026-12-01T09:00:00Z", endsAt: "2027-01-01T00:00:00Z", active: false,
      createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z", status: "disabled", uses: 0, codeCount: 1, paidOrders: 0, salesMinor: 0, givenMinor: 0,
    } as MerchantDiscount;
    const draft = draftFromDiscount(saved, tz);
    expect(draft).toMatchObject({ amount: "10.50", minimumType: "quantity", minimumQuantity: "3", tags: ["vip"], usageLimit: "50", startDate: "2026-12-01", startTime: "09:00", endDate: "2027-01-01", endTime: "00:00", active: false });
    expect(draftToInput(draft, tz).input).toMatchObject({ value: 1050, startsAt: saved.startsAt!.replace("Z", ".000Z"), endsAt: "2027-01-01T00:00:00.000Z", usageLimit: 50 });
  });
});

describe("warnings", () => {
  const other = { id: "a1", title: "Winter sale", method: "automatic", type: "order_amount", combinesWith: { product: false, order: false, shipping: false }, status: "active", startsAt: null, endsAt: null } as unknown as MerchantDiscount;
  it("points out an ended discount, an overlapping automatic one, products not on sale and 100% off", () => {
    const draft = { ...blankDraft("product_amount", "code", tz, now), percent: "100", appliesTo: { scope: "products" as const, productIds: ["p1", "p2"], collectionIds: [] }, hasEnd: true, endDate: "2026-11-27", endTime: "09:00", startDate: "2026-11-01" };
    const ids = draftWarnings(draft, { timeZone: tz, now, others: [other], products: { p1: { title: "Mug", active: false }, p2: { title: "Vase", active: true } }, codeTaken: true }).map((warning) => warning.id);
    expect(ids).toEqual(["ended", "code", "free", "some-products", "overlap"]);
  });
  it("says nothing about discounts that combine or run at another time", () => {
    const draft = { ...blankDraft("free_shipping", "automatic", tz, now) };
    const combining = { ...other, combinesWith: { product: false, order: false, shipping: true } };
    const later = { ...other, startsAt: "2027-03-01T00:00:00Z" };
    expect(draftWarnings({ ...draft, hasEnd: true, endDate: "2027-01-01", endTime: "00:00" }, { timeZone: tz, now, others: [combining, later] })).toEqual([]);
  });
});
