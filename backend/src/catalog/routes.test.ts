import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../auth/types.js";
import { createApp } from "../app.js";
import { errorHandler } from "../http/errors.js";
import { createCatalogAdminRouter, createPublicCatalogRouter } from "./routes.js";

const principal: MerchantPrincipal = {
  userId: 7,
  storeIds: ["store-a"],
  storeRoles: { "store-a": "ADMIN" },
};
const authProvider: AuthProvider = { verify: async () => principal };

function setup() {
  const service = {
    listInventory: vi.fn(async () => ({ nodes: [], nextCursor: null })),
    updateInventory: vi.fn(async (_storeId: string, variantId: string, input: unknown) => ({ variantId, ...input as object })),
    listProducts: vi.fn(async () => ({ nodes: [], nextCursor: null })),
    listPublicProducts: vi.fn(async () => ({ nodes: [], nextCursor: null })),
    getProduct: vi.fn(async () => null),
    createProduct: vi.fn(async (_storeId: string, input: Record<string, unknown>) => ({ id: "product-1", ...input })),
    updateProduct: vi.fn(async (_storeId: string, productId: string, input: Record<string, unknown>) => ({ id: productId, ...input })),
    listCollections: vi.fn(async () => ({ nodes: [], nextCursor: null })),
    getCollection: vi.fn(async (_storeId: string, id: string) => ({ id, storeId: "store-a", productIds: [], products: [] })),
    createCollection: vi.fn(async (_storeId: string, input: Record<string, unknown>) => ({ id: "collection-1", ...input })),
    updateCollection: vi.fn(async (_storeId: string, collectionId: string, input: Record<string, unknown>) => ({ id: collectionId, ...input })),
  };
  const app = express();
  app.use((req, _res, next) => { req.id = "catalog-test"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/catalog", createCatalogAdminRouter(service, authProvider));
  app.use("/api/public/stores/:storeId/catalog", createPublicCatalogRouter(service));
  app.use(errorHandler);
  return { app, service };
}

describe("catalog routes", () => {
  it("scopes inventory reads and adjustments to the authorized store and validates revisions", async () => {
    const { app, service } = setup();
    expect((await request(app).get("/api/stores/store-b/catalog/inventory").set("Authorization","Bearer token")).status).toBe(404);
    expect((await request(app).get("/api/stores/store-a/catalog/inventory?query=TEE&limit=10").set("Authorization","Bearer token")).status).toBe(200);
    expect(service.listInventory).toHaveBeenCalledWith("store-a",expect.objectContaining({query:"TEE",limit:10}));
    expect((await request(app).patch("/api/stores/store-a/catalog/inventory/v").set("Authorization","Bearer token").send({quantity:12})).status).toBe(400);
    expect((await request(app).patch("/api/stores/store-a/catalog/inventory/v").set("Authorization","Bearer token").send({quantity:12,expectedRevision:"rev"})).status).toBe(200);
    expect(service.updateInventory).toHaveBeenCalledWith("store-a","v",{quantity:12,expectedRevision:"rev",actor:7});
  });
  it("keeps the deterministic legacy demo endpoint", async () => {
    const response = await request(createApp()).get("/api/demo/catalog");

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(8);
    expect(response.body.collections).toHaveLength(3);
  });

  it("requires membership and catalog view capability for admin reads", async () => {
    const { app, service } = setup();
    const allowed = await request(app)
      .get("/api/stores/store-a/catalog/products")
      .set("Authorization", "Bearer token");
    const denied = await request(app)
      .get("/api/stores/store-b/catalog/products")
      .set("Authorization", "Bearer token");

    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(404);
    expect(service.listProducts).toHaveBeenCalledWith("store-a", expect.objectContaining({ limit: 50 }));
  });

  it("loads collection detail through the authorized store context", async () => {
    const { app, service } = setup();
    const allowed = await request(app).get("/api/stores/store-a/catalog/collections/ca").set("Authorization", "Bearer token");
    const denied = await request(app).get("/api/stores/store-b/catalog/collections/ca").set("Authorization", "Bearer token");

    expect(allowed.status).toBe(200);
    expect(allowed.body).toMatchObject({ id: "ca", storeId: "store-a" });
    expect(denied.status).toBe(404);
    expect(service.getCollection).toHaveBeenCalledWith("store-a", "ca");
    expect(service.getCollection).toHaveBeenCalledTimes(1);
  });

  it("creates products using the authorized store context", async () => {
    const { app, service } = setup();
    const response = await request(app)
      .post("/api/stores/store-a/catalog/products")
      .set("Authorization", "Bearer token")
      .send({ storeId: "store-b", title: "Cake", handle: "cake", variants: [] });

    expect(response.status).toBe(201);
    expect(service.createProduct).toHaveBeenCalledWith(
      "store-a",
      expect.not.objectContaining({ storeId: "store-b" }),
    );
  });

  it("uses the public active-product reader for unauthenticated lists", async () => {
    const { app, service } = setup();
    const response = await request(app).get("/api/public/stores/store-a/catalog/products?limit=10");

    expect(response.status).toBe(200);
    expect(service.listPublicProducts).toHaveBeenCalledWith("store-a", expect.objectContaining({ limit: 10 }));
    expect(service.listProducts).not.toHaveBeenCalled();
  });
});

it("replaces the gallery through the media endpoint and rejects mixed image contracts", async () => {
  const { app, service } = setup();
  const items = [{ mediaId: "photo-1", altText: "Front", appliesTo: { colour: ["black"] } }];
  await request(app).put("/api/stores/store-a/catalog/products/p1/media").set("Authorization", "Bearer test").send({ items }).expect(200);
  expect(service.updateProduct).toHaveBeenCalledWith("store-a", "p1", { media: items });
  await request(app).patch("/api/stores/store-a/catalog/products/p1").set("Authorization", "Bearer test").send({ media: [], imageUrl: "https://example.com/photo.jpg" }).expect(422);
});
