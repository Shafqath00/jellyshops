import { describe, expect, it, vi } from "vitest";
import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { ImmutablePublicationCache, StorefrontRuntimeService } from "./service.js";

function snapshot(id: string): RuntimeStorefrontSnapshotV4 {
  return {
    schemaVersion: 4,
    storeId: "store-a",
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

  it("loads a new snapshot when the live publication pointer changes", async () => {
    let currentPublicationId = "pub-1";
    const pointer = { getCurrentPublicationId: vi.fn(async () => currentPublicationId) };
    const loader = vi.fn(async (publicationId: string) => snapshot(publicationId));
    const service = new StorefrontRuntimeService(pointer, new ImmutablePublicationCache(loader));

    await expect(service.getPublishedSnapshot("store-a")).resolves.toMatchObject({ sourceGeneration: 1 });
    currentPublicationId = "pub-2";
    await expect(service.getPublishedSnapshot("store-a")).resolves.toMatchObject({ sourceGeneration: 2 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("returns null for an unpublished store without attempting a snapshot load", async () => {
    const pointer = { getCurrentPublicationId: vi.fn(async () => null) };
    const loader = vi.fn(async () => snapshot("pub-1"));
    const service = new StorefrontRuntimeService(pointer, new ImmutablePublicationCache(loader));

    await expect(service.getPublishedSnapshot("store-a")).resolves.toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });
});
