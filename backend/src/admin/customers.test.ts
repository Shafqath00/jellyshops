import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CustomerService, OrderTagService } from "./service.js";

describe("merchant customers", () => {
  let database: IntegrationDatabase;
  let customers: CustomerService;
  let orderTags: OrderTagService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql", "20261108000000_customer_profiles_order_tags.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    const repository = { transaction: (work: (tx: unknown) => unknown) => database.transaction((tx) => work({ query: (sql: string, values?: unknown[]) => tx.query(sql, values) })) } as never;
    customers = new CustomerService(repository);
    orderTags = new OrderTagService(repository);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    for (const store of ["store-a", "store-b"]) await database.query(`INSERT INTO "StripeConnectedAccount" ("storeId","stripeAccountId") VALUES ($1,$2)`, [store, `acct_${store}`]);
  });
  afterEach(async () => { await database.close(); });

  let counter = 0;
  async function order(storeId: string, email: string, name: string, totalMinor: number, status = "PAID", payment = "PAID") {
    const id = `order-${++counter}`;
    await database.query(`INSERT INTO "Order" ("id","storeId","number","publicToken","status","customerSnapshot","subtotalMinor","shippingMinor","totalMinor","currency") VALUES ($1,$2,$1,$1,$3,$4::jsonb,$5,0,$5,'GBP')`,
      [id, storeId, status, JSON.stringify({ name, email, address: { city: "London", country: "GB" } }), totalMinor]);
    await database.query(`INSERT INTO "Payment" ("id","storeId","orderId","stripeAccountId","status","amountMinor","currency") VALUES ($1,$2,$3,$4,$5,$6,'GBP')`, [`pay-${id}`, storeId, id, `acct_${storeId}`, payment, totalMinor]);
    return id;
  }

  it("lists customers from orders and added by hand, without counting cancelled orders", async () => {
    await order("store-a", "Asha@Example.com", "Asha Rao", 4000);
    await order("store-a", "asha@example.com", "Asha Rao", 9999, "CANCELLED");
    await order("store-b", "other@example.com", "Other", 100);
    await customers.create("store-a", { email: "sam@example.com", firstName: "Sam", lastName: "Lee", acceptsEmailMarketing: true });
    const list = await customers.list("store-a");
    expect(list.map((customer) => [customer.name, customer.orderCount, customer.lifetimeSpendMinor, customer.acceptsEmailMarketing]).sort()).toEqual([
      ["Asha Rao", 1, 4000, false],
      ["Sam Lee", 0, 0, true],
    ]);
    expect(list.find((customer) => customer.email === "asha@example.com")?.location).toBe("London, GB");
  });

  it("refuses a second customer with the same email", async () => {
    await order("store-a", "asha@example.com", "Asha", 100);
    await expect(customers.create("store-a", { email: "ASHA@example.com" })).rejects.toMatchObject({ status: 409, code: "CUSTOMER_EXISTS" });
    await expect(customers.create("store-a", { email: "not-an-email" })).rejects.toMatchObject({ status: 422 });
  });

  it("edits a customer known from orders: profile, note, tags and email consent, with a revision check", async () => {
    await order("store-a", "asha@example.com", "Asha Rao", 100);
    const first = await customers.update("store-a", "email:asha@example.com", { firstName: "Asha", lastName: "Rao", note: "Prefers morning delivery", tags: ["VIP", " vip ", "VIP"], address: { line1: "1 High St", city: "Leeds", country: "GB" }, acceptsEmailMarketing: true });
    expect(first).toMatchObject({ name: "Asha Rao", note: "Prefers morning delivery", tags: ["VIP", "vip"], location: "Leeds, GB", acceptsEmailMarketing: true, orderCount: 1, revision: 0 });
    const second = await customers.update("store-a", "email:asha@example.com", { revision: 0, acceptsEmailMarketing: false });
    expect(second).toMatchObject({ acceptsEmailMarketing: false, revision: 1, note: "Prefers morning delivery" });
    await expect(customers.update("store-a", "email:asha@example.com", { revision: 0, note: "stale" })).rejects.toMatchObject({ status: 409, code: "CUSTOMER_CHANGED" });
    await expect(customers.update("store-b", "email:asha@example.com", { note: "x" })).rejects.toMatchObject({ status: 404 });
  });

  it("tags an order of this store only", async () => {
    const id = await order("store-a", "asha@example.com", "Asha", 100);
    await expect(orderTags.setTags("store-a", id, ["gift", "gift", " wholesale "])).resolves.toEqual(["gift", "wholesale"]);
    await expect(orderTags.setTags("store-b", id, ["x"])).rejects.toMatchObject({ status: 404 });
  });
});
