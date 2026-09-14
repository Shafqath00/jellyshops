import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaCatalogRepository } from "../../src/catalog/prisma-catalog-repository.js";
import { CatalogProviderSync } from "../../src/catalog/provider-sync.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seedStore(database: IntegrationDatabase) {
  return database.database.client.store.create({
    data: { id: "store-a", name: "Store A", slug: "store-a", currency: "USD", country: "US" },
  });
}

describe("provider catalog synchronization", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    await seedStore(integration);
  });

  afterEach(async () => {
    await integration.close();
  });

  it("keeps Jelly product and variant ids stable across provider updates", async () => {
    const repository = new PrismaCatalogRepository(integration.database.client);
    const sync = new CatalogProviderSync(repository);
    const input = {
      externalId: "provider-product-1",
      handle: "cake",
      title: "Cake",
      description: "",
      vendor: null,
      productType: "Cake",
      tags: ["featured"],
      status: "ACTIVE" as const,
      variants: [{
        externalId: "provider-variant-1",
        title: "Default",
        sku: "CAKE-1",
        priceMinor: 1200,
        compareAtPriceMinor: null,
        options: {},
        trackInventory: true,
        quantity: 5,
        reserved: 1,
      }],
    };

    const first = await sync.upsertProduct("store-a", input);
    const firstVariant = await integration.database.client.productVariant.findFirstOrThrow({
      where: { storeId: "store-a", externalId: "provider-variant-1" },
    });

    const second = await sync.upsertProduct("store-a", {
      ...input,
      title: "Celebration Cake",
      variants: [{ ...input.variants[0], priceMinor: 1400, quantity: 9 }],
    });
    const secondVariant = await integration.database.client.productVariant.findFirstOrThrow({
      where: { storeId: "store-a", externalId: "provider-variant-1" },
    });

    expect(second.id).toBe(first.id);
    expect(secondVariant.id).toBe(firstVariant.id);
    await expect(repository.getProduct("store-a", first.id)).resolves.toMatchObject({
      title: "Celebration Cake",
      variants: [{ id: firstVariant.id, priceMinor: 1400, quantity: 9, reserved: 1 }],
    });
  });
});
