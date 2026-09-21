import { describe, expect, it, vi } from "vitest";
import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { ImmutablePublicationCache, StorefrontRuntimeService } from "./service.js";

function snapshot(
  id: string,
  storeId = "store-a",
): RuntimeStorefrontSnapshotV4 {
  return {
    schemaVersion: 4,
    storeId,
    sourceGeneration: id === "pub-1" ? 1 : 2,
    compilerVersion: "2026-01",
    registryManifestHash: "registry",
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: {}, globalSections: {}, menus: {}, templateDefaults: {}, assignments: [], dependencies: { edges: [] },
  };
}

describe("immutable publication runtime cache", () => {
  it("loads an immutable publication only once per publication id", async () => {
    const loader = vi.fn(async (publicationId: string) => snapshot(publicationId));
    const cache = new ImmutablePublicationCache(loader);

    await cache.get("pub-1");
    await cache.get("pub-1");
    await cache.get("pub-1");

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("returns the pointer id and loads a new snapshot when the live publication pointer changes", async () => {
    let currentPublicationId = "pub-1";
    const pointer = { getCurrentPublicationId: vi.fn(async () => currentPublicationId) };
    const loader = vi.fn(async (publicationId: string) => snapshot(publicationId));
    const service = new StorefrontRuntimeService(pointer, new ImmutablePublicationCache(loader));

    await expect(service.getPublishedPublication("store-a")).resolves.toEqual({
      id: "pub-1",
      snapshot: expect.objectContaining({ sourceGeneration: 1 }),
    });
    currentPublicationId = "pub-2";
    await expect(service.getPublishedPublication("store-a")).resolves.toEqual({
      id: "pub-2",
      snapshot: expect.objectContaining({ sourceGeneration: 2 }),
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("returns null for an unpublished store without attempting a snapshot load", async () => {
    const pointer = { getCurrentPublicationId: vi.fn(async () => null) };
    const loader = vi.fn(async () => snapshot("pub-1"));
    const service = new StorefrontRuntimeService(pointer, new ImmutablePublicationCache(loader));

    await expect(service.getPublishedPublication("store-a")).resolves.toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });

  it("returns null when the pointed immutable publication is missing", async () => {
    const pointer = { getCurrentPublicationId: vi.fn(async () => "pub-missing") };
    const loader = vi.fn(async () => null);
    const service = new StorefrontRuntimeService(pointer, new ImmutablePublicationCache(loader));

    await expect(service.getPublishedPublication("store-a")).resolves.toBeNull();
    expect(loader).toHaveBeenCalledWith("pub-missing");
  });

  it("fails closed when the pointed snapshot belongs to another store", async () => {
    const pointer = { getCurrentPublicationId: vi.fn(async () => "pub-b") };
    const loader = vi.fn(async () => snapshot("pub-b", "store-b"));
    const service = new StorefrontRuntimeService(pointer, new ImmutablePublicationCache(loader));

    await expect(service.getPublishedPublication("store-a")).resolves.toBeNull();
  });
});
