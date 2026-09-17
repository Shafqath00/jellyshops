import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const upload = vi.fn();
  const download = vi.fn();
  const remove = vi.fn();

  const from = vi.fn(() => ({
    upload,
    download,
    remove,
  }));

  return {
    upload,
    download,
    remove,
    from,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: mocks.from,
    },
  })),
}));

import { SupabaseMediaStorage } from "./supabase-media-storage.js";

describe("SupabaseMediaStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads media using the store and media ids", async () => {
    mocks.upload.mockResolvedValue({
      data: { path: "store-1/media-1.webp" },
      error: null,
    });

    const storage = new SupabaseMediaStorage(
      "https://example.supabase.co",
      "secret-key",
      "media",
    );

    const contents = Buffer.from("image");

    const storageKey = await storage.put({
      storeId: "store-1",
      mediaId: "media-1",
      extension: "webp",
      contents,
    });

    expect(storageKey).toBe("store-1/media-1.webp");

    expect(mocks.from).toHaveBeenCalledWith("media");

    expect(mocks.upload).toHaveBeenCalledWith(
      "store-1/media-1.webp",
      contents,
      {
        upsert: false,
      },
    );
  });

  it("downloads media", async () => {
    mocks.download.mockResolvedValue({
      data: new Blob([new Uint8Array([1, 2, 3])]),
      error: null,
    });

    const storage = new SupabaseMediaStorage(
      "https://example.supabase.co",
      "secret-key",
      "media",
    );

    const result = await storage.open("store-1/media-1.webp");

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from([1, 2, 3]));
  });

  it("returns null when media does not exist", async () => {
    mocks.download.mockResolvedValue({
      data: null,
      error: {
        statusCode: "404",
        message: "Object not found",
      },
    });

    const storage = new SupabaseMediaStorage(
      "https://example.supabase.co",
      "secret-key",
      "media",
    );

    await expect(
      storage.open("store-1/missing.webp"),
    ).resolves.toBeNull();
  });

  it("removes media", async () => {
    mocks.remove.mockResolvedValue({
      data: [],
      error: null,
    });

    const storage = new SupabaseMediaStorage(
      "https://example.supabase.co",
      "secret-key",
      "media",
    );

    await storage.remove("store-1/media-1.webp");

    expect(mocks.remove).toHaveBeenCalledWith([
      "store-1/media-1.webp",
    ]);
  });
});