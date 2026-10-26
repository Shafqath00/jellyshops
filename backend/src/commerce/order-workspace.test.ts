import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CommerceRepository, type CommerceDatabase } from "./repository.js";
import { CheckoutService } from "./service.js";
import { MerchantOrderService } from "./merchant-orders.js";
import { createOrderRuntime } from "./order-runtime.js";
import { processConnectPaymentEvent } from "../stripe/webhooks/processor.js";
import type { StripeGateway } from "../stripe/client.js";
import type { CatalogReader } from "../catalog/service.js";
import type { StripeAccountService } from "../stripe/accounts/service.js";
import { loadConfig } from "../config.js";

describe("integrated order workspace", () => {
  let db: IntegrationDatabase;
  let database: CommerceDatabase;
  let checkout: CheckoutService;
  let runtime: ReturnType<typeof createOrderRuntime>;
  beforeEach(async () => {
    db = await createPGliteDatabase();
    for (const file of ["20260915120000_add_stripe_connect_commerce.sql", "20260916100000_add_refund_idempotency_key.sql", "20260920100000_add_order_item_configuration_snapshot.sql", "20261020140329_store_settings_checkout.sql", "20261022000000_order_management.sql", "20261022010000_notifications_digital.sql", "20261027000000_shipment_exceptions.sql"]) {
      await db.exec(await readFile(new URL(`../../sql/migrations/${file}`, import.meta.url), "utf8"));
    }
    await seedStore(db, "s", "shop");
    await db.exec(`INSERT INTO "StoreOrderManagementSettings" VALUES ('s',true);
      INSERT INTO "Product" (id,"storeId",title,slug,"updatedAt","fulfillmentType") VALUES ('p','s','Handbook','handbook',now(),'DIGITAL');
      INSERT INTO "ProductVariant" (id,"storeId","productId",title,"priceMinor",options,"updatedAt") VALUES ('v','s','p','PDF',500,'{}',now());
      INSERT INTO "StripeConnectedAccount" ("storeId","stripeAccountId") VALUES ('s','acct_a');
      INSERT INTO "DigitalAsset" (id,"storeId","productId","storageKey",filename,"mimeType","sizeBytes") VALUES ('asset','s','p','s/book.pdf','book.pdf','application/pdf',5);`);
    database = { transaction: work => db.transaction(tx => work({ query: (sql, values) => tx.query(sql, values) })) };
    const repo = new CommerceRepository(database);
    const gateway = {} as StripeGateway;
    checkout = new CheckoutService({ repository: repo, catalog: {
      getVariant: async () => ({ id: "v", productId: "p", title: "PDF", sku: "BOOK", priceMinor: 500, available: true }),
      getProduct: async () => ({ title: "Handbook", fulfillmentType: "DIGITAL", options: [], media: [{ url: "https://example.test/book.png" }] }),
    } as unknown as CatalogReader, stripeAccountService: {
      getLivePaymentReadiness: async () => true, getStatus: async () => ({ stripeAccountId: "acct_a" }),
    } as unknown as StripeAccountService, checkoutPolicy: { getCheckoutPolicy: async () => ({ currency: "USD", country: "US", shippingMinor: 300 }) }, enhancedSnapshots: true, isTest: true });
    runtime = createOrderRuntime(database, new MerchantOrderService(repo, gateway), loadConfig({ NODE_ENV: "test" }), {});
  });
  afterEach(async () => { await db?.close(); });

  async function createOrder() {
    const result = await checkout.begin({ storeId: "s", cartKey: "cart", currency: "USD", items: [{ variantId: "v", quantity: 1 }], customerSnapshot: { name: "Buyer", email: "buyer@example.test", note: "Gift" } });
    await db.query(`UPDATE "Payment" SET "paymentIntentId"='pi_a' WHERE "orderId"=$1`, [result.orderId]);
    return result;
  }
  it("creates a complete digital purchase without shipping or stock reservations", async () => {
    const result = await createOrder();
    const row = (await db.query(`SELECT "shippingMinor","totalMinor","customerNote","isTest" FROM "Order" WHERE id=$1`, [result.orderId])).rows[0];
    expect(row).toEqual({ shippingMinor: 0, totalMinor: 500, customerNote: "Gift", isTest: true });
    expect((await db.query(`SELECT * FROM "InventoryReservation"`)).rows).toHaveLength(0);
    const revision = (await db.query(`SELECT snapshot FROM "OrderRevision" WHERE "orderId"=$1`, [result.orderId])).rows[0]!.snapshot as any;
    expect(revision.items[0]).toMatchObject({ productTitleSnapshot: "Handbook", variantTitleSnapshot: "PDF", fulfillmentType: "DIGITAL", imageSnapshot: "https://example.test/book.png" });
  });
  it("rolls back failed webhook processing and grants access only once after successful retry", async () => {
    const order = await createOrder();
    await db.exec(`INSERT INTO "StripeWebhookEvent" (id,"endpointFamily","stripeEventId",type,payload) VALUES ('receipt','connect-payments','evt_a','payment_intent.succeeded','{}');`);
    const event = { id: "receipt", stripeAccountId: "acct_a", type: "payment_intent.succeeded", payload: { data: { object: { id: "pi_a" } } } };
    await expect(database.transaction(async tx => { await processConnectPaymentEvent(tx, event, runtime.hooks); throw new Error("commit failed"); })).rejects.toThrow("commit failed");
    expect((await db.query(`SELECT status FROM "Payment"`)).rows[0]?.status).toBe("PENDING");
    expect((await db.query(`SELECT * FROM "DigitalEntitlement"`)).rows).toHaveLength(0);
    await database.transaction(tx => processConnectPaymentEvent(tx, event, runtime.hooks));
    await database.transaction(tx => processConnectPaymentEvent(tx, event, runtime.hooks));
    expect((await db.query(`SELECT * FROM "DigitalEntitlement"`)).rows).toHaveLength(1);
    expect((await db.query(`SELECT "processedAt" FROM "StripeWebhookEvent"`)).rows[0]?.processedAt).not.toBeNull();
    expect((await db.query(`SELECT count(*)::int AS count FROM "OrderNotification" WHERE type='PAYMENT_CONFIRMED'`)).rows[0]?.count).toBe(1);
    await db.query(`INSERT INTO "OrderNote" (id,"storeId","orderId",body) VALUES ('private','s',$1,'staff secret')`, [order.orderId]);
    const publicOrder = await checkout.getPublicOrder("s", order.publicToken);
    expect(JSON.stringify(publicOrder)).not.toContain("staff secret");
    expect(publicOrder.payment).toEqual({ status: "PAID" });
    expect(JSON.stringify(publicOrder)).not.toContain("pi_a");
  });
  it("shows the shopper shipments, timeline and progress, and never staff notes or internal events", async () => {
    const order = await createOrder();
    const item = (await db.query<{ variantId: string }>(`SELECT "variantId" FROM "OrderItem" WHERE "orderId" = $1 LIMIT 1`, [order.orderId])).rows[0];
    await db.query(`UPDATE "Order" SET status = 'SHIPPED', "fulfilmentStatus" = 'FULFILLED' WHERE id = $1`, [order.orderId]);
    await db.query(
      `INSERT INTO "OrderFulfilment" (id, "storeId", "orderId", items, status, "trackingNumber", carrier, "trackingUrl")
       VALUES ('shipment-public', 's', $1, $2::jsonb, 'SHIPPED', 'RM-TEST-1', 'Royal Mail', 'https://track.example.com/RM-TEST-1')`,
      [order.orderId, JSON.stringify([{ variantId: item.variantId, quantity: 1 }])],
    );
    await db.query(`INSERT INTO "OrderNote" (id,"storeId","orderId",body) VALUES ('internal-note','s',$1,'refund risk, do not discuss')`, [order.orderId]);
    await db.query(`INSERT INTO "OrderEvent" (id,"storeId","orderId",type,details) VALUES ('internal-event','s',$1,'NOTE_ADDED','{"body":"refund risk"}')`, [order.orderId]);

    const publicOrder = await checkout.getPublicOrder("s", order.publicToken);
    expect(publicOrder.shipments).toEqual([expect.objectContaining({
      id: "shipment-public",
      status: "SHIPPED",
      carrier: "Royal Mail",
      trackingNumber: "RM-TEST-1",
      trackingUrl: "https://track.example.com/RM-TEST-1",
      items: [expect.objectContaining({ quantity: 1 })],
    })]);
    expect(publicOrder.progress.map((step: { state: string }) => step.state)).toEqual(["done", "done", "current", "upcoming"]);
    expect(JSON.stringify(publicOrder)).not.toContain("refund risk");
    expect(JSON.stringify(publicOrder)).not.toContain("internal-note");
    expect(JSON.stringify(publicOrder)).not.toContain("NOTE_ADDED");
  });
  it("rejects digital checkout when the product no longer has an active file", async () => {
    await db.exec(`UPDATE "DigitalAsset" SET "archivedAt"=now()`);
    await expect(createOrder()).rejects.toMatchObject({ code: "DIGITAL_FILE_UNAVAILABLE" });
  });
});
