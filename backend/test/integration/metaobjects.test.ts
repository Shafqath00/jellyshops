import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaCustomDataRepository } from "../../src/custom-data/prisma-repository.js";
import { MetaobjectService } from "../../src/custom-data/service.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seedStore(database: IntegrationDatabase, id: string, slug: string) {
  await database.database.client.store.create({
    data: { id, name: id, slug, currency: "USD", country: "US" },
  });
}

describe("metaobject persistence", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
  });

  afterEach(async () => {
    await integration.close();
  });

  it("creates, lists, and retrieves typed entries inside one store", async () => {
    const repository = new PrismaCustomDataRepository(integration.database.client);
    const service = new MetaobjectService(repository);
    const definition = await service.createDefinition("store-a", {
      handle: "brand",
      name: "Brand",
      storefrontVisible: true,
      fields: [
        { handle: "name", name: "Name", type: "string", storefrontVisible: true },
        { handle: "logo", name: "Logo", type: "image", storefrontVisible: true },
      ],
    });
    const entry = await service.createEntry("store-a", definition.id, {
      handle: "jelly-foods",
      displayName: "Jelly Foods",
      values: { name: "Jelly Foods", logo: "media-logo" },
    });

    await expect(repository.getMetaobjectEntry("store-a", entry.id)).resolves.toMatchObject({
      definitionId: definition.id,
      values: { name: "Jelly Foods", logo: "media-logo" },
    });
    await expect(repository.listMetaobjectEntries("store-a", definition.id)).resolves.toHaveLength(1);
    await expect(repository.getMetaobjectEntry("store-b", entry.id)).resolves.toBeNull();
  });

  it("keeps definition handles unique per store", async () => {
    const service = new MetaobjectService(new PrismaCustomDataRepository(integration.database.client));
    const definition = {
      handle: "brand",
      name: "Brand",
      storefrontVisible: true,
      fields: [{ handle: "name", name: "Name", type: "string" as const, storefrontVisible: true }],
    };

    await service.createDefinition("store-a", definition);
    await expect(service.createDefinition("store-a", definition)).rejects.toBeTruthy();
    await expect(service.createDefinition("store-b", definition)).resolves.toMatchObject({ storeId: "store-b" });
  });

  it("persists allowed field-label evolution without changing field type", async () => {
    const service = new MetaobjectService(new PrismaCustomDataRepository(integration.database.client));
    const definition = await service.createDefinition("store-a", {
      handle: "brand",
      name: "Brand",
      storefrontVisible: true,
      fields: [{ handle: "name", name: "Name", type: "string", storefrontVisible: true }],
    });

    const updated = await service.updateDefinition("store-a", definition.id, {
      fields: [
        { handle: "name", name: "Brand name", type: "string", storefrontVisible: true },
        { handle: "logo", name: "Logo", type: "image", storefrontVisible: true },
      ],
    });

    expect(updated.fields).toEqual([
      expect.objectContaining({ handle: "name", name: "Brand name", type: "string" }),
      expect.objectContaining({ handle: "logo", type: "image" }),
    ]);
  });
});
