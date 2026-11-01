import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../auth/types.js";
import { errorHandler } from "../http/errors.js";
import { createCatalogAdminRouter } from "./routes.js";

const principal = { userId: "account-9", storeIds: ["store-a"], storeRoles: { "store-a": "ADMIN" } } as MerchantPrincipal;
const viewer = { userId: "account-10", storeIds: ["store-a"], storeRoles: { "store-a": "STAFF" } } as MerchantPrincipal;
const auth = (who: MerchantPrincipal): AuthProvider => ({ verify: async () => who });

function setup(who: MerchantPrincipal = principal) {
  const service = {
    listInventory: vi.fn(async () => ({ nodes: [], nextCursor: null })),
    updateInventory: vi.fn(async (_storeId: string, variantId: string, input: unknown) => ({ variantId, ...input as object })),
    listInventoryHistory: vi.fn(async () => ({ nodes: [], nextCursor: null })),
    createProduct: vi.fn(async (_storeId: string, input: Record<string, unknown>) => ({ id: "product-1", ...input })),
    updateProduct: vi.fn(async (_storeId: string, productId: string, input: Record<string, unknown>) => ({ id: productId, ...input })),
    listProducts: vi.fn(), listPublicProducts: vi.fn(), getProduct: vi.fn(), listCollections: vi.fn(), getCollection: vi.fn(), createCollection: vi.fn(), updateCollection: vi.fn(),
  };
  const app = express();
  app.use((req, _res, next) => { req.id = "inventory-history-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/catalog", createCatalogAdminRouter(service as never, auth(who)));
  app.use(errorHandler);
  return { app, service };
}
const get = (app: express.Express, path: string) => request(app).get(`/api/stores/store-a/catalog${path}`).set("Authorization", "Bearer token");
const variant = (extra: Record<string, unknown>) => ({ handle: "tee", title: "Tee", variants: [{ title: "Standard", priceMinor: 1000, ...extra }] });

describe("inventory history and stock fields over HTTP", () => {
  it("serves a variant's history to anyone who can view the catalog, scoped to their store", async () => {
    const { app, service } = setup(viewer);
    expect((await get(app, "/inventory/variant-1/history?limit=25&cursor=40")).status).toBe(200);
    expect(service.listInventoryHistory).toHaveBeenCalledWith("store-a", "variant-1", { limit: 25, cursor: "40" });
    expect((await request(app).get("/api/stores/store-b/catalog/inventory/variant-1/history").set("Authorization", "Bearer token")).status).toBe(404);
    expect((await get(app, "/inventory/variant-1/history?limit=500")).status).toBe(400);
  });

  it("passes the signed-in account and the note to a manual stock change, and keeps viewers out", async () => {
    const { app, service } = setup();
    const body = { quantity: 9, expectedRevision: "rev", note: "  Damaged in transit  " };
    expect((await request(app).patch("/api/stores/store-a/catalog/inventory/v").set("Authorization", "Bearer token").send(body)).status).toBe(200);
    expect(service.updateInventory).toHaveBeenCalledWith("store-a", "v", { quantity: 9, expectedRevision: "rev", note: "Damaged in transit", actor: "account-9" });
    const tooLong = await request(app).patch("/api/stores/store-a/catalog/inventory/v").set("Authorization", "Bearer token").send({ ...body, note: "x".repeat(501) });
    expect(tooLong.status).toBe(400);
    const spoof = await request(app).patch("/api/stores/store-a/catalog/inventory/v").set("Authorization", "Bearer token").send({ ...body, actor: "someone-else" });
    expect(spoof.status).toBe(400);
    const viewerApp = setup(viewer).app;
    expect((await request(viewerApp).patch("/api/stores/store-a/catalog/inventory/v").set("Authorization", "Bearer token").send(body)).status).toBe(403);
  });

  it("validates barcode and low-stock threshold on product writes", async () => {
    const { app, service } = setup();
    const post = (body: unknown) => request(app).post("/api/stores/store-a/catalog/products").set("Authorization", "Bearer token").send(body as object);
    expect((await post(variant({ barcode: "5012345678900", lowStockThreshold: 5 }))).status).toBe(201);
    expect((await post(variant({ barcode: null, lowStockThreshold: null }))).status).toBe(201);
    expect((await post(variant({ barcode: "x".repeat(65) }))).status).toBe(400);
    expect((await post(variant({ barcode: "   " }))).status).toBe(400);
    expect((await post(variant({ lowStockThreshold: -1 }))).status).toBe(400);
    expect((await post(variant({ lowStockThreshold: 2.5 }))).status).toBe(400);
    expect(service.createProduct).toHaveBeenCalledTimes(2);
  });
});

describe("shipping details over HTTP", () => {
  const post = (app: express.Express, body: unknown) => request(app).post("/api/stores/store-a/catalog/products").set("Authorization", "Bearer token").send(body as object);
  const shipping = (extra: Record<string, unknown>) => ({ handle: "tee", title: "Tee", variants: [{ title: "Standard", priceMinor: 1000, ...extra }] });

  it("accepts valid weight, size, origin and HS code, and null to clear them", async () => {
    const { app, service } = setup();
    expect((await post(app, shipping({ weightGrams: 250, lengthMm: 300, widthMm: 200, heightMm: 50, countryOfOrigin: "IN", hsCode: "610910" }))).status).toBe(201);
    expect((await post(app, shipping({ weightGrams: 0, hsCode: "6109100012" }))).status).toBe(201);
    expect((await post(app, shipping({ weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, countryOfOrigin: null, hsCode: null }))).status).toBe(201);
    expect(service.createProduct).toHaveBeenCalledTimes(3);
  });

  it("rejects values that cannot be right before they reach the database", async () => {
    const { app, service } = setup();
    for (const bad of [{ weightGrams: -1 }, { weightGrams: 1.5 }, { weightGrams: 100_000_001 }, { lengthMm: 10_000_001 }, { widthMm: -5 }, { heightMm: 0.5 },
      { countryOfOrigin: "in" }, { countryOfOrigin: "IND" }, { countryOfOrigin: "" }, { hsCode: "6109" }, { hsCode: "6109.10" }, { hsCode: "61091000123" }, { hsCode: "abcdef" }]) {
      expect((await post(app, shipping(bad))).status, JSON.stringify(bad)).toBe(400);
    }
    expect(service.createProduct).not.toHaveBeenCalled();
  });

  it("accepts a fulfilment type on a product and refuses anything else", async () => {
    const { app, service } = setup();
    expect((await post(app, { ...shipping({}), fulfillmentType: "DIGITAL" })).status).toBe(201);
    expect(service.createProduct).toHaveBeenCalledWith("store-a", expect.objectContaining({ fulfillmentType: "DIGITAL" }));
    expect((await post(app, { ...shipping({}), fulfillmentType: "PICKUP" })).status).toBe(400);
    const patch = await request(app).patch("/api/stores/store-a/catalog/products/product-1").set("Authorization", "Bearer token").send({ fulfillmentType: "PHYSICAL" });
    expect(patch.status).toBe(200);
  });
});
