import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { CatalogPostgresRepository } from "./postgres-repository.js";

describe("PostgreSQL catalog repository", () => {
  let database: IntegrationDatabase;
  let repository: CatalogPostgresRepository;

  beforeEach(async () => {
    database = await createPGliteDatabase();
    await database.exec(await readFile(new URL("../../sql/migrations/20260915120000_add_stripe_connect_commerce.sql", import.meta.url), "utf8"));
    await database.exec(await readFile(new URL("../../sql/migrations/20261020140329_store_settings_checkout.sql", import.meta.url), "utf8"));
    await database.exec(await readFile(new URL("../../sql/migrations/20261020163817_jelly_signature_customer_services.sql", import.meta.url), "utf8"));
    repository = new CatalogPostgresRepository(database);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "description", "status", "slug", "updatedAt") VALUES ($1,$2,$3,$4,'ACTIVE',$5,CURRENT_TIMESTAMP)`, ["p1", "store-a", "Cake", "Fresh cake", "cake"]);
    await database.query(`INSERT INTO "ProductVariant" ("id", "storeId", "productId", "title", "sku", "priceMinor", "options", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'{}',CURRENT_TIMESTAMP)`, ["v1", "store-a", "p1", "1 kg", "CAKE-1", 1200]);
    await database.query(`INSERT INTO "InventoryLevel" ("storeId", "variantId", "quantity", "reserved", "updatedAt") VALUES ($1,$2,4,1,CURRENT_TIMESTAMP)`, ["store-a", "v1"]);
  });

  afterEach(async () => { await database.close(); });

  it("filters live catalog values and paginates deterministic price sorting", async () => {
    await repository.createProduct("store-a", { title: "Small cake", handle: "small", status: "ACTIVE", primaryCategoryId: "cake", variants: [{ title: "Small", priceMinor: 500, quantity: 2, options: { size: "small" } }] });
    await repository.createProduct("store-a", { title: "Large cake", handle: "large", status: "ACTIVE", primaryCategoryId: "cake", variants: [{ title: "Large", priceMinor: 2500, quantity: 0, options: { size: "large" } }] });
    const filtered = await repository.listProducts("store-a", { limit: 10, categoryId: "cake", available: true, maxPriceMinor: 1000, variantOptions: { size: "small" } });
    expect(filtered.nodes.map((item) => item.title)).toEqual(["Small cake"]);
    const first = await repository.listProducts("store-a", { limit: 1, sort: "price-asc" });
    const second = await repository.listProducts("store-a", { limit: 1, sort: "price-asc", cursor: first.nextCursor! });
    expect(first.nodes[0].title).toBe("Small cake");
    expect(second.nodes[0].title).toBe("Cake");
    await expect(repository.listProducts("store-a", { limit: 10, sort: "newest", cursor: first.nextCursor! })).rejects.toMatchObject({ status: 422 });
  });

  it("persists collection membership and returns the store currency", async () => {
    await database.query(`UPDATE "Store" SET "currency" = 'GBP', "country" = 'GB' WHERE "id" = 'store-a'`);
    const collection = await repository.createCollection("store-a", { title: "Cakes", handle: "cakes", productIds: ["p1"] });
    expect((await repository.getCollection("store-a", collection.id))?.productIds).toEqual(["p1"]);
    expect((await repository.getProduct("store-a", "p1"))?.priceRange?.currency).toBe("GBP");
    await repository.updateCollection("store-a", collection.id, { title: "Celebrations", productIds: [] });
    expect((await repository.getCollection("store-a", collection.id))?.productIds).toEqual([]);
    await expect(repository.updateCollection("store-b", collection.id, { title: "Wrong" })).rejects.toMatchObject({ status: 404 });
  });

  it("does not allow inventory editing to invalidate active reservations", async () => {
    await expect(repository.updateProduct("store-a", "p1", { variants: [{ id: "v1", title: "Cake", priceMinor: 1200, quantity: 0 }] })).rejects.toMatchObject({ status: 409 });
    expect((await repository.getVariant("store-a", "v1"))?.quantity).toBe(4);
  });

  it("persists product images and variant option changes on the server", async () => {
    const created = await repository.createProduct("store-a", { handle: "new", title: "New", imageUrl: "https://images.example.test/cake.png", variants: [{ title: "Standard", priceMinor: 200, quantity: 3, options: { size: "small" } }] });
    expect(created.media[0]?.url).toBe("https://images.example.test/cake.png");
    const updated = await repository.updateProduct("store-a", created.id, { variants: [{ id: created.variants[0].id, title: "Large", priceMinor: 300, quantity: 4, options: { size: "large" } }] });
    expect(updated.variants[0]).toMatchObject({ options: { size: "large" }, priceMinor: 300, quantity: 4 });
  });

  it("loads a product beyond the first hundred without crossing store boundaries", async () => {
    await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "status", "slug", "updatedAt") SELECT 'a-' || lpad(n::text, 3, '0'), 'store-a', 'Product', 'ACTIVE', 'item-' || n, CURRENT_TIMESTAMP FROM generate_series(1, 105) n`);
    await expect(repository.getProduct("store-a", "p1")).resolves.toMatchObject({ id: "p1" });
    await expect(repository.getProduct("store-b", "p1")).resolves.toBeNull();
  });

  it("lists active products with variants and availability scoped to the store", async () => {
    const result = await repository.listProducts("store-a", { limit: 50 });
    expect(result.nodes[0]).toMatchObject({ id: "p1", storeId: "store-a", title: "Cake", available: true });
    expect(result.nodes[0].variants[0]).toMatchObject({ id: "v1", priceMinor: 1200, quantity: 4, reserved: 1, available: true });
    await expect(repository.listProducts("store-b", { limit: 50 })).resolves.toMatchObject({ nodes: [] });
  });

  it("loads a collection and only its current-store product detail", async () => {
    await database.query(`INSERT INTO "Collection" ("id", "storeId", "title", "slug", "updatedAt") VALUES ('ca', 'store-a', 'Cakes', 'cakes', CURRENT_TIMESTAMP), ('cb', 'store-b', 'Other cakes', 'other-cakes', CURRENT_TIMESTAMP)`);
    await database.query(`UPDATE "Product" SET "collectionIds" = ARRAY['ca']::text[] WHERE "id" = 'p1' AND "storeId" = 'store-a'`);
    await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "status", "slug", "collectionIds", "updatedAt") VALUES ('pb', 'store-b', 'Private cake', 'ACTIVE', 'private-cake', ARRAY['ca']::text[], CURRENT_TIMESTAMP)`);

    await expect(repository.getCollection("store-a", "ca")).resolves.toMatchObject({
      id: "ca", storeId: "store-a", productIds: ["p1"],
      products: [{ id: "p1", storeId: "store-a", variants: [{ id: "v1", priceMinor: 1200 }] }],
    });
    await expect(repository.getCollection("store-a", "cb")).resolves.toBeNull();
  });
});
