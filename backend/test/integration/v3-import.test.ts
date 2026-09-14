import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { PrismaV3StorefrontImporter } from "../../src/storefront/migration/import-v3.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

describe("PrismaV3StorefrontImporter", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
    await integration.database.client.store.create({
      data: { id: "store-a", name: "Store A", slug: "store-a", currency: "USD", country: "US" },
    });
  });

  afterEach(async () => integration.close());

  it("imports a normalized workspace without changing the live V3 publication", async () => {
    const document = createDefaultStorefrontDocument("store-a", "minimal");
    const legacy = await integration.database.client.storefrontPublication.create({
      data: {
        id: "legacy-pub",
        storeId: "store-a",
        sourceRevision: 3,
        document,
      },
    });
    await integration.database.client.store.update({
      where: { id: "store-a" },
      data: { currentPublicationId: legacy.id },
    });

    const importer = new PrismaV3StorefrontImporter(
      integration.database.client,
      () => new Date("2026-09-14T00:00:00Z"),
    );
    const result = await importer.import(document);

    expect(result.currentPublicationId).toBe("legacy-pub");
    await expect(integration.database.client.store.findUniqueOrThrow({ where: { id: "store-a" } }))
      .resolves.toMatchObject({ currentPublicationId: "legacy-pub" });
    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 1 });
    expect(await integration.database.client.storefrontTemplate.count({ where: { storeId: "store-a" } })).toBeGreaterThan(0);
    expect(await integration.database.client.globalSection.count({ where: { storeId: "store-a" } })).toBe(2);
  });

  it("refuses to overwrite an initialized normalized workspace", async () => {
    const document = createDefaultStorefrontDocument("store-a", "minimal");
    await integration.database.client.storefrontWorkspace.create({ data: { storeId: "store-a", generation: 4 } });
    const importer = new PrismaV3StorefrontImporter(integration.database.client);

    await expect(importer.import(document)).rejects.toThrow(/already initialized/i);
    await expect(integration.database.client.storefrontWorkspace.findUniqueOrThrow({ where: { storeId: "store-a" } }))
      .resolves.toMatchObject({ generation: 4 });
  });
});
