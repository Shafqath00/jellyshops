import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import type { AuthProvider, MerchantPrincipal } from "../auth/types.js";
import { errorHandler } from "../http/errors.js";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";
import { createCatalogAdminRouter } from "./routes.js";
import { CatalogService } from "./service.js";

describe("search listing and URL handle", () => {
  let database: IntegrationDatabase;
  let service: CatalogService;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    for (const name of ["20260915120000_add_stripe_connect_commerce.sql", "20261020140329_store_settings_checkout.sql", "20261020163817_jelly_signature_customer_services.sql"]) {
      await database.exec(await readFile(new URL(`../../sql/migrations/${name}`, import.meta.url), "utf8"));
    }
    const repository = new CatalogPostgresRepository(database);
    service = new CatalogService(repository, repository);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
  });
  afterEach(async () => { await database.close(); });

  const create = (storeId: string, handle: string, extra: Record<string, unknown> = {}) => service.createProduct(storeId, { handle, title: "Linen shirt", status: "ACTIVE", variants: [{ title: "Standard", priceMinor: 4900 }], ...extra });

  it("stores the page title and description, keeps them when a save leaves them out, and clears them with null", async () => {
    const product = await create("store-a", "linen-shirt", { seoTitle: "Organic linen shirt | Hemp & Co", seoDescription: "A breathable shirt made from organic linen." });
    expect(product).toMatchObject({ seoTitle: "Organic linen shirt | Hemp & Co", seoDescription: "A breathable shirt made from organic linen." });

    const renamed = await service.updateProduct("store-a", product.id, { title: "Linen shirt v2" });
    expect(renamed).toMatchObject({ title: "Linen shirt v2", seoTitle: "Organic linen shirt | Hemp & Co", seoDescription: "A breathable shirt made from organic linen." });

    const changed = await service.updateProduct("store-a", product.id, { seoTitle: "Linen shirt", seoDescription: null });
    expect(changed).toMatchObject({ seoTitle: "Linen shirt", seoDescription: null });

    const cleared = await service.updateProduct("store-a", product.id, { seoTitle: null });
    expect(cleared).toMatchObject({ seoTitle: null, seoDescription: null });
  });

  it("has no page title or description unless one is set", async () => {
    expect(await create("store-a", "plain")).toMatchObject({ seoTitle: null, seoDescription: null });
  });

  it("shows the page title and description to shoppers' search engines through the public listing", async () => {
    await create("store-a", "linen-shirt", { seoTitle: "Organic linen shirt", seoDescription: "Breathable." });
    const [listed] = (await service.listPublicProducts("store-a", { limit: 10 })).nodes;
    expect(listed).toMatchObject({ seoTitle: "Organic linen shirt", seoDescription: "Breathable." });
  });

  it("rejects a title or description the database would not keep", async () => {
    const product = await create("store-a", "limits");
    await expect(database.query(`UPDATE "Product" SET "seoTitle" = $2 WHERE "id" = $1`, [product.id, "x".repeat(256)])).rejects.toThrow(/seoTitle/);
    await expect(database.query(`UPDATE "Product" SET "seoDescription" = $2 WHERE "id" = $1`, [product.id, "x".repeat(501)])).rejects.toThrow(/seoDescription/);
    await expect(database.query(`UPDATE "Product" SET "seoTitle" = '' WHERE "id" = $1`, [product.id])).rejects.toThrow(/seoTitle/);
  });

  it("changes a product's URL handle, and keeps it when a save leaves it out", async () => {
    const product = await create("store-a", "linen-shirt");
    expect(product.handle).toBe("linen-shirt");
    expect((await service.updateProduct("store-a", product.id, { handle: "organic-linen-shirt" })).handle).toBe("organic-linen-shirt");
    expect((await service.updateProduct("store-a", product.id, { title: "Another name" })).handle).toBe("organic-linen-shirt");
  });

  it("refuses a handle another product in the store already uses, with a clear message", async () => {
    const first = await create("store-a", "linen-shirt");
    const second = await create("store-a", "wool-scarf");
    await expect(create("store-a", "linen-shirt")).rejects.toMatchObject({ status: 409, code: "HANDLE_TAKEN", message: "Another product already uses this URL handle. Choose a different one." });
    await expect(service.updateProduct("store-a", second.id, { handle: "linen-shirt" })).rejects.toMatchObject({ status: 409, code: "HANDLE_TAKEN" });
    expect((await service.getProduct("store-a", second.id))?.handle).toBe("wool-scarf");
    // Saving a product under its own handle is not a conflict.
    expect((await service.updateProduct("store-a", first.id, { handle: "linen-shirt", title: "Linen shirt again" })).title).toBe("Linen shirt again");
  });

  it("lets different stores use the same handle", async () => {
    await create("store-a", "linen-shirt");
    expect((await create("store-b", "linen-shirt")).handle).toBe("linen-shirt");
  });
});

describe("search listing over HTTP", () => {
  const principal = { userId: "account-1", storeIds: ["store-a"], storeRoles: { "store-a": "ADMIN" } } as MerchantPrincipal;
  const auth: AuthProvider = { verify: async () => principal };

  function setup() {
    const service = {
      createProduct: vi.fn(async (_storeId: string, input: Record<string, unknown>) => ({ id: "product-1", ...input })),
      updateProduct: vi.fn(async (_storeId: string, id: string, input: Record<string, unknown>) => ({ id, ...input })),
      listInventory: vi.fn(), updateInventory: vi.fn(), listInventoryHistory: vi.fn(), listProducts: vi.fn(), listPublicProducts: vi.fn(), getProduct: vi.fn(), listCollections: vi.fn(), getCollection: vi.fn(), createCollection: vi.fn(), updateCollection: vi.fn(),
    };
    const app = express();
    app.use((req, _res, next) => { req.id = "seo-test"; next(); });
    app.use(express.json());
    app.use("/api/stores/:storeId/catalog", createCatalogAdminRouter(service as never, auth));
    app.use(errorHandler);
    return { app, service };
  }
  const post = (app: express.Express, body: Record<string, unknown>) => request(app).post("/api/stores/store-a/catalog/products").set("Authorization", "Bearer token").send({ title: "Tee", variants: [{ title: "Standard", priceMinor: 100 }], ...body });
  const patch = (app: express.Express, body: Record<string, unknown>) => request(app).patch("/api/stores/store-a/catalog/products/product-1").set("Authorization", "Bearer token").send(body);

  it("accepts a title, a description and a plain URL handle, and null to clear", async () => {
    const { app, service } = setup();
    expect((await post(app, { handle: "organic-linen-shirt", seoTitle: "Organic linen shirt", seoDescription: "Breathable." })).status).toBe(201);
    expect((await patch(app, { seoTitle: null, seoDescription: null })).status).toBe(200);
    expect(service.updateProduct).toHaveBeenCalledWith("store-a", "product-1", { seoTitle: null, seoDescription: null });
    expect((await post(app, { handle: "Café_2026" })).status).toBe(201);
  });

  it("trims what it is given, and refuses an empty title or description in place of null", async () => {
    const { app, service } = setup();
    await post(app, { handle: "tee", seoTitle: "  Linen shirt  " });
    expect(service.createProduct).toHaveBeenCalledWith("store-a", expect.objectContaining({ seoTitle: "Linen shirt" }));
    expect((await post(app, { handle: "tee", seoTitle: "   " })).status).toBe(400);
    expect((await post(app, { handle: "tee", seoDescription: "" })).status).toBe(400);
  });

  it("refuses text that is too long to keep", async () => {
    const { app } = setup();
    expect((await post(app, { handle: "tee", seoTitle: "x".repeat(256) })).status).toBe(400);
    expect((await post(app, { handle: "tee", seoDescription: "x".repeat(501) })).status).toBe(400);
    expect((await post(app, { handle: "tee", seoTitle: "x".repeat(255), seoDescription: "x".repeat(500) })).status).toBe(201);
  });

  it("refuses a URL handle that would change what the address means", async () => {
    const { app, service } = setup();
    for (const handle of ["two words", "a/b", "a?b", "a#b", "a%20b", "", "   ", "x".repeat(256)]) {
      expect((await post(app, { handle })).status, JSON.stringify(handle)).toBe(400);
      expect((await patch(app, { handle })).status, JSON.stringify(handle)).toBe(400);
    }
    expect(service.createProduct).not.toHaveBeenCalled();
    expect(service.updateProduct).not.toHaveBeenCalled();
  });
});
