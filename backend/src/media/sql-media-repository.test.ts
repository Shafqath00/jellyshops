import { afterEach, describe, expect, it } from "vitest";
import { createPGliteDatabase, seedStore, type IntegrationDatabase } from "../../test/integration/pglite.js";
import { SqlMediaRepository } from "./sql-media-repository.js";

describe("SQL media metadata", () => {
  let db: IntegrationDatabase;
  afterEach(async () => { await db?.close(); });
  it("survives a new repository instance and isolates stores", async () => {
    db = await createPGliteDatabase(); await seedStore(db, "store-a", "a"); await seedStore(db, "store-b", "b");
    const first = new SqlMediaRepository(db);
    await first.create({ id: "image-1", storeId: "store-a", type: "image", storageKey: "a/image.png", url: "/api/public/media/store-a/image-1", mimeType: "image/png", byteSize: 10, width: 1, height: 1, originalName: "image.png", altText: null, referenced: false });
    const second = new SqlMediaRepository(db);
    expect(await second.get("store-a", "image-1")).toMatchObject({ storageKey: "a/image.png", createdAt: expect.any(String) });
    expect(await second.get("store-b", "image-1")).toBeNull();
    expect(await second.delete("store-b", "image-1")).toBeNull();
    expect(await second.list("store-a")).toHaveLength(1);
    expect(await second.delete("store-a", "image-1")).toMatchObject({ id: "image-1" });
  });
  it("enforces content deduplication per store while allowing legacy null hashes", async () => {
    db = await createPGliteDatabase(); await seedStore(db, "store-a", "a"); await seedStore(db, "store-b", "b");
    const repository = new SqlMediaRepository(db);
    const input = { id: "hashed", storeId: "store-a", type: "image" as const, storageKey: "a/image.png", url: "/image", mimeType: "image/png", byteSize: 10, width: 1, height: 1, originalName: "image.png", altText: null, referenced: false, contentHash: "abc" };
    await repository.create(input);
    expect(await repository.findByHash("store-a", "abc")).toMatchObject({ id: "hashed" });
    expect(await repository.findByHash("store-b", "abc")).toBeNull();
    await expect(repository.create({ ...input, id: "duplicate", storageKey: "duplicate.png" })).rejects.toMatchObject({ code: "23505" });
    await repository.create({ ...input, id: "other-store", storeId: "store-b" });
    await repository.create({ ...input, id: "old-1", storageKey: "old-1.png", contentHash: null });
    await repository.create({ ...input, id: "old-2", storageKey: "old-2.png", contentHash: null });
    expect(await repository.list("store-a")).toHaveLength(3);
  });
});
