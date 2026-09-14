import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaCustomDataRepository } from "../../src/custom-data/prisma-repository.js";
import { CustomDataService } from "../../src/custom-data/service.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seedStore(database: IntegrationDatabase, id: string, slug: string) {
  await database.database.client.store.create({
    data: { id, name: id, slug, currency: "USD", country: "US" },
  });
}

describe("metafield persistence", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
    await integration.database.client.product.create({
      data: { id: "product-a", storeId: "store-a", title: "Cake", slug: "cake" },
    });
    await integration.database.client.product.create({
      data: { id: "product-b", storeId: "store-b", title: "Other", slug: "other" },
    });
  });

  afterEach(async () => {
    await integration.close();
  });

  it("keeps definition identifiers unique within one owner type and store", async () => {
    const service = new CustomDataService(new PrismaCustomDataRepository(integration.database.client));
    const input = {
      ownerType: "product" as const,
      namespace: "details",
      key: "material",
      name: "Material",
      type: "string" as const,
      storefrontVisible: true,
      origin: "jelly" as const,
    };

    await service.createMetafieldDefinition("store-a", input);
    await expect(service.createMetafieldDefinition("store-a", input)).rejects.toBeTruthy();
    await expect(service.createMetafieldDefinition("store-b", input)).resolves.toMatchObject({ storeId: "store-b" });
  });

  it("upserts a typed value for an owner in the same store", async () => {
    const service = new CustomDataService(new PrismaCustomDataRepository(integration.database.client));
    const definition = await service.createMetafieldDefinition("store-a", {
      ownerType: "product",
      namespace: "details",
      key: "servings",
      name: "Servings",
      type: "integer",
      storefrontVisible: true,
      origin: "jelly",
    });

    await service.setMetafieldValue("store-a", definition.id, "product-a", 10);
    await service.setMetafieldValue("store-a", definition.id, "product-a", 12);

    await expect(service.getMetafieldValue("store-a", definition.id, "product-a"))
      .resolves.toMatchObject({ value: 12 });
  });

  it("rejects a value for an owner belonging to another store", async () => {
    const service = new CustomDataService(new PrismaCustomDataRepository(integration.database.client));
    const definition = await service.createMetafieldDefinition("store-a", {
      ownerType: "product",
      namespace: "details",
      key: "material",
      name: "Material",
      type: "string",
      storefrontVisible: true,
      origin: "jelly",
    });

    await expect(service.setMetafieldValue("store-a", definition.id, "product-b", "Cotton"))
      .rejects.toThrow(/owner/i);
  });
});
