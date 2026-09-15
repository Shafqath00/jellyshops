import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seedStore(database: IntegrationDatabase, id: string, slug: string) {
  return database.database.client.store.create({
    data: { id, name: id, slug, currency: "USD", country: "US" },
  });
}

describe("canonical catalog schema", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
  });

  afterEach(async () => {
    await integration.close();
  });

  it("allows the same product slug in different stores but not twice in one store", async () => {
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");

    await integration.database.client.product.create({
      data: { storeId: "store-a", title: "Cake A", slug: "chocolate-cake" },
    });
    await integration.database.client.product.create({
      data: { storeId: "store-b", title: "Cake B", slug: "chocolate-cake" },
    });

    await expect(integration.database.client.product.create({
      data: { storeId: "store-a", title: "Duplicate", slug: "chocolate-cake" },
    })).rejects.toBeTruthy();
  });

  it("rejects cross-store product media references", async () => {
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
    await integration.database.client.product.create({
      data: { id: "product-a", storeId: "store-a", title: "Cake", slug: "cake" },
    });
    await integration.database.client.media.create({
      data: {
        id: "media-b",
        storeId: "store-b",
        type: "image",
        storageKey: "store-b/media-b.png",
        url: "/api/public/media/store-b/media-b",
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        originalName: "cake.png",
      },
    });

    await expect(integration.database.client.productMedia.create({
      data: { storeId: "store-a", productId: "product-a", mediaId: "media-b" },
    })).rejects.toBeTruthy();
  });

  it("rejects cross-store collection membership", async () => {
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
    await integration.database.client.collection.create({
      data: { id: "collection-a", storeId: "store-a", title: "Featured", slug: "featured" },
    });
    await integration.database.client.product.create({
      data: { id: "product-b", storeId: "store-b", title: "Cake", slug: "cake" },
    });

    await expect(integration.database.client.collectionProduct.create({
      data: { storeId: "store-a", collectionId: "collection-a", productId: "product-b" },
    })).rejects.toBeTruthy();
  });
});
