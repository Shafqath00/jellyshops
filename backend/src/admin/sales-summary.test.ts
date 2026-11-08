import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { AdminSalesService } from "./service.js";

describe("dashboard sales by period", () => {
  let database: IntegrationDatabase;
  let sales: AdminSalesService;
  const now = new Date("2026-11-08T12:00:00.000Z");

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    sales = new AdminSalesService({ transaction: (work: (tx: unknown) => unknown) => database.transaction((tx) => work({ query: (sql: string, values?: unknown[]) => tx.query(sql, values) })) } as never, () => now);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    for (const store of ["store-a", "store-b"]) await database.query(`INSERT INTO "StripeConnectedAccount" ("storeId","stripeAccountId") VALUES ($1,$2)`, [store, `acct_${store}`]);
  });
  afterEach(async () => { await database.close(); });

  let counter = 0;
  async function order(storeId: string, daysAgo: number, totalMinor: number, payment: string, status = "PAID") {
    const id = `order-${++counter}`;
    const createdAt = new Date(now.getTime() - daysAgo * 86_400_000);
    await database.query(`INSERT INTO "Order" ("id","storeId","number","publicToken","status","customerSnapshot","subtotalMinor","shippingMinor","totalMinor","currency","createdAt") VALUES ($1,$2,$1,$1,$3,'{}',$4,0,$4,'GBP',$5)`, [id, storeId, status, totalMinor, createdAt]);
    await database.query(`INSERT INTO "Payment" ("id","storeId","orderId","stripeAccountId","status","amountMinor","currency") VALUES ($1,$2,$3,$6,$4,$5,'GBP')`, [`pay-${id}`, storeId, id, payment, totalMinor, `acct_${storeId}`]);
  }

  it("totals paid, not-cancelled orders for the period and the period before, with one entry per day", async () => {
    await order("store-a", 0.1, 1000, "PAID");
    await order("store-a", 2.5, 3000, "PAID");
    await order("store-a", 3, 9999, "PENDING");
    await order("store-a", 4, 7777, "PAID", "CANCELLED");
    await order("store-a", 9, 500, "PAID");
    await order("store-a", 20, 400, "PAID");
    await order("store-b", 1, 123456, "PAID");

    const result = await sales.getSales("store-a", 7);
    expect(result.current).toEqual({ revenueMinor: 4000, paidOrders: 2, averageOrderMinor: 2000 });
    expect(result.previous).toEqual({ revenueMinor: 500, paidOrders: 1, averageOrderMinor: 500 });
    expect(result.daily).toHaveLength(7);
    expect(result.daily.at(-1)).toEqual({ date: "2026-11-08", revenueMinor: 1000, paidOrders: 1 });
    expect(result.daily.reduce((sum, day) => sum + day.revenueMinor, 0)).toBe(4000);
  });

  it("returns zeros for a store with no sales", async () => {
    const result = await sales.getSales("store-a", 1);
    expect(result.current).toEqual({ revenueMinor: 0, paidOrders: 0, averageOrderMinor: 0 });
    expect(result.daily).toEqual([{ date: "2026-11-08", revenueMinor: 0, paidOrders: 0 }]);
  });
});
