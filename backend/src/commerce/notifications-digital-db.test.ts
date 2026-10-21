import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { createNotificationService, CaptureNotificationTransport, UncertainDeliveryError } from "./notifications.js";
import { createDigitalService } from "./digital.js";
import type { CommerceDatabase } from "./repository.js";
describe("transactional notifications and private digital access", () => {
 let db: IntegrationDatabase; let transactions: CommerceDatabase;
 beforeEach(async () => {
  db = await createPGliteDatabase();
  await db.exec(await readFile(new URL("../../sql/migrations/20260915120000_add_stripe_connect_commerce.sql", import.meta.url), "utf8"));
  await db.exec(`ALTER TABLE "Order" ADD COLUMN "fulfilmentStatus" TEXT DEFAULT 'UNFULFILLED'; CREATE TABLE "OrderEvent"("id" TEXT PRIMARY KEY,"storeId" TEXT,"orderId" TEXT,"type" TEXT,"actorId" TEXT,"details" JSONB,"createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP); CREATE TABLE "StoreOrderManagementSettings"("storeId" TEXT PRIMARY KEY,enabled BOOLEAN)`);
  await db.exec(`CREATE ROLE jelly_backend NOBYPASSRLS; CREATE ROLE anon NOBYPASSRLS`);
  await db.exec(`CREATE TABLE "OrderRevision"("id" TEXT PRIMARY KEY,"storeId" TEXT,"orderId" TEXT,"status" TEXT)`);
  await db.exec(await readFile(new URL("../../sql/migrations/20261022010000_notifications_digital.sql", import.meta.url), "utf8"));
  await seedStore(db, "s", "shop");
  await db.exec(`INSERT INTO "StoreOrderManagementSettings" VALUES('s',TRUE)`);
  await db.exec(`INSERT INTO "Product"("id","storeId","title","description","status","slug","updatedAt","fulfillmentType") VALUES('p','s','Guide','','ACTIVE','guide',CURRENT_TIMESTAMP,'DIGITAL'); INSERT INTO "ProductVariant"("id","storeId","productId","title","priceMinor","updatedAt","options") VALUES('v','s','p','PDF',100,CURRENT_TIMESTAMP,'{}'); INSERT INTO "StripeConnectedAccount"("storeId","stripeAccountId") VALUES('s','acct'); INSERT INTO "Order"("id","storeId","number","publicToken","customerSnapshot","subtotalMinor","shippingMinor","totalMinor","currency") VALUES('o','s','001','public','{"name":"Buyer","email":"buyer@example.test"}',100,0,100,'USD'); INSERT INTO "OrderItem"("storeId","orderId","variantId","titleSnapshot","unitPriceMinor","quantity","fulfillmentType") VALUES('s','o','v','Guide',100,1,'DIGITAL'); INSERT INTO "DigitalAsset"("id","storeId","productId","storageKey","filename","mimeType","sizeBytes","maxDownloads") VALUES('asset','s','p','private/key','guide.pdf','application/pdf',3,1); INSERT INTO "Payment"("id","storeId","orderId","stripeAccountId","amountMinor","currency") VALUES('pay','s','o','acct',100,'USD')`);
  transactions = { transaction: (work) => db.transaction((tx) => work({ query: async (sql, values) => tx.query(sql, values) as never })) };
 });
 afterEach(async () => { await db.close(); });
 it("grants once after verified payment and enforces tenant, token and download limit", async () => {
  expect((await db.query(`SELECT * FROM "DigitalEntitlement"`)).rows).toHaveLength(0);
  await db.exec(`UPDATE "Payment" SET "status"='PAID'; UPDATE "Payment" SET "status"='PAID'`);
  expect((await db.query(`SELECT * FROM "DigitalEntitlement"`)).rows).toHaveLength(1);
  expect((await db.query(`SELECT "fulfilmentStatus" FROM "Order"`)).rows[0]).toEqual({ fulfilmentStatus: "FULFILLED" });
  const capture = new CaptureNotificationTransport();
  const service = createNotificationService(transactions, capture, { publicBaseUrl: "https://example.test", tokenSecret: "x".repeat(32) });
  await service.runWorker();
  expect(capture.messages).toHaveLength(3);
  const url = new URL(capture.messages.find((message) => message.subject.includes("downloads"))!.text.split("guide.pdf: ")[1]!);
  const id = url.pathname.split("/").pop()!; const token = url.searchParams.get("token")!;
  expect(JSON.stringify(await service.list("s"))).not.toContain(token);
  expect((await db.query(`SELECT "tokenHash" FROM "DigitalEntitlement"`)).rows[0]!.tokenHash).not.toBe(token);
  const digital = createDigitalService(transactions, { put: async () => {}, get: async () => Buffer.from("pdf") });
  await expect(digital.download("other", id, token)).rejects.toMatchObject({ status: 404 });
  await expect(digital.download("s", id, "invalid")).rejects.toMatchObject({ status: 404 });
  const concurrent = await Promise.allSettled([digital.download("s", id, token), digital.download("s", id, token)]);
  expect(concurrent.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(concurrent.filter((result) => result.status === "rejected")).toHaveLength(1);
  await expect(digital.download("s", id, token)).rejects.toMatchObject({ status: 410 });
  expect((await db.query(`SELECT * FROM "DigitalDownloadAttempt"`)).rows).toHaveLength(1);
 });
 it("does not automatically resend uncertain SMTP delivery", async () => {
  let calls = 0;
  const service = createNotificationService(transactions, { async send() { calls++; throw new UncertainDeliveryError("unknown"); } }, { publicBaseUrl: "https://example.test", tokenSecret: "x".repeat(32) });
  await service.runWorker(); await service.runWorker();
  expect(calls).toBe(1);
  expect((await db.query(`SELECT "status" FROM "OrderNotification"`)).rows[0]).toEqual({ status: "UNCERTAIN" });
 });
 it("revokes access when the order is cancelled", async () => {
  await db.exec(`UPDATE "Payment" SET "status"='PAID'; UPDATE "Order" SET "status"='CANCELLED'`);
  expect((await db.query(`SELECT "revokedAt" FROM "DigitalEntitlement"`)).rows[0]!.revokedAt).not.toBeNull();
 });
 it("enables future notifications for an existing order without sending historical messages", async () => {
  await db.exec(`DELETE FROM "OrderNotification"; UPDATE "StoreOrderManagementSettings" SET enabled=FALSE; UPDATE "Order" SET "status"='PROCESSING'`);
  expect((await db.query(`SELECT * FROM "OrderNotification"`)).rows).toHaveLength(0);
  await db.exec(`UPDATE "StoreOrderManagementSettings" SET enabled=TRUE; UPDATE "Order" SET "status"='SHIPPED'; UPDATE "Order" SET "status"='SHIPPED'`);
  expect((await db.query(`SELECT "type" FROM "OrderNotification"`)).rows).toEqual([{ type: "SHIPPED" }]);
 });
 it("queues a refund once and revokes paid download access on a full refund", async () => {
  await db.exec(`UPDATE "Payment" SET "status"='PAID'; INSERT INTO "Refund"("id","storeId","orderId","paymentId","amountMinor","status") VALUES('refund','s','o','pay',100,'SUCCEEDED'); UPDATE "Refund" SET "status"='SUCCEEDED'`);
  expect((await db.query(`SELECT * FROM "OrderNotification" WHERE "type"='REFUND_PROCESSED'`)).rows).toHaveLength(1);
  expect((await db.query(`SELECT "revokedAt" FROM "DigitalEntitlement"`)).rows[0]!.revokedAt).not.toBeNull();
 });
 it("revokes only explicitly refunded digital variants after a successful item refund", async () => {
  await db.exec(`UPDATE "Payment" SET "status"='PAID'; INSERT INTO "OrderEvent"("id","storeId","orderId","type","details") VALUES('itemrefund','s','o','REFUND_PROCESSED','{"requestId":"r","amountMinor":10,"variantIds":["v"]}')`);
  expect((await db.query(`SELECT "revokedAt" FROM "DigitalEntitlement"`)).rows[0]!.revokedAt).not.toBeNull();
  expect((await db.query(`SELECT * FROM "OrderNotification" WHERE "type"='REFUND_PROCESSED'`)).rows).toHaveLength(1);
 });
 it("allows the backend role through RLS while denying browser roles", async () => {
  await db.exec(`SET ROLE jelly_backend`);
  expect((await db.query(`SELECT * FROM "OrderNotification"`)).rows).toHaveLength(1);
  await db.exec(`INSERT INTO "StoreNotificationBranding"("storeId","brandName") VALUES('s','Store')`);
  await db.exec(`RESET ROLE; SET ROLE anon`);
  await expect(db.query(`SELECT * FROM "OrderNotification"`)).rejects.toThrow(/permission denied/i);
  await db.exec(`RESET ROLE`);
 });
 it("exhausts definite failures and quarantines abandoned sending leases", async () => {
  const service = createNotificationService(transactions, { async send() { throw new Error("SMTP rejected recipient"); } }, { publicBaseUrl: "https://example.test", tokenSecret: "x".repeat(32) });
  await db.exec(`UPDATE "OrderNotification" SET "attempts"=7`);
  await service.runWorker();
  expect((await db.query(`SELECT "status","attempts" FROM "OrderNotification"`)).rows[0]).toEqual({ status: "FAILED", attempts: 8 });
  await db.exec(`UPDATE "OrderNotification" SET "status"='SENDING',"leaseUntil"=CURRENT_TIMESTAMP-interval '1 minute'`);
  await service.runWorker();
  expect((await db.query(`SELECT "status","attempts" FROM "OrderNotification"`)).rows[0]).toEqual({ status: "UNCERTAIN", attempts: 8 });
 });
 it("grants new digital items only after a paid financial edit is applied", async () => {
  await db.exec(`UPDATE "OrderItem" SET "fulfillmentType"='PHYSICAL'; UPDATE "Payment" SET "status"='PAID'; INSERT INTO "OrderRevision" VALUES('edit','s','o','PENDING'); UPDATE "OrderItem" SET "fulfillmentType"='DIGITAL'`);
  expect((await db.query(`SELECT * FROM "DigitalEntitlement"`)).rows).toHaveLength(0);
  await db.exec(`UPDATE "OrderRevision" SET "status"='APPLIED'; UPDATE "OrderRevision" SET "status"='APPLIED'`);
  expect((await db.query(`SELECT * FROM "DigitalEntitlement"`)).rows).toHaveLength(1);
  expect((await db.query(`SELECT * FROM "OrderNotification" WHERE "type"='DIGITAL_READY'`)).rows).toHaveLength(1);
 });
});

