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
    await database.exec(await readFile(new URL("../../sql/migrations/20261101000000_collection_description_document.sql", import.meta.url), "utf8"));
    repository = new CatalogPostgresRepository(database);
    await seedStore(database, "store-a", "store-a");
    await seedStore(database, "store-b", "store-b");
    await database.query(`INSERT INTO "Product" ("id", "storeId", "title", "description", "status", "slug", "updatedAt") VALUES ($1,$2,$3,$4,'ACTIVE',$5,CURRENT_TIMESTAMP)`, ["p1", "store-a", "Cake", "Fresh cake", "cake"]);
    await database.query(`INSERT INTO "ProductVariant" ("id", "storeId", "productId", "title", "sku", "priceMinor", "options", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'{}',CURRENT_TIMESTAMP)`, ["v1", "store-a", "p1", "1 kg", "CAKE-1", 1200]);
    await database.query(`INSERT INTO "InventoryLevel" ("storeId", "variantId", "quantity", "reserved", "updatedAt") VALUES ($1,$2,4,1,CURRENT_TIMESTAMP)`, ["store-a", "v1"]);
  });

  afterEach(async () => { await database.close(); });

  const options = [{ id: "colour", name: "Colour", type: "configuration", required: false, values: [{ id: "black", label: "Black" }, { id: "white", label: "White" }] }];
  const seedMedia = async (storeId: string, id: string) => database.query(`INSERT INTO "Media" ("id","storeId","type","storageKey","url","mimeType","byteSize","originalName","altText") VALUES ($1,$2,'image',$1,$3,'image/jpeg',1,$1,'Library alt')`, [id, storeId, `https://example.com/${id}.jpg`]);

  it("rolls back product and gallery edits together when media ownership fails", async () => {
    await seedMedia("store-a", "shared");
    await seedMedia("store-b", "foreign");
    await repository.updateProduct("store-a", "p1", { media: [{ mediaId: "shared" }] });
    const transactional = new CatalogPostgresRepository(database, { transaction: work => database.transaction(tx => work({ query: (sql, values) => tx.query(sql, values) })) });
    await expect(transactional.updateProduct("store-a", "p1", { title: "Should roll back", media: [{ mediaId: "foreign" }] })).rejects.toMatchObject({ code: "MEDIA_INVALID" });
    expect(await repository.getProduct("store-a", "p1")).toMatchObject({ title: "Cake", media: [{ id: "shared" }] });
  });

  it("replaces and hydrates ordered gallery assignments without changing the library", async () => {
    await seedMedia("store-a", "black"); await seedMedia("store-a", "shared");
    const saved = await repository.updateProduct("store-a", "p1", { options, media: [{ mediaId: "black", altText: "Black front", appliesTo: { colour: ["black"] } }, { mediaId: "shared", altText: "Shared shot" }] });
    expect(saved.media.map(media => [media.id, media.position, media.altText, media.appliesTo])).toEqual([["black", 0, "Black front", { colour: ["black"] }], ["shared", 1, "Shared shot", {}]]);
    expect((await repository.updateProduct("store-a", "p1", { title: "Renamed" })).media).toEqual(saved.media);
    expect((await repository.updateProduct("store-a", "p1", { media: [] })).media).toEqual([]);
    expect((await database.query(`SELECT "id" FROM "Media" WHERE "storeId"='store-a'`)).rows).toHaveLength(2);
  });

  it("rejects foreign media, repeats, bad assignments, and galleries over the cap", async () => {
    await seedMedia("store-b", "foreign");
    await expect(repository.updateProduct("store-a", "p1", { media: [{ mediaId: "foreign" }] })).rejects.toMatchObject({ code: "MEDIA_INVALID" });
    await expect(repository.updateProduct("store-a", "p1", { media: [{ mediaId: "a" }, { mediaId: "a" }] })).rejects.toMatchObject({ code: "MEDIA_DUPLICATE" });
    await expect(repository.updateProduct("store-a", "p1", { options, media: [{ mediaId: "a", appliesTo: { colour: ["missing"] } }] })).rejects.toMatchObject({ code: "MEDIA_ASSIGNMENT_INVALID" });
    await expect(repository.updateProduct("store-a", "p1", { media: Array.from({ length: 31 }, (_, n) => ({ mediaId: String(n) })) })).rejects.toMatchObject({ code: "MEDIA_LIMIT_EXCEEDED" });
  });

  it("unlinks photos when their last assigned value is removed", async () => {
    await seedMedia("store-a", "black"); await seedMedia("store-a", "shared");
    await repository.updateProduct("store-a", "p1", { options, media: [{ mediaId: "black", appliesTo: { colour: ["black"] } }, { mediaId: "shared" }] });
    const saved = await repository.updateProduct("store-a", "p1", { options: [{ ...options[0], values: [{ id: "white", label: "White" }] }] });
    expect(saved.media.map(media => media.id)).toEqual(["shared"]);
    expect((await database.query(`SELECT "id" FROM "Media" WHERE "id"='black'`)).rows).toHaveLength(1);
  });

  it("keeps gallery tags and alt text when legacy clients save or move the cover", async () => {
    await seedMedia("store-a", "black"); await seedMedia("store-a", "shared");
    const original = await repository.updateProduct("store-a", "p1", { options, media: [{ mediaId: "black", altText: "Tagged", appliesTo: { colour: ["black"] } }, { mediaId: "shared", altText: "Shared" }] });
    expect((await repository.updateProduct("store-a", "p1", { imageUrl: original.media[0].url })).media).toEqual(original.media);
    const moved = await repository.updateProduct("store-a", "p1", { imageUrl: original.media[1].url });
    expect(moved.media.map(media => media.id)).toEqual(["shared", "black"]);
    expect(moved.media[1]).toMatchObject({ altText: "Tagged", appliesTo: { colour: ["black"] } });
  });

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

  it('saves personalisation fields, reads them back and refuses malformed ones', async () => {
    const fields = [{ id: 'engraving', label: 'Engraving', required: true, maxLength: 12, priceAdjustmentMinor: 500 }];
    const created = await repository.createProduct('store-a', { title: 'Ring', handle: 'ring', variants: [{ title: 'Default', priceMinor: 9000, quantity: 3, options: {} }], personalisation: fields });
    expect(created.personalisation).toEqual(fields);
    const updated = await repository.updateProduct('store-a', created.id, { personalisation: [...fields, { id: 'note', label: 'Gift message', maxLength: 200, multiline: true }] });
    expect(updated.personalisation?.map((field) => field.id)).toEqual(['engraving', 'note']);
    await expect(repository.updateProduct('store-a', created.id, { personalisation: [{ id: 'x' }] })).rejects.toMatchObject({ code: 'INVALID_PERSONALISATION' });
    expect((await repository.getProduct('store-a', 'p1'))?.personalisation).toEqual([]);
  });

  it("saves a quantity rule, clears it with null and refuses one off the steps", async () => {
    const created = await repository.createProduct("store-a", { title: "Tumbler", handle: "tumbler", variants: [{ title: "Default", priceMinor: 300, quantity: 50, options: {} }], quantityRule: { min: 6, step: 6, max: 48 } });
    expect(created.quantityRule).toEqual({ min: 6, step: 6, max: 48 });
    await expect(repository.updateProduct("store-a", created.id, { quantityRule: { min: 4, step: 6 } })).rejects.toMatchObject({ code: "INVALID_QUANTITY_RULE", message: "The minimum must be a multiple of the step (6)." });
    expect((await repository.updateProduct("store-a", created.id, { quantityRule: null })).quantityRule).toBeNull();
    expect((await repository.getProduct("store-a", "p1"))?.quantityRule).toBeNull();
  });
});
