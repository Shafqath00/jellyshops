import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../http/errors.js";
import type { MediaRepository } from "./repository.js";
import { MediaService } from "./service.js";
import type { MediaStorage } from "./storage.js";
import type { StoredMediaRecord } from "./types.js";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function record(overrides: Partial<StoredMediaRecord> = {}): StoredMediaRecord {
  return {
    id: "media-1",
    storeId: "store-a",
    type: "image",
    storageKey: "store-a/media-1.png",
    url: "/api/public/media/store-a/media-1",
    mimeType: "image/png",
    byteSize: tinyPng.length,
    width: 1,
    height: 1,
    originalName: "hero.png",
    altText: null,
    referenced: false,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function setup(existing: StoredMediaRecord[] = []) {
  const records = new Map(existing.map((item) => [item.id, item]));
  const repository: MediaRepository = {
    create: vi.fn(async (input) => {
      const created = { ...input, createdAt: new Date(0).toISOString() };
      records.set(created.id, created);
      return created;
    }),
    get: vi.fn(async (storeId, mediaId) => {
      const item = records.get(mediaId);
      return item?.storeId === storeId ? item : null;
    }),
    list: vi.fn(async (storeId) => [...records.values()].filter((item) => item.storeId === storeId)),
    delete: vi.fn(async (storeId, mediaId) => {
      const item = records.get(mediaId);
      if (!item || item.storeId !== storeId) return null;
      records.delete(mediaId);
      return item;
    }),
  };
  const storage: MediaStorage = {
    put: vi.fn(async ({ storeId, mediaId, extension }) => `${storeId}/${mediaId}.${extension}`),
    open: vi.fn(async () => tinyPng),
    remove: vi.fn(async () => undefined),
  };
  return { repository, storage, service: new MediaService(repository, storage) };
}

describe("MediaService", () => {
  it("uploads bytes and stores metadata separately", async () => {
    const { service, repository, storage } = setup();
    const uploaded = await service.upload("store-a", {
      buffer: tinyPng,
      size: tinyPng.length,
      originalname: "../../hero.png",
    } as Express.Multer.File);

    expect(storage.put).toHaveBeenCalledOnce();
    expect(repository.create).toHaveBeenCalledOnce();
    expect(uploaded.originalName).toBe("hero.png");
    expect(uploaded).not.toHaveProperty("storageKey");
  });

  it("removes written bytes if metadata persistence fails", async () => {
    const { service, repository, storage } = setup();
    vi.mocked(repository.create).mockRejectedValueOnce(new Error("database failed"));

    await expect(service.upload("store-a", {
      buffer: tinyPng,
      size: tinyPng.length,
      originalname: "hero.png",
    } as Express.Multer.File)).rejects.toThrow("database failed");

    expect(storage.remove).toHaveBeenCalledOnce();
  });

  it("rejects referenced media before deleting bytes", async () => {
    const { service, repository, storage } = setup([record({ referenced: true })]);

    await expect(service.remove("store-a", "media-1")).rejects.toMatchObject<ApiError>({
      status: 409,
      code: "MEDIA_IN_USE",
    });
    expect(repository.delete).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("deletes metadata then bytes after validation", async () => {
    const { service, repository, storage } = setup([record()]);

    await service.remove("store-a", "media-1");

    expect(repository.delete).toHaveBeenCalledWith("store-a", "media-1");
    expect(storage.remove).toHaveBeenCalledWith("store-a/media-1.png");
  });
});
