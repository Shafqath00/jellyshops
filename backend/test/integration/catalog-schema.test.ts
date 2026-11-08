import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "./pglite.js";

describe("canonical catalog schema", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createPGliteDatabase();
  });

  afterEach(async () => {
    await integration.close();
  });

  it("allows the same product slug in different stores but not twice in one store", async () => {
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");

    await integration.query(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, ["product-a", "store-a", "Cake A", "chocolate-cake"]);
    await integration.query(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, ["product-b", "store-b", "Cake B", "chocolate-cake"]);

    await expect(integration.query(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, ["product-duplicate", "store-a", "Duplicate", "chocolate-cake"])).rejects.toBeTruthy();
  });

  it("rejects cross-store product media references", async () => {
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
    await integration.query(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, ["product-a", "store-a", "Cake", "cake"]);
    await integration.query(`INSERT INTO "Media" ("id", "storeId", "type", "storageKey", "url", "mimeType", "byteSize", "width", "height", "originalName") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, ["media-b", "store-b", "image", "store-b/media-b.png", "/api/public/media/store-b/media-b", "image/png", 64, 1, 1, "cake.png"]);

    await expect(integration.query(`INSERT INTO "ProductMedia" ("storeId", "productId", "mediaId") VALUES ($1, $2, $3)`, ["store-a", "product-a", "media-b"])).rejects.toBeTruthy();
  });

  it("rejects cross-store collection membership", async () => {
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
    await integration.query(`INSERT INTO "Collection" ("id", "storeId", "title", "slug", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, ["collection-a", "store-a", "Featured", "featured"]);
    await integration.query(`INSERT INTO "Product" ("id", "storeId", "title", "slug", "updatedAt") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`, ["product-b", "store-b", "Cake", "cake"]);

    await expect(integration.query(`INSERT INTO "CollectionProduct" ("storeId", "collectionId", "productId") VALUES ($1, $2, $3)`, ["store-a", "collection-a", "product-b"])).rejects.toBeTruthy();
  });
});
