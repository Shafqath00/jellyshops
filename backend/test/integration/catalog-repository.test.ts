import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaCatalogRepository } from "../../src/catalog/prisma-catalog-repository.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seedStore(database: IntegrationDatabase, id: string, slug: string, currency = "USD") {
  return database.database.client.store.create({
    data: { id, name: id, slug, currency, country: "US" },
  });
}

describe("PrismaCatalogRepository", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
  });

  afterEach(async () => {
    await integration.close();
  });

  it("maps variants into price range and availability without crossing stores", async () => {
    await seedStore(integration, "store-a", "store-a", "USD");
    await seedStore(integration, "store-b", "store-b", "EUR");
    await integration.database.client.product.create({
      data: {
        id: "product-a",
        storeId: "store-a",
        title: "Cake",
        slug: "cake",
        status: "ACTIVE",
        variants: {
          create: [
            {
              id: "variant-a-small",
              storeId: "store-a",
              title: "Small",
              priceMinor: 1000,
              options: {},
              inventory: { create: { storeId: "store-a", quantity: 5, reserved: 1 } },
            },
            {
              id: "variant-a-large",
              storeId: "store-a",
              title: "Large",
              priceMinor: 1500,
              options: {},
              trackInventory: false,
            },
          ],
        },
      },
    });

    const repository = new PrismaCatalogRepository(integration.database.client);

    await expect(repository.getProduct("store-b", "product-a")).resolves.toBeNull();
    await expect(repository.getProduct("store-a", "product-a")).resolves.toMatchObject({
      priceRange: { minMinor: 1000, maxMinor: 1500, currency: "USD" },
      available: true,
      variants: [
        { id: "variant-a-small", quantity: 5, reserved: 1, available: true },
        { id: "variant-a-large", quantity: null, reserved: null, available: true },
      ],
    });
  });

  it("filters public-ready product queries by requested status and collection", async () => {
    await seedStore(integration, "store-a", "store-a");
    await integration.database.client.product.createMany({
      data: [
        { id: "active", storeId: "store-a", title: "Active", slug: "active", status: "ACTIVE" },
        { id: "draft", storeId: "store-a", title: "Draft", slug: "draft", status: "DRAFT" },
      ],
    });
    await integration.database.client.collection.create({
      data: {
        id: "featured",
        storeId: "store-a",
        title: "Featured",
        slug: "featured",
        products: { create: { storeId: "store-a", productId: "active", position: 0 } },
      },
    });

    const repository = new PrismaCatalogRepository(integration.database.client);
    const result = await repository.listProducts("store-a", {
      status: "ACTIVE",
      collectionId: "featured",
      limit: 10,
    });

    expect(result.nodes.map(({ id }) => id)).toEqual(["active"]);
  });
});
