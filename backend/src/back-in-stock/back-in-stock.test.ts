import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { errorHandler } from "../http/errors.js";
import { CaptureNotificationTransport, type NotificationTransport } from "../commerce/notifications.js";
import { createPublicBackInStockRouter } from "./routes.js";
import { BackInStockService } from "./service.js";

async function product(database: IntegrationDatabase, storeId: string, id: string, stock: number, status = "ACTIVE"): Promise<void> {
  await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "status", "slug", "updatedAt") VALUES ($1, $2, $3, $4::"ProductStatus", $1, NOW())`, [id, storeId, `Linen ${id}`, status]);
  await database.query(`INSERT INTO "ProductVariant" ("id", "storeId", "productId", "title", "sku", "priceMinor", "options", "updatedAt") VALUES ($1, $2, $3, 'Large', $1, 2000, '{}', NOW())`, [`${id}-v`, storeId, id]);
  await database.query(`INSERT INTO "InventoryLevel" ("storeId", "variantId", "quantity", "reserved", "updatedAt") VALUES ($1, $2, $3, 0, NOW())`, [storeId, `${id}-v`, stock]);
}
const restock = (database: IntegrationDatabase, variantId: string, quantity: number) => database.query(`UPDATE "InventoryLevel" SET "quantity" = $2 WHERE "variantId" = $1`, [variantId, quantity]);
const statuses = async (database: IntegrationDatabase) => (await database.query<{ status: string }>(`SELECT "status" FROM "BackInStockRequest" ORDER BY "createdAt"`)).rows.map((row) => row.status);

describe("BackInStockService", () => {
  let database: IntegrationDatabase;
  let clock = 0;
  let transport: CaptureNotificationTransport;
  let service: BackInStockService;
  beforeEach(async () => {
    database = await createPGliteDatabase();
    await seedStore(database, "store-a", "linen-shop");
    await seedStore(database, "store-b", "other");
    await product(database, "store-a", "sheet", 0);
    await product(database, "store-a", "towel", 4);
    await product(database, "store-a", "draft", 0, "DRAFT");
    await product(database, "store-b", "other", 0);
    clock = 0;
    transport = new CaptureNotificationTransport();
    service = new BackInStockService(database as never, transport, "https://shop.example/", () => clock);
  });
  afterEach(async () => { await database.close(); });

  it("keeps one waiting request per shopper and variant, and counts them for the merchant", async () => {
    await service.request("store-a", "sheet-v", "ana@example.test", "1");
    await service.request("store-a", "sheet-v", "ANA@example.test", "1");
    await service.request("store-a", "sheet-v", "sam@example.test", "1");
    expect(await statuses(database)).toEqual(["waiting", "waiting"]);
    expect(await service.waitingCounts("store-a")).toEqual([{ productId: "sheet", variantId: "sheet-v", waiting: 2 }]);
    expect(await service.waitingCounts("store-b")).toEqual([]);
  });

  it("refuses in-stock, draft, other stores' and unknown products, bad emails, and too many requests", async () => {
    await expect(service.request("store-a", "towel-v", "a@example.test", "x")).rejects.toMatchObject({ status: 409 });
    await expect(service.request("store-a", "draft-v", "a@example.test", "x")).rejects.toMatchObject({ status: 404 });
    await expect(service.request("store-a", "other-v", "a@example.test", "x")).rejects.toMatchObject({ status: 404 });
    await expect(service.request("store-a", "sheet-v", "not-an-email", "x")).rejects.toMatchObject({ code: "INVALID_EMAIL" });
    for (let index = 0; index < 5; index++) await service.request("store-a", "sheet-v", `p${index}@example.test`, "busy");
    await expect(service.request("store-a", "sheet-v", "p9@example.test", "busy")).rejects.toMatchObject({ status: 429 });
    clock += 11 * 60_000;
    await expect(service.request("store-a", "sheet-v", "p9@example.test", "busy")).resolves.toEqual({ status: "waiting" });
  });

  it("emails each shopper once when the variant can be bought again", async () => {
    await service.request("store-a", "sheet-v", "ana@example.test", "1");
    expect(await service.notifyAvailable()).toEqual({ sent: 0, failed: 0, configured: true });
    await restock(database, "sheet-v", 3);
    expect(await service.notifyAvailable()).toEqual({ sent: 1, failed: 0, configured: true });
    expect(transport.messages[0]).toMatchObject({ to: "ana@example.test", subject: "Linen sheet (Large) is back at store-a" });
    expect(transport.messages[0].html).toContain('href="https://shop.example/linen-shop/products/sheet"');
    expect(transport.messages[0].text).toContain("https://shop.example/linen-shop/products/sheet");
    expect(await service.notifyAvailable()).toEqual({ sent: 0, failed: 0, configured: true });
    expect(await statuses(database)).toEqual(["notified"]);
    // Asking again after being told starts a new request.
    await restock(database, "sheet-v", 0);
    await service.request("store-a", "sheet-v", "ana@example.test", "1");
    expect(await statuses(database)).toEqual(["notified", "waiting"]);
  });

  it("marks a failed send and keeps requests while no email sender is set up", async () => {
    await service.request("store-a", "sheet-v", "ana@example.test", "1");
    await restock(database, "sheet-v", 2);
    const idle = new BackInStockService(database as never, undefined, "https://shop.example");
    expect(await idle.notifyAvailable()).toEqual({ sent: 0, failed: 0, configured: false });
    expect(await statuses(database)).toEqual(["waiting"]);
    const broken: NotificationTransport = { send: async () => { throw new Error("SMTP down"); } };
    expect(await new BackInStockService(database as never, broken, "https://shop.example").notifyAvailable()).toEqual({ sent: 0, failed: 1, configured: true });
    expect(await statuses(database)).toEqual(["failed"]);
  });

  it("answers shoppers through the public route and ignores bots", async () => {
    const app = express().use(express.json()).use("/api/public/stores/:storeId/back-in-stock", createPublicBackInStockRouter(service)).use(errorHandler);
    const sent = await request(app).post("/api/public/stores/store-a/back-in-stock").send({ variantId: "sheet-v", email: "ana@example.test" });
    expect(sent.status).toBe(202);
    expect(sent.headers["cache-control"]).toBe("no-store");
    await request(app).post("/api/public/stores/store-a/back-in-stock").send({ variantId: "sheet-v", email: "bot@example.test", website: "spam" }).expect(202);
    expect((await request(app).post("/api/public/stores/store-a/back-in-stock").send({ variantId: "sheet-v", email: "a@example.test", extra: 1 })).status).toBe(400);
    expect(await statuses(database)).toEqual(["waiting"]);
  });
});
