import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discountsForBag, requireBagDiscounts, resetDiscountTableCheck, type BagInput } from "../../src/discounts/checkout-discounts.js";
import { DiscountService, recordOrderDiscounts, type DiscountSql } from "../../src/discounts/service.js";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "./pglite.js";

const MIGRATIONS = [
  "20260915120000_add_stripe_connect_commerce.sql", "20260920100000_add_order_item_configuration_snapshot.sql",
  "20261020140329_store_settings_checkout.sql", "20261022000000_order_management.sql", "20261108000000_customer_profiles_order_tags.sql",
  "20261118000000_discount_codes.sql", "20261127000000_discounts_v2.sql",
];

describe("discounts on a bag at checkout (real schema)", () => {
  let database: IntegrationDatabase;
  let service: DiscountService;
  const sql = (): DiscountSql => ({ query: (text: string, values?: unknown[]) => database.query(text, values) as never });
  const bag = (extra: Partial<BagInput> = {}): BagInput => ({
    lines: [
      { variantId: "v-shirt", productId: "p-shirt", configurationKey: "", unitPriceMinor: 2000, quantity: 2 },
      { variantId: "v-hat", productId: "p-hat", configurationKey: "", unitPriceMinor: 1500, quantity: 1 },
    ],
    shippingMinor: 400, hasDelivery: true, currency: "GBP", email: "sam@example.test", ...extra,
  });

  beforeEach(async () => {
    resetDiscountTableCheck();
    database = await createPGliteDatabase();
    for (const name of MIGRATIONS) await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    await seedStore(database, "store-a", "store-a");
    // Product rows aren't needed to test which collection a line is in.
    await database.exec(`ALTER TABLE "CollectionProduct" DROP CONSTRAINT IF EXISTS "CollectionProduct_storeId_collectionId_fkey";
      ALTER TABLE "CollectionProduct" DROP CONSTRAINT IF EXISTS "CollectionProduct_storeId_productId_fkey";
      INSERT INTO "CollectionProduct" ("storeId", "collectionId", "productId") VALUES ('store-a', 'hats', 'p-hat');`);
    service = new DiscountService({ transaction: (work) => work(sql()) });
  });
  afterEach(async () => { await database?.close(); });

  it("applies an automatic discount with no code, only to the chosen collection", async () => {
    await service.create("store-a", { method: "automatic", title: "Hat week", type: "product_amount", valueType: "percent", value: 20, appliesTo: { scope: "collections", collectionIds: ["hats"] } });
    const result = await discountsForBag(sql(), "store-a", bag());
    expect(result).toMatchObject({ subtotalMinor: 5500, discountMinor: 300, shippingMinor: 400, totalMinor: 5600, code: null, codeProblem: null });
    expect(result.discounts).toEqual([expect.objectContaining({ title: "Hat week", code: null, amountMinor: 300, label: "20% off products in 1 collection" })]);
    expect(result.lineDiscounts).toEqual({ "v-hat|": 300 });
  });

  it("stacks a code with an automatic discount when both allow it", async () => {
    await service.create("store-a", { method: "automatic", title: "Hat week", type: "product_amount", valueType: "percent", value: 20, appliesTo: { scope: "collections", collectionIds: ["hats"] }, combinesWith: { product: false, order: true, shipping: true } });
    await service.create("store-a", { method: "code", code: "TENOFF", type: "order_amount", valueType: "fixed", value: 1000, combinesWith: { product: true, order: false, shipping: false } });
    await service.create("store-a", { method: "automatic", title: "Free delivery over £50", type: "free_shipping", minimum: { type: "amount", amountMinor: 5000 } });
    const result = await requireBagDiscounts(sql(), "store-a", bag({ code: "tenoff" }), { lock: true });
    // Free delivery combines with nothing and saves less than the other two together.
    expect(result.discounts.map((line) => line.title)).toEqual(["Hat week", "TENOFF"]);
    expect(result).toMatchObject({ discountMinor: 1300, shippingMinor: 400, totalMinor: 4600, code: "TENOFF" });
    expect(Object.values(result.lineDiscounts).reduce((a, b) => a + b, 0)).toBe(1300);
  });

  it("tells the shopper why a typed code doesn't apply, and the order refuses it", async () => {
    await service.create("store-a", { method: "code", code: "SCARF50", type: "product_amount", valueType: "percent", value: 50, appliesTo: { scope: "products", productIds: ["p-scarf"] } });
    expect((await discountsForBag(sql(), "store-a", bag({ code: "SCARF50" }))).codeProblem).toBe("This code doesn't apply to anything in your bag.");
    await expect(requireBagDiscounts(sql(), "store-a", bag({ code: "SCARF50" }))).rejects.toMatchObject({ status: 422, code: "DISCOUNT_NOT_APPLICABLE" });
    await expect(requireBagDiscounts(sql(), "store-a", bag({ code: "NOPE" }))).rejects.toMatchObject({ code: "DISCOUNT_NOT_FOUND", message: "This code isn't valid." });
  });

  it("gives buy one get one free on the cheaper item", async () => {
    await service.create("store-a", { method: "code", code: "BOGO", type: "buy_x_get_y", buyXGetY: { buys: { type: "quantity", quantity: 1 }, buysItems: { scope: "all" }, getsQuantity: 1, getsItems: { scope: "all" }, getsValue: { type: "free" }, maxUsesPerOrder: 1 } });
    const result = await requireBagDiscounts(sql(), "store-a", bag({ code: "BOGO" }));
    expect(result.lineDiscounts).toEqual({ "v-hat|": 1500 });
  });

  it("leaves out automatic discounts that haven't started, have ended or are switched off", async () => {
    await service.create("store-a", { method: "automatic", title: "Later", type: "order_amount", valueType: "percent", value: 10, startsAt: "2999-01-01T00:00:00Z" });
    await service.create("store-a", { method: "automatic", title: "Gone", type: "order_amount", valueType: "percent", value: 10, startsAt: "2020-01-01T00:00:00Z", endsAt: "2020-02-01T00:00:00Z" });
    await service.create("store-a", { method: "automatic", title: "Off", type: "order_amount", valueType: "percent", value: 10, active: false });
    expect((await discountsForBag(sql(), "store-a", bag())).discounts).toEqual([]);
  });

  it("counts an automatic discount's limited uses from orders", async () => {
    const limited = await service.create("store-a", { method: "automatic", title: "First 1", type: "order_amount", valueType: "percent", value: 10, usageLimit: 1 });
    expect((await discountsForBag(sql(), "store-a", bag(), { lock: true })).discountMinor).toBe(550);
    await database.query(`INSERT INTO "Order" (id, "storeId", number, "publicToken", status, "customerSnapshot", "subtotalMinor", "shippingMinor", "totalMinor", currency) VALUES ('o9','store-a','o9','t9','PAID','{}',100,0,100,'GBP')`);
    await recordOrderDiscounts(sql(), "store-a", "o9", [{ discountId: limited.id, code: "", title: "First 1", kind: "order_amount", label: "", discountMinor: 10, shippingMinor: 0, shippingSavedMinor: 0, totalMinor: 90 }]);
    expect((await discountsForBag(sql(), "store-a", bag())).discounts).toEqual([]);
    expect((await database.query(`SELECT code FROM "OrderDiscount" WHERE "orderId" = 'o9'`)).rows[0]).toEqual({ code: null });
  });

  it("only applies a discount for chosen customers to them", async () => {
    await service.create("store-a", { method: "automatic", title: "Friends", type: "order_amount", valueType: "percent", value: 10, eligibility: { scope: "customers", emails: ["friend@example.test"] } });
    expect((await discountsForBag(sql(), "store-a", bag())).discounts).toEqual([]);
    expect((await discountsForBag(sql(), "store-a", bag({ email: "Friend@Example.test" }))).discountMinor).toBe(550);
    expect((await discountsForBag(sql(), "store-a", bag({ email: undefined }))).discounts).toEqual([]);
  });
});
