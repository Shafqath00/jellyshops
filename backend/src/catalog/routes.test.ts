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
    listProducts: vi.fn(async () => ({ nodes: [], nextCursor: null })),
    listPublicProducts: vi.fn(async () => ({ nodes: [], nextCursor: null })),
    getProduct: vi.fn(async () => null),
    createProduct: vi.fn(async (_storeId: string, input: Record<string, unknown>) => ({ id: "product-1", ...input })),
    updateProduct: vi.fn(async (_storeId: string, productId: string, input: Record<string, unknown>) => ({ id: productId, ...input })),
    listCollections: vi.fn(async () => ({ nodes: [], nextCursor: null })),
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
    expect(denied.status).toBe(403);
    expect(service.listProducts).toHaveBeenCalledWith("store-a", expect.objectContaining({ limit: 50 }));
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
