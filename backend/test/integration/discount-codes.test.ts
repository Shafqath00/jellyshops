import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DiscountService, recordOrderDiscounts, resolveDiscount, type DiscountSql } from "../../src/discounts/service.js";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "./pglite.js";

const ORDER_MIGRATIONS = [
  "20260915120000_add_stripe_connect_commerce.sql", "20260920100000_add_order_item_configuration_snapshot.sql",
  "20261020140329_store_settings_checkout.sql", "20261022000000_order_management.sql", "20261108000000_customer_profiles_order_tags.sql",
];

describe("discounts on the real schema", () => {
  let database: IntegrationDatabase;
  let service: DiscountService;
  const sql = (): DiscountSql => ({ query: (text: string, values?: unknown[]) => database.query(text, values) as never });
  const order = { subtotalMinor: 5000, shippingMinor: 400, hasDelivery: true, currency: "GBP", email: "Sam@Example.test" };
  const percent = (code: string, value = 10, extra: Record<string, unknown> = {}) => ({ method: "code", code, type: "order_amount", valueType: "percent", value, ...extra });

  async function migrate(...names: string[]) {
    for (const name of names) await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
  }

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await migrate(...ORDER_MIGRATIONS, "20261118000000_discount_codes.sql", "20261127000000_discounts_v2.sql");
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    service = new DiscountService({ transaction: (work) => work(sql()) });
  });
  afterEach(async () => { await database?.close(); });

  async function placeOrder(id: string, code: string, email = "sam@example.test") {
    await database.query(
      `INSERT INTO "Order" (id, "storeId", number, "publicToken", status, "customerSnapshot", "subtotalMinor", "shippingMinor", "totalMinor", currency, "discountCode", "discountMinor")
       VALUES ($1, 'store-a', $1, $2, 'PAID', $3, 5000, 400, 4900, 'GBP', $4, 500)`,
      [id, `token-${id}`, JSON.stringify({ email }), code],
    );
    const applied = await resolveDiscount(sql(), "store-a", code, { ...order, email }).catch(() => null);
    if (applied) await recordOrderDiscounts(sql(), "store-a", id, [applied]);
  }

  it("creates, lists, changes and deletes discounts per store", async () => {
    const created = await service.create("store-a", percent(" spring10 ", 10, { usageLimit: 2 }));
    expect(created).toMatchObject({ code: "SPRING10", title: "SPRING10", type: "order_amount", value: 10, usageLimit: 2, uses: 0, active: true, status: "active", codeCount: 1 });
    await expect(service.create("store-a", percent("SPRING10", 5))).rejects.toMatchObject({ code: "DISCOUNT_CODE_TAKEN" });
    await expect(service.create("store-b", percent("SPRING10", 5))).resolves.toMatchObject({ code: "SPRING10" });
    await expect(service.update("store-b", created.id, percent("SPRING10", 20))).rejects.toMatchObject({ code: "DISCOUNT_NOT_FOUND" });
    expect(await service.update("store-a", created.id, percent("SPRING20", 20))).toMatchObject({ code: "SPRING20", value: 20 });
    expect((await service.codeAvailable("store-a", "spring10")).available).toBe(true);
    expect((await service.codeAvailable("store-a", "spring20")).available).toBe(false);
    expect((await service.codeAvailable("store-a", "spring20", created.id)).available).toBe(true);
    expect((await service.list("store-a")).map((discount) => discount.code)).toEqual(["SPRING20"]);
    await service.remove("store-a", created.id);
    expect(await service.list("store-a")).toEqual([]);
  });

  it("saves every type with its own settings", async () => {
    const product = await service.create("store-a", { method: "automatic", title: "Summer sale", type: "product_amount", valueType: "percent", value: 20, appliesTo: { scope: "collections", productIds: [], collectionIds: ["summer"] }, minimum: { type: "quantity", quantity: 2 }, combinesWith: { product: false, order: true, shipping: true } });
    expect(product).toMatchObject({ method: "automatic", code: null, codeCount: 0, appliesTo: { scope: "collections", collectionIds: ["summer"] }, minimum: { type: "quantity", quantity: 2 }, combinesWith: { order: true } });
    const bogo = await service.create("store-a", { method: "code", code: "BOGO", type: "buy_x_get_y", buyXGetY: { buys: { type: "quantity", quantity: 1 }, buysItems: { scope: "all" }, getsQuantity: 1, getsItems: { scope: "all" }, getsValue: { type: "free" } } });
    expect(bogo.buyXGetY).toMatchObject({ getsValue: { type: "free" }, maxUsesPerOrder: null });
    const ship = await service.create("store-a", { method: "code", code: "SHIP", type: "free_shipping", maxShippingMinor: 600, eligibility: { scope: "tags", tags: ["VIP"] } });
    expect(ship).toMatchObject({ maxShippingMinor: 600, eligibility: { scope: "tags", tags: ["vip"] } });
    await expect(service.update("store-a", ship.id, { method: "code", code: "SHIP", type: "order_amount", valueType: "percent", value: 5 })).rejects.toMatchObject({ code: "DISCOUNT_TYPE_LOCKED" });
  });

  it("refuses bad values with plain words, naming the field", async () => {
    await expect(service.create("store-a", percent("X"))).rejects.toMatchObject({ code: "DISCOUNT_INPUT_INVALID", issues: [{ path: "code" }] });
    await expect(service.create("store-a", percent("BIG", 150))).rejects.toMatchObject({ message: "Use a whole percentage from 1 to 100." });
    await expect(service.create("store-a", percent("DATES", 10, { startsAt: "2026-12-02", endsAt: "2026-12-01" }))).rejects.toMatchObject({ issues: [{ path: "endsAt" }] });
  });

  it("keeps existing codes working after the migration", async () => {
    // A code saved the old way, before the second migration.
    database = await createPGliteDatabase();
    await migrate(...ORDER_MIGRATIONS, "20261118000000_discount_codes.sql");
    await seedStore(database, "store-a", "store-a");
    await database.query(`INSERT INTO "DiscountCode" (id, "storeId", code, kind, value, "usageLimit") VALUES ('old', 'store-a', 'OLDTEN', 'percent', 10, 5)`);
    await database.query(
      `INSERT INTO "Order" (id, "storeId", number, "publicToken", status, "customerSnapshot", "subtotalMinor", "shippingMinor", "totalMinor", currency, "discountCode", "discountMinor")
       VALUES ('o-old', 'store-a', 'o-old', 't-old', 'PAID', '{"email":"a@b.test"}', 5000, 400, 4900, 'GBP', 'OLDTEN', 500)`,
    );
    await migrate("20261127000000_discounts_v2.sql");
    service = new DiscountService({ transaction: (work) => work(sql()) });
    expect((await service.list("store-a"))[0]).toMatchObject({ code: "OLDTEN", title: "OLDTEN", type: "order_amount", valueType: "percent", value: 10, uses: 1, codeCount: 1 });
    await expect(resolveDiscount(sql(), "store-a", "oldten", order)).resolves.toMatchObject({ discountMinor: 500, totalMinor: 4900 });
  });

  it("counts uses from orders that are not cancelled, and keeps a used code's name", async () => {
    const code = await service.create("store-a", { method: "code", code: "ONCE", type: "order_amount", valueType: "fixed", value: 500, usageLimit: 1 });
    await expect(resolveDiscount(sql(), "store-a", "once", order)).resolves.toMatchObject({ code: "ONCE", discountMinor: 500, totalMinor: 4900, label: "£5.00 off the whole order" });
    await placeOrder("o1", "ONCE");
    expect((await service.list("store-a"))[0]!.uses).toBe(1);
    expect((await service.list("store-a"))[0]!.status).toBe("used_up");
    await expect(resolveDiscount(sql(), "store-a", "ONCE", order)).rejects.toMatchObject({ message: "This code has been used up." });
    await expect(service.update("store-a", code.id, { method: "code", code: "TWICE", type: "order_amount", valueType: "fixed", value: 500 })).rejects.toMatchObject({ code: "DISCOUNT_CODE_USED" });
    await database.query(`UPDATE "Order" SET status = 'CANCELLED' WHERE id = 'o1'`);
    await expect(resolveDiscount(sql(), "store-a", "ONCE", order)).resolves.toMatchObject({ discountMinor: 500 });
  });

  it("allows a once-per-customer code once per email address, whatever its case", async () => {
    await service.create("store-a", { method: "code", code: "WELCOME", type: "free_shipping", oncePerCustomer: true });
    await expect(resolveDiscount(sql(), "store-a", "WELCOME", order)).resolves.toMatchObject({ shippingMinor: 0, shippingSavedMinor: 400, totalMinor: 5000 });
    await placeOrder("o2", "WELCOME");
    await expect(resolveDiscount(sql(), "store-a", "WELCOME", order)).rejects.toMatchObject({ message: "You've already used this code." });
    await expect(resolveDiscount(sql(), "store-a", "WELCOME", { ...order, email: "other@example.test" })).resolves.toMatchObject({ shippingMinor: 0 });
  });

  it("checks first orders and customer tags", async () => {
    await service.create("store-a", percent("FIRST", 10, { eligibility: { scope: "first_order" } }));
    await expect(resolveDiscount(sql(), "store-a", "FIRST", order)).resolves.toMatchObject({ discountMinor: 500 });
    await database.query(`INSERT INTO "Order" (id, "storeId", number, "publicToken", status, "customerSnapshot", "subtotalMinor", "shippingMinor", "totalMinor", currency) VALUES ('o3','store-a','o3','t3','PAID','{"email":"sam@example.test"}',100,0,100,'GBP')`);
    await expect(resolveDiscount(sql(), "store-a", "FIRST", order)).rejects.toMatchObject({ message: "This code is for first orders only." });
    await service.create("store-a", percent("VIPONLY", 10, { eligibility: { scope: "tags", tags: ["vip"] } }));
    await expect(resolveDiscount(sql(), "store-a", "VIPONLY", order)).rejects.toMatchObject({ message: "This code isn't available for your account." });
    await database.query(`INSERT INTO "CustomerProfile" (id, "storeId", email, tags) VALUES ('c1','store-a','sam@example.test','{VIP}')`);
    await expect(resolveDiscount(sql(), "store-a", "VIPONLY", order)).resolves.toMatchObject({ discountMinor: 500 });
  });

  it("switches many discounts on, off or deletes them, only in its own store", async () => {
    const a = await service.create("store-a", percent("AAA"));
    const b = await service.create("store-b", percent("BBB"));
    expect(await service.setActive("store-a", [a.id, b.id], false)).toBe(1);
    expect((await service.get("store-b", b.id)).active).toBe(true);
    await expect(resolveDiscount(sql(), "store-a", "AAA", order)).rejects.toMatchObject({ message: "This code isn't valid." });
    expect(await service.removeMany("store-a", [a.id, b.id])).toBe(1);
  });

  it("reports uses, paid orders, sales and money given, and the shop's time zone", async () => {
    const discount = await service.create("store-a", { method: "code", code: "RESULTS", type: "order_amount", valueType: "fixed", value: 500 });
    await placeOrder("p1", "RESULTS");
    await placeOrder("p2", "RESULTS");
    await database.query(`UPDATE "Order" SET status = 'PENDING_PAYMENT' WHERE id = 'p2'`);
    const result = await service.listWithResults("store-a");
    expect(result.timeZone).toBe("Europe/London");
    expect(result.discounts[0]).toMatchObject({ id: discount.id, uses: 2, paidOrders: 1, salesMinor: 4900, givenMinor: 500 });
    expect(result.totals).toEqual({ active: 1, uses: 2, paidOrders: 1, salesMinor: 4900, givenMinor: 500 });
    expect(await service.get("store-a", discount.id)).toMatchObject({ paidOrders: 1, salesMinor: 4900 });
  });

  it("duplicates a discount switched off, with a new code", async () => {
    const source = await service.create("store-a", percent("SPRING", 15, { usageLimit: 10, eligibility: { scope: "first_order" } }));
    const copy = await service.duplicate("store-a", source.id);
    expect(copy).toMatchObject({ title: "Copy of SPRING", code: "SPRING-COPY", active: false, value: 15, usageLimit: 10, eligibility: { scope: "first_order" }, uses: 0 });
    expect((await service.duplicate("store-a", source.id)).code).toBe("SPRING-COPY2");
    const auto = await service.create("store-a", { method: "automatic", title: "Sale", type: "free_shipping" });
    expect(await service.duplicate("store-a", auto.id)).toMatchObject({ title: "Copy of Sale", code: null, method: "automatic" });
    await expect(service.duplicate("store-b", source.id)).rejects.toMatchObject({ code: "DISCOUNT_NOT_FOUND" });
  });

  it("never finds another store's code, and makes fresh codes", async () => {
    await service.create("store-b", percent("THEIRS", 50));
    await expect(resolveDiscount(sql(), "store-a", "THEIRS", order)).rejects.toMatchObject({ code: "DISCOUNT_NOT_FOUND" });
    expect(await service.generateCode("store-a", "vip")).toMatch(/^VIP[A-Z2-9]{8}$/);
  });
});
