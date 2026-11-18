import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { processPaymentIntentEvent } from "../stripe/webhooks/payment-intent-events.js";
import { createNotificationService, CaptureNotificationTransport } from "./notifications.js";
import type { CommerceDatabase } from "./repository.js";

const migration = (name: string) => readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8");

/** The order confirmation email must wait for Stripe's payment_intent.succeeded webhook. */
describe("order emails follow the payment, not the checkout", () => {
  let db: IntegrationDatabase;
  let transactions: CommerceDatabase;
  const sql = { query: async (text: string, values?: unknown[]) => db.query(text, values) as never };

  beforeEach(async () => {
    db = await createPGliteDatabase();
    await db.exec(await migration("20260915120000_add_stripe_connect_commerce.sql"));
    await db.exec(`ALTER TABLE "Order" ADD COLUMN "fulfilmentStatus" TEXT DEFAULT 'UNFULFILLED'; CREATE TABLE "OrderEvent"("id" TEXT PRIMARY KEY,"storeId" TEXT,"orderId" TEXT,"type" TEXT,"actorId" TEXT,"details" JSONB,"createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP); CREATE TABLE "StoreOrderManagementSettings"("storeId" TEXT PRIMARY KEY,enabled BOOLEAN); CREATE TABLE "OrderRevision"("id" TEXT PRIMARY KEY,"storeId" TEXT,"orderId" TEXT,"status" TEXT)`);
    await db.exec(`CREATE ROLE jelly_backend NOBYPASSRLS; CREATE ROLE anon NOBYPASSRLS`);
    await db.exec(await migration("20261022010000_notifications_digital.sql"));
    await db.exec(await migration("20261027131838_order_notification_templates.sql"));
    await db.exec(await migration("20261118010000_order_email_after_payment.sql"));
    await seedStore(db, "s", "shop");
    await db.exec(`INSERT INTO "StoreOrderManagementSettings" VALUES('s',TRUE)`);
    await db.exec(`INSERT INTO "Product"("id","storeId","title","description","status","slug","updatedAt") VALUES('p','s','Lamp','','ACTIVE','lamp',CURRENT_TIMESTAMP); INSERT INTO "ProductVariant"("id","storeId","productId","title","priceMinor","updatedAt","options") VALUES('v','s','p','Lamp',2500,CURRENT_TIMESTAMP,'{}'); INSERT INTO "StripeConnectedAccount"("storeId","stripeAccountId") VALUES('s','acct')`);
    // What checkout does: the order and its payment are created unpaid, before the card form.
    await db.exec(`INSERT INTO "Order"("id","storeId","number","publicToken","customerSnapshot","subtotalMinor","shippingMinor","totalMinor","currency") VALUES('o','s','001','public','{"name":"Buyer","email":"buyer@example.test"}',2500,0,2500,'USD'); INSERT INTO "OrderItem"("storeId","orderId","variantId","titleSnapshot","unitPriceMinor","quantity") VALUES('s','o','v','Lamp',2500,1); INSERT INTO "Payment"("id","storeId","orderId","stripeAccountId","paymentIntentId","amountMinor","currency") VALUES('pay','s','o','acct','pi_1',2500,'USD')`);
    transactions = { transaction: (work) => db.transaction((tx) => work({ query: async (text, values) => tx.query(text, values) as never })) };
  });
  afterEach(async () => { await db.close(); });

  const queued = async () => (await db.query<{ type: string }>(`SELECT "type" FROM "OrderNotification" ORDER BY "createdAt", "type"`)).rows.map((row) => row.type);
  const event = (type: string) => processPaymentIntentEvent(sql, { type, stripeAccountId: "acct" } as never, { id: "pi_1" } as never);

  it("queues nothing when checkout creates the order", async () => {
    expect(await queued()).toEqual([]);
    const capture = new CaptureNotificationTransport();
    await createNotificationService(transactions, capture, { publicBaseUrl: "https://example.test", tokenSecret: "x".repeat(32) }).runWorker();
    expect(capture.messages).toHaveLength(0);
  });

  it("sends one confirmation after payment_intent.succeeded, even when Stripe repeats it", async () => {
    await event("payment_intent.succeeded");
    await event("payment_intent.succeeded");
    expect((await db.query(`SELECT "status" FROM "Order"`)).rows[0]).toEqual({ status: "PAID" });
    expect(await queued()).toEqual(["PLACED"]);
    const capture = new CaptureNotificationTransport();
    const service = createNotificationService(transactions, capture, { publicBaseUrl: "https://example.test", tokenSecret: "x".repeat(32) });
    await service.runWorker();
    await service.runWorker();
    expect(capture.messages).toHaveLength(1);
    expect(capture.messages[0]!.html).toContain("Lamp");
  });

  it("sends nothing when the payment fails", async () => {
    await event("payment_intent.payment_failed");
    expect((await db.query(`SELECT "status" FROM "Payment"`)).rows[0]).toEqual({ status: "FAILED" });
    expect((await db.query(`SELECT "status" FROM "Order"`)).rows[0]).toEqual({ status: "PENDING_PAYMENT" });
    expect(await queued()).toEqual([]);
  });

  it("cancels an unpaid checkout quietly", async () => {
    await event("payment_intent.canceled");
    expect((await db.query(`SELECT "status" FROM "Order"`)).rows[0]).toEqual({ status: "CANCELLED" });
    expect(await queued()).toEqual([]);
  });

  it("still tells the shopper when a paid order is cancelled", async () => {
    await event("payment_intent.succeeded");
    await db.exec(`UPDATE "Order" SET "status"='CANCELLED'`);
    expect((await queued()).sort()).toEqual(["CANCELLED", "PLACED"]);
  });

  it("still tells the shopper about a payment taken on an order that is no longer waiting", async () => {
    await db.exec(`UPDATE "Order" SET "status"='CANCELLED'; UPDATE "Payment" SET "status"='PAID'`);
    expect(await queued()).toEqual(["PAYMENT_CONFIRMED"]);
  });

  it("refuses an order status change that skips payment", async () => {
    await expect(db.exec(`UPDATE "Order" SET "status"='SHIPPED'`)).rejects.toThrow(/ORDER_TRANSITION_INVALID/);
    expect((await db.query(`SELECT "status" FROM "Order"`)).rows[0]).toEqual({ status: "PENDING_PAYMENT" });
  });
});
