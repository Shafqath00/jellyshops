import { readFile } from "node:fs/promises";
import Stripe from "stripe";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CommerceRepository } from "./repository.js";
import { PaymentIntentService } from "./payment-intents.js";
import { CheckoutService } from "./service.js";
import { createCommerceRouter } from "./routes.js";
import { errorHandler } from "../http/errors.js";
import type { StripeGateway } from "../stripe/client.js";
import type { CatalogReader } from "../catalog/service.js";
import type { StripeAccountService } from "../stripe/accounts/service.js";

describe("durable PaymentIntent preparation", () => {
  let database: IntegrationDatabase;
  let repository: CommerceRepository;
  let service: PaymentIntentService;
  let failAttachment: boolean;
  let failRelease: boolean;
  let failCommit: boolean;
  const intent = () => ({ id: "pi_existing", client_secret: "test-client-result", status: "requires_payment_method",
    amount: 1500, currency: "usd", metadata: { jelly_order_id: "order-1", jelly_checkout_attempt_id: "attempt-1" },
    latest_charge: null } as unknown as Stripe.PaymentIntent);
  const create = vi.fn<StripeGateway["createDirectPaymentIntent"]>();
  const retrieve = vi.fn<(id: string, account: string) => Promise<Stripe.PaymentIntent>>();

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await database.exec(await readFile(new URL("../../sql/migrations/20260915120000_add_stripe_connect_commerce.sql", import.meta.url), "utf8"));
    await seedStore(database, "store-1", "shop");
    await database.query(`INSERT INTO "StripeConnectedAccount" ("storeId", "stripeAccountId", "cardPaymentsStatus") VALUES ($1, $2, 'active')`, ["store-1", "acct_merchant"]);
    await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt") VALUES ('p1', 'store-1', 'Cake', 'cake', CURRENT_TIMESTAMP)`);
    await database.query(`INSERT INTO "ProductVariant" ("id", "storeId", "productId", "title", "priceMinor", "options", "updatedAt") VALUES ('v1', 'store-1', 'p1', 'Slice', 1500, '{}', CURRENT_TIMESTAMP)`);
    await database.query(`INSERT INTO "InventoryLevel" ("storeId", "variantId", "quantity", "updatedAt") VALUES ('store-1', 'v1', 3, CURRENT_TIMESTAMP)`);
    await database.query(`INSERT INTO "Order" ("id", "storeId", "number", "publicToken", "customerSnapshot", "subtotalMinor", "shippingMinor", "totalMinor", "currency") VALUES ('order-1', 'store-1', '1', 'public-token', '{}', 1500, 0, 1500, 'USD')`);
    await database.query(`INSERT INTO "Payment" ("id", "storeId", "orderId", "stripeAccountId", "amountMinor", "currency") VALUES ('payment-1', 'store-1', 'order-1', 'acct_merchant', 1500, 'USD')`);
    await database.query(`INSERT INTO "CheckoutAttempt" ("id", "orderId", "storeId", "cartKey", "cartHash", "stripeIdempotencyKey", "expiresAt") VALUES ('attempt-1', 'order-1', 'store-1', 'cart-1', 'hash', 'durable-key', $1)`, [new Date(Date.now() + 900_000)]);
    failAttachment = false; failRelease = false; failCommit = false;
    repository = new CommerceRepository({ transaction: (work) => database.transaction(async (tx) => {
      const result = await work({ query: async (sql, values) => {
        const normalizedSql = sql.trimStart();
        if (failAttachment && normalizedSql.startsWith('UPDATE "Payment"') && normalizedSql.includes('"paymentIntentId"')) {
          failAttachment = false; throw new Error("local attachment failed");
        }
        if (failRelease && normalizedSql.startsWith('UPDATE "InventoryLevel"')) throw new Error("release failed");
        return tx.query(sql, values);
      } });
      if (failCommit) { failCommit = false; throw new Error("commit failed"); }
      return result;
    }) });
    await repository.reserveVariants({ storeId: "store-1", attemptId: "attempt-1", items: [{ variantId: "v1", quantity: 1 }] });
    create.mockReset().mockResolvedValue(intent());
    retrieve.mockReset().mockResolvedValue(intent());
    service = new PaymentIntentService({ repository, stripeGateway: {
      createDirectPaymentIntent: create, retrievePaymentIntent: retrieve,
    } });
  }, 20_000);

  afterEach(async () => { await database?.close(); });

  async function state() {
    return {
      attempt: (await database.query(`SELECT "status", "paymentIntentId", "stripeIdempotencyKey" FROM "CheckoutAttempt"`)).rows,
      order: (await database.query(`SELECT "status" FROM "Order"`)).rows,
      payment: (await database.query(`SELECT "status", "paymentIntentId", "chargeId" FROM "Payment"`)).rows,
      reservations: (await database.query(`SELECT "status", "quantity" FROM "InventoryReservation"`)).rows,
      inventory: (await database.query(`SELECT "quantity", "reserved" FROM "InventoryLevel"`)).rows,
    };
  }

  it("reuses Stripe's result and persisted key after local attachment fails without duplicate order or reservation", async () => {
    failAttachment = true;
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toThrow("local attachment failed");
    expect(await state()).toEqual({
      attempt: [{ status: "PAYMENT_INTENT_CREATING", paymentIntentId: null, stripeIdempotencyKey: "durable-key" }],
      order: [{ status: "PENDING_PAYMENT" }], payment: [{ status: "PENDING", paymentIntentId: null, chargeId: null }],
      reservations: [{ status: "HELD", quantity: 1 }], inventory: [{ quantity: 3, reserved: 1 }],
    });
    await expect(service.preparePayment("attempt-1", "store-1")).resolves.toEqual({ orderId: "order-1", publicToken: "public-token", clientSecret: "test-client-result", connectedAccountId: "acct_merchant" });
    expect(create.mock.calls).toEqual(Array.from({ length: 2 }, () => [
      { amount: 1500, currency: "usd", orderId: "order-1", checkoutAttemptId: "attempt-1" },
      { connectedAccountId: "acct_merchant", idempotencyKey: "durable-key" },
    ]));
    expect(await state()).toEqual({
      attempt: [{ status: "READY", paymentIntentId: "pi_existing", stripeIdempotencyKey: "durable-key" }],
      order: [{ status: "PENDING_PAYMENT" }], payment: [{ status: "PENDING", paymentIntentId: "pi_existing", chargeId: null }],
      reservations: [{ status: "HELD", quantity: 1 }], inventory: [{ quantity: 3, reserved: 1 }],
    });
  });

  it("does not reveal a client secret when transaction commit fails", async () => {
    failCommit = true;
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toThrow("commit failed");
    expect((await state()).attempt[0]).toMatchObject({ paymentIntentId: null, status: "PAYMENT_INTENT_CREATING" });
  });

  it("retrieves an attached intent in the same merchant context without creating again", async () => {
    await service.preparePayment("attempt-1", "store-1");
    retrieve.mockResolvedValueOnce({ ...intent(), latest_charge: { id: "ch_existing" } } as Stripe.PaymentIntent);
    await expect(service.preparePayment("attempt-1", "store-1")).resolves.toMatchObject({ clientSecret: "test-client-result" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledExactlyOnceWith("pi_existing", "acct_merchant");
    expect((await state()).payment).toEqual([{ status: "PENDING", paymentIntentId: "pi_existing", chargeId: "ch_existing" }]);
  });

  it.each([
    new Stripe.errors.StripeConnectionError({ message: "timeout" }),
    new Stripe.errors.StripeAPIError({ message: "unknown result", statusCode: 500 }),
    new Stripe.errors.StripeIdempotencyError({ message: "request in progress", statusCode: 409 }),
    new Error("unknown failure"),
  ])("retains the reservation after ambiguous Stripe failure %#", async (error) => {
    create.mockRejectedValueOnce(error);
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toMatchObject({ code: "PAYMENT_PREPARATION_RETRY" });
    expect((await state()).attempt[0]).toMatchObject({ status: "PAYMENT_INTENT_CREATING", paymentIntentId: null });
    expect((await state()).reservations).toEqual([{ status: "HELD", quantity: 1 }]);
    await service.preparePayment("attempt-1", "store-1");
    expect(create.mock.calls[0][1]).toEqual(create.mock.calls[1][1]);
  });

  it("atomically cancels a definitive creation rejection and releases its hold once", async () => {
    create.mockRejectedValueOnce(new Stripe.errors.StripeInvalidRequestError({ message: "amount invalid", statusCode: 400 }));
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toMatchObject({ code: "PAYMENT_CREATION_REJECTED" });
    expect(await state()).toEqual({
      attempt: [{ status: "CANCELLED", paymentIntentId: null, stripeIdempotencyKey: "durable-key" }],
      order: [{ status: "CANCELLED" }], payment: [{ status: "CANCELLED", paymentIntentId: null, chargeId: null }],
      reservations: [{ status: "RELEASED", quantity: 1 }], inventory: [{ quantity: 3, reserved: 0 }],
    });
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toMatchObject({ code: "CHECKOUT_ATTEMPT_UNAVAILABLE" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rolls back all cancellation writes if inventory release fails", async () => {
    create.mockRejectedValueOnce(new Stripe.errors.StripeInvalidRequestError({ message: "invalid", statusCode: 400 }));
    failRelease = true;
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toThrow("release failed");
    expect((await state()).order).toEqual([{ status: "PENDING_PAYMENT" }]);
    expect((await state()).attempt[0]).toMatchObject({ status: "PAYMENT_INTENT_CREATING" });
    expect((await state()).reservations).toEqual([{ status: "HELD", quantity: 1 }]);
  });

  it.each(["PAID", "CANCELLED", "REFUNDED"])("cannot cancel or return secrets for a %s order", async (status) => {
    await database.query(`UPDATE "Order" SET "status" = $1`, [status]);
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toMatchObject({ code: "CHECKOUT_ATTEMPT_UNAVAILABLE" });
    expect(create).not.toHaveBeenCalled();
    expect((await state()).order).toEqual([{ status }]);
  });

  it("rejects expired attempts and cross-store access before contacting Stripe", async () => {
    await expect(service.preparePayment("attempt-1", "other-store")).rejects.toMatchObject({ code: "CHECKOUT_ATTEMPT_NOT_FOUND" });
    await database.query(`UPDATE "CheckoutAttempt" SET "expiresAt" = $1`, [new Date(0)]);
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toMatchObject({ code: "CHECKOUT_ATTEMPT_UNAVAILABLE" });
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps attached intent and stock when retrieval fails, including definitive retrieval errors", async () => {
    await service.preparePayment("attempt-1", "store-1");
    retrieve.mockRejectedValueOnce(new Stripe.errors.StripeInvalidRequestError({ message: "temporarily inaccessible", statusCode: 404 }));
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toMatchObject({ code: "PAYMENT_PREPARATION_RETRY" });
    expect((await state()).reservations).toEqual([{ status: "HELD", quantity: 1 }]);
    expect((await state()).attempt[0]).toMatchObject({ status: "READY", paymentIntentId: "pi_existing" });
  });

  it("attaches a recovered succeeded intent without exposing a secret or marking the order paid", async () => {
    create.mockResolvedValueOnce({ ...intent(), status: "succeeded", latest_charge: "ch_paid" });
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toMatchObject({ code: "PAYMENT_NOT_CONFIRMABLE" });
    expect((await state()).payment[0]).toMatchObject({ paymentIntentId: "pi_existing", chargeId: "ch_paid", status: "PENDING" });
    expect((await state()).order).toEqual([{ status: "PENDING_PAYMENT" }]);
  });

  it("rejects mismatched Stripe results without attachment or secret disclosure", async () => {
    create.mockResolvedValueOnce({ ...intent(), amount: 5 });
    await expect(service.preparePayment("attempt-1", "store-1")).rejects.toMatchObject({ code: "PAYMENT_PREPARATION_RETRY" });
    expect((await state()).attempt[0]).toMatchObject({ paymentIntentId: null });
  });

  it("serves preparation through CheckoutService and the scoped public route", async () => {
    const checkout = new CheckoutService({ repository, catalog: {} as CatalogReader,
      stripeAccountService: {} as StripeAccountService,
      stripeGateway: { createDirectPaymentIntent: create, retrievePaymentIntent: retrieve } });
    const app = express();
    app.use(express.json());
    app.use("/api/public/stores/:storeId/checkout", createCommerceRouter(checkout));
    app.use(errorHandler);
    const wrongStore = await request(app).post("/api/public/stores/other-store/checkout/payment-intent").send({ attemptId: "attempt-1" });
    expect(wrongStore.status).toBe(404);
    const invalid = await request(app).post("/api/public/stores/store-1/checkout/payment-intent").send({});
    expect(invalid.status).toBe(422);
    const result = await request(app).post("/api/public/stores/store-1/checkout/payment-intent").send({ attemptId: "attempt-1", amount: 1, connectedAccountId: "acct_attacker" });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ orderId: "order-1", publicToken: "public-token", clientSecret: "test-client-result", connectedAccountId: "acct_merchant" });
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(create.mock.calls[0][0].amount).toBe(1500);
  });
});
