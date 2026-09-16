import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommerceRepository, type CommerceDatabase } from "../../src/commerce/repository.js";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "./pglite.js";

describe("durable commerce", () => {
  let database: IntegrationDatabase;
  let repository: CommerceRepository;
  const expiresAt = new Date("2030-01-01T00:15:00Z");

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await database.exec(await readFile(new URL("../../sql/migrations/20260915120000_add_stripe_connect_commerce.sql", import.meta.url), "utf8"));
    const transactions: CommerceDatabase = {
      transaction: (work) => database.transaction((tx) => work({ query: (sql, values) => tx.query(sql, values) })),
    };
    repository = new CommerceRepository(transactions);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    for (const store of ["store-a", "store-b"]) {
      await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt") VALUES ($1, $2, 'Cake', 'cake', CURRENT_TIMESTAMP)`, [`product-${store}`, store]);
      for (const suffix of ["1", "2"]) {
        const variant = `${store}-${suffix}`;
        await database.query(`INSERT INTO "ProductVariant" ("id", "storeId", "productId", "title", "priceMinor", "options", "updatedAt") VALUES ($1, $2, $3, 'Slice', 100, '{}', CURRENT_TIMESTAMP)`, [variant, store, `product-${store}`]);
        await database.query(`INSERT INTO "InventoryLevel" ("storeId", "variantId", "quantity", "updatedAt") VALUES ($1, $2, 1, CURRENT_TIMESTAMP)`, [store, variant]);
      }
    }
    await seedAttempt("a");
    await seedAttempt("b");
  });

  afterEach(async () => { await database?.close(); });

  async function seedAttempt(id: string) {
    await database.query(`INSERT INTO "Order" ("id", "storeId", "number", "publicToken", "customerSnapshot", "subtotalMinor", "shippingMinor", "totalMinor", "currency") VALUES ($1, 'store-a', $1, $2, '{}', 100, 0, 100, 'USD')`, [id, `public-token-${id}`]);
    await database.query(`INSERT INTO "CheckoutAttempt" ("id", "orderId", "storeId", "cartKey", "cartHash", "stripeIdempotencyKey", "expiresAt") VALUES ($1, $1, 'store-a', $1, 'hash', $2, $3)`, [id, `key-${id}`, expiresAt]);
  }

  const input = (attemptId: string, variantId = "store-a-1", quantity = 1) => ({ storeId: "store-a", attemptId, items: [{ variantId, quantity }] });
  async function inventory() {
    return (await database.query(`SELECT "quantity", "reserved" FROM "InventoryLevel" WHERE "storeId" = 'store-a' AND "variantId" = 'store-a-1'`)).rows[0];
  }

  it("permits only one of two competing final-unit reservations", async () => {
    const results = await Promise.allSettled([repository.reserveVariants(input("a")), repository.reserveVariants(input("b"))]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await inventory()).toEqual({ quantity: 1, reserved: 1 });
    expect((await database.query(`SELECT * FROM "InventoryReservation"`)).rows).toHaveLength(1);
  });

  it("rolls back every hold when any requested variant is unavailable", async () => {
    await database.query(`UPDATE "InventoryLevel" SET "quantity" = 0 WHERE "variantId" = 'store-a-2'`);
    await expect(repository.reserveVariants({ ...input("a"), items: [{ variantId: "store-a-1", quantity: 1 }, { variantId: "store-a-2", quantity: 1 }] })).rejects.toThrow("Insufficient inventory");
    expect(await inventory()).toEqual({ quantity: 1, reserved: 0 });
    expect((await database.query(`SELECT * FROM "InventoryReservation"`)).rows).toHaveLength(0);
  });

  it("reuses the same held quantities without reserving twice and rejects a changed retry", async () => {
    await repository.reserveVariants(input("a"));
    await repository.reserveVariants(input("a"));
    await expect(repository.reserveVariants(input("a", "store-a-2"))).rejects.toThrow("Reservation does not match");
    expect(await inventory()).toEqual({ quantity: 1, reserved: 1 });
  });

  it("releases a hold exactly once and never converts a released hold", async () => {
    await repository.reserveVariants(input("a"));
    expect(await repository.releaseAttempt("a")).toBe(1);
    expect(await repository.releaseAttempt("a")).toBe(0);
    expect(await repository.convertAttemptToSold("a")).toBe(0);
    expect(await inventory()).toEqual({ quantity: 1, reserved: 0 });
    await expect(repository.reserveVariants(input("a"))).rejects.toThrow("Reservation does not match");
  });

  it("converts a hold to sold exactly once and cannot release sold stock", async () => {
    await repository.reserveVariants(input("a"));
    expect(await repository.convertAttemptToSold("a")).toBe(1);
    expect(await repository.convertAttemptToSold("a")).toBe(0);
    expect(await repository.releaseAttempt("a")).toBe(0);
    expect(await inventory()).toEqual({ quantity: 0, reserved: 0 });
  });

  it("rolls back checkout writes and inventory when work under a cart lock fails", async () => {
    await expect(repository.withCheckoutLock("store-a", "cart-a", async (tx) => {
      await tx.reserveVariants(input("a"));
      await tx.query(`UPDATE "Order" SET "status" = 'CANCELLED' WHERE "id" = $1`, ["a"]);
      throw new Error("abort checkout");
    })).rejects.toThrow("abort checkout");
    expect(await inventory()).toEqual({ quantity: 1, reserved: 0 });
    expect((await database.query(`SELECT "status" FROM "Order" WHERE "id" = 'a'`)).rows).toEqual([{ status: "PENDING_PAYMENT" }]);
  });

  it("serializes concurrent checkout critical sections for the same cart key", async () => {
    const events: string[] = [];
    const first = repository.withCheckoutLock("store-a", "cart-race", async () => {
      events.push("first-enter");
      await new Promise((resolve) => setTimeout(resolve, 10));
      events.push("first-exit");
    });
    const second = repository.withCheckoutLock("store-a", "cart-race", async () => {
      events.push("second-enter");
      events.push("second-exit");
    });
    await Promise.all([first, second]);
    expect(events).toEqual(["first-enter", "first-exit", "second-enter", "second-exit"]);
  });

  it("rejects an attempt belonging to another store and nonpositive quantities", async () => {
    await expect(repository.reserveVariants({ ...input("a"), storeId: "store-b" })).rejects.toThrow("Checkout attempt unavailable");
    await expect(repository.reserveVariants(input("a", "store-a-1", 0))).rejects.toThrow("positive integer");
    await expect(repository.reserveVariants(input("a", "store-a-1", -1))).rejects.toThrow("positive integer");
    expect(await inventory()).toEqual({ quantity: 1, reserved: 0 });
  });

  it("requires an order and enforces tenant-scoped attempt, item and reservation references", async () => {
    await expect(database.query(`UPDATE "CheckoutAttempt" SET "orderId" = NULL WHERE "id" = 'a'`)).rejects.toMatchObject({ code: "23502" });
    await expect(database.query(`UPDATE "CheckoutAttempt" SET "storeId" = 'store-b' WHERE "id" = 'a'`)).rejects.toMatchObject({ code: "23503" });
    await expect(database.query(`INSERT INTO "OrderItem" ("orderId", "storeId", "variantId", "titleSnapshot", "unitPriceMinor", "quantity") VALUES ('a', 'store-a', 'store-b-1', 'Cake', 100, 1)`)).rejects.toMatchObject({ code: "23503" });
    await expect(database.query(`INSERT INTO "InventoryReservation" ("attemptId", "storeId", "variantId", "quantity", "expiresAt") VALUES ('a', 'store-a', 'store-b-1', 1, $1)`, [expiresAt])).rejects.toMatchObject({ code: "23503" });
  });

  it("enforces amount, lifecycle, token and idempotency constraints", async () => {
    await expect(database.query(`UPDATE "Order" SET "subtotalMinor" = -1 WHERE "id" = 'a'`)).rejects.toMatchObject({ code: "23514" });
    await expect(database.query(`UPDATE "Order" SET "totalMinor" = 99 WHERE "id" = 'a'`)).rejects.toMatchObject({ code: "23514" });
    await expect(database.query(`UPDATE "Order" SET "status" = 'MADE_UP' WHERE "id" = 'a'`)).rejects.toMatchObject({ code: "23514" });
    await expect(database.query(`UPDATE "Order" SET "publicToken" = 'public-token-a' WHERE "id" = 'b'`)).rejects.toMatchObject({ code: "23505" });
    await expect(database.query(`UPDATE "CheckoutAttempt" SET "stripeIdempotencyKey" = 'key-a' WHERE "id" = 'b'`)).rejects.toMatchObject({ code: "23505" });
    expect((await database.query(`SELECT "paymentIntentId", "status" FROM "CheckoutAttempt" WHERE "id" = 'a'`)).rows).toEqual([{ paymentIntentId: null, status: "PAYMENT_INTENT_CREATING" }]);
  });

  it("persists account readiness, payment/refund/dispute records and deduplicated webhook receipts", async () => {
    await database.query(`INSERT INTO "StripeConnectedAccount" ("storeId", "stripeAccountId", "cardPaymentsStatus", "payoutsStatus") VALUES ('store-a', 'acct_a', 'active', 'pending')`);
    await database.query(`INSERT INTO "Payment" ("id", "storeId", "orderId", "stripeAccountId", "amountMinor", "currency") VALUES ('pay-a', 'store-a', 'a', 'acct_a', 100, 'USD')`);
    await database.query(`INSERT INTO "Refund" ("id", "storeId", "orderId", "paymentId", "amountMinor") VALUES ('refund-a', 'store-a', 'a', 'pay-a', 100)`);
    await expect(database.query(`UPDATE "Refund" SET "orderId" = 'b' WHERE "id" = 'refund-a'`)).rejects.toMatchObject({ code: "23503" });
    await database.query(`INSERT INTO "PaymentDispute" ("storeId", "paymentId", "stripeDisputeId", "status") VALUES ('store-a', 'pay-a', 'dp_a', 'needs_response')`);
    await database.query(`INSERT INTO "StripeWebhookEvent" ("id", "endpointFamily", "stripeEventId", "stripeAccountId", "type", "payload") VALUES ('event-a', 'connect-payments', 'evt_a', 'acct_a', 'payment_intent.succeeded', '{}')`);
    await expect(database.query(`INSERT INTO "StripeWebhookEvent" ("id", "endpointFamily", "stripeEventId", "type", "payload") VALUES ('event-b', 'connect-payments', 'evt_a', 'payment_intent.succeeded', '{}')`)).rejects.toMatchObject({ code: "23505" });
    await database.query(`INSERT INTO "WebhookProcessingAttempt" ("eventId", "attemptNo") VALUES ('event-a', 1)`);
    await database.query(`INSERT INTO "PublicOrderAccessRateLimit" ("storeId", "ipHash", "windowStartedAt", "requestCount") VALUES ('store-a', 'hash', $1, 1)`, [expiresAt]);
    expect((await database.query(`SELECT "status", "inventoryRestoredAt" FROM "Refund"`)).rows).toEqual([{ status: "PENDING", inventoryRestoredAt: null }]);
  });
});
