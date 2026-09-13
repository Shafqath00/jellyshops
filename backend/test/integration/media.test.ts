import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaMediaRepository } from "../../src/media/prisma-media-repository.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seedStore(database: IntegrationDatabase, id: string, slug: string) {
  return database.database.client.store.create({
    data: {
      id,
      name: id,
      slug,
      currency: "USD",
      country: "US",
    },
  });
}

describe("PrismaMediaRepository", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
  });

  afterEach(async () => {
    await integration.close();
  });

  it("creates and lists metadata only inside its store", async () => {
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
    const repository = new PrismaMediaRepository(integration.database.client);

    const created = await repository.create({
      id: "media-a",
      storeId: "store-a",
      type: "image",
      storageKey: "store-a/media-a.png",
      url: "/api/public/media/store-a/media-a",
      mimeType: "image/png",
      byteSize: 64,
      width: 1,
      height: 1,
      originalName: "hero.png",
      altText: null,
      referenced: false,
    });

    expect(created).toMatchObject({ id: "media-a", storeId: "store-a", storageKey: "store-a/media-a.png" });
    expect(await repository.list("store-a")).toHaveLength(1);
    expect(await repository.list("store-b")).toEqual([]);
    expect(await repository.get("store-b", "media-a")).toBeNull();
  });

  it("rejects metadata for a missing store", async () => {
    const repository = new PrismaMediaRepository(integration.database.client);

    await expect(repository.create({
      id: "media-missing-store",
      storeId: "missing-store",
      type: "image",
      storageKey: "missing-store/media.png",
      url: "/api/public/media/missing-store/media-missing-store",
      mimeType: "image/png",
      byteSize: 64,
      width: 1,
      height: 1,
      originalName: "hero.png",
      altText: null,
      referenced: false,
    })).rejects.toBeTruthy();
  });

  it("deletes only through the owning store scope", async () => {
    await seedStore(integration, "store-a", "store-a");
    await seedStore(integration, "store-b", "store-b");
    const repository = new PrismaMediaRepository(integration.database.client);
    await repository.create({
      id: "media-a",
      storeId: "store-a",
      type: "image",
      storageKey: "store-a/media-a.png",
      url: "/api/public/media/store-a/media-a",
      mimeType: "image/png",
      byteSize: 64,
      width: 1,
      height: 1,
      originalName: "hero.png",
      altText: null,
      referenced: false,
    });

    expect(await repository.delete("store-b", "media-a")).toBeNull();
    expect(await repository.delete("store-a", "media-a")).toMatchObject({ id: "media-a" });
    expect(await repository.get("store-a", "media-a")).toBeNull();
  });
});
