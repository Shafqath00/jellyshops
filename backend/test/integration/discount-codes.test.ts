import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DiscountService, resolveDiscount } from "../../src/discounts/service.js";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "./pglite.js";

describe("discount codes on the real schema", () => {
  let database: IntegrationDatabase;
  let service: DiscountService;
  const sql = () => ({ query: (text: string, values?: unknown[]) => database.query(text, values) as never });
  const order = { subtotalMinor: 5000, shippingMinor: 400, hasDelivery: true, currency: "GBP", email: "Sam@Example.test" };

  beforeEach(async () => {
    database = await createPGliteDatabase();
    // Orders come from the commerce migration, which the shared list leaves out.
    for (const migration of ["20260915120000_add_stripe_connect_commerce.sql", "20260920100000_add_order_item_configuration_snapshot.sql", "20261020140329_store_settings_checkout.sql", "20261022000000_order_management.sql", "20261118000000_discount_codes.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${migration}`, import.meta.url), "utf8"));
    }
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    service = new DiscountService(sql());
  });
  afterEach(async () => { await database?.close(); });

  async function placeOrder(id: string, code: string, email = "sam@example.test") {
    await database.query(
      `INSERT INTO "Order" (id, "storeId", number, "publicToken", status, "customerSnapshot", "subtotalMinor", "shippingMinor", "totalMinor", currency, "discountCode", "discountMinor")
       VALUES ($1, 'store-a', $1, $2, 'PENDING_PAYMENT', $3, 5000, 400, 4900, 'GBP', $4, 500)`,
      [id, `token-${id}`, JSON.stringify({ email }), code],
    );
  }

  it("creates, lists, changes and deletes codes per store", async () => {
    const created = await service.create("store-a", { code: " spring10 ", kind: "percent", value: 10, usageLimit: 2 });
    expect(created).toMatchObject({ code: "SPRING10", kind: "percent", value: 10, usageLimit: 2, uses: 0, active: true });
    await expect(service.create("store-a", { code: "SPRING10", kind: "fixed", value: 100 })).rejects.toMatchObject({ code: "DISCOUNT_CODE_TAKEN" });
    await expect(service.create("store-b", { code: "SPRING10", kind: "fixed", value: 100 })).resolves.toMatchObject({ code: "SPRING10" });
    await expect(service.update("store-b", created.id, { code: "SPRING10", kind: "percent", value: 20 })).rejects.toMatchObject({ code: "DISCOUNT_NOT_FOUND" });
    expect(await service.update("store-a", created.id, { code: "SPRING20", kind: "percent", value: 20 })).toMatchObject({ code: "SPRING20", value: 20 });
    expect((await service.list("store-a")).map((discount) => discount.code)).toEqual(["SPRING20"]);
    await service.remove("store-a", created.id);
    expect(await service.list("store-a")).toEqual([]);
  });

  it("refuses bad values with plain words", async () => {
    await expect(service.create("store-a", { code: "X", kind: "percent", value: 10 })).rejects.toMatchObject({ code: "DISCOUNT_CODE_INVALID" });
    await expect(service.create("store-a", { code: "BIG", kind: "percent", value: 150 })).rejects.toMatchObject({ message: "A percentage must be between 1 and 100." });
    await expect(service.create("store-a", { code: "DATES", kind: "fixed", value: 100, startsAt: "2026-12-02", endsAt: "2026-12-01" })).rejects.toMatchObject({ code: "DISCOUNT_DATES_INVALID" });
  });

  it("counts uses from orders that are not cancelled, and keeps a used code's name", async () => {
    const code = await service.create("store-a", { code: "ONCE", kind: "fixed", value: 500, usageLimit: 1 });
    await expect(resolveDiscount(sql(), "store-a", "once", order)).resolves.toMatchObject({ code: "ONCE", discountMinor: 500, totalMinor: 4900, label: "£5.00 off" });
    await placeOrder("o1", "ONCE");
    expect((await service.list("store-a"))[0]!.uses).toBe(1);
    await expect(resolveDiscount(sql(), "store-a", "ONCE", order)).rejects.toMatchObject({ message: "This code has been used up." });
    await expect(service.update("store-a", code.id, { code: "TWICE", kind: "fixed", value: 500 })).rejects.toMatchObject({ code: "DISCOUNT_CODE_USED" });
    await database.query(`UPDATE "Order" SET status = 'CANCELLED' WHERE id = 'o1'`);
    await expect(resolveDiscount(sql(), "store-a", "ONCE", order)).resolves.toMatchObject({ discountMinor: 500 });
  });

  it("allows a once-per-customer code once per email address, whatever its case", async () => {
    await service.create("store-a", { code: "WELCOME", kind: "free_shipping", oncePerCustomer: true });
    await expect(resolveDiscount(sql(), "store-a", "WELCOME", order)).resolves.toMatchObject({ shippingMinor: 0, totalMinor: 5000 });
    await placeOrder("o2", "WELCOME");
    await expect(resolveDiscount(sql(), "store-a", "WELCOME", order)).rejects.toMatchObject({ message: "You've already used this code." });
    await expect(resolveDiscount(sql(), "store-a", "WELCOME", { ...order, email: "other@example.test" })).resolves.toMatchObject({ shippingMinor: 0 });
  });

  it("never finds another store's code", async () => {
    await service.create("store-b", { code: "THEIRS", kind: "percent", value: 50 });
    await expect(resolveDiscount(sql(), "store-a", "THEIRS", order)).rejects.toMatchObject({ code: "DISCOUNT_NOT_FOUND" });
  });
});
