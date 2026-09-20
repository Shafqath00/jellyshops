import {
  createDefaultStorefrontDocument,
  type RuntimeStorefrontSnapshotV4,
} from "@jelly/storefront-schema";
import { expect, it, vi } from "vitest";
import {
  loadPublicStorefrontDocument,
  loadPublicStorefrontPublication,
} from "./public-storefront-api";

it("loads only the published snapshot from the public endpoint", async () => {
  const live = createDefaultStorefrontDocument("store-demo");
  live.regions.template[0].blocks[0].settings.text = "LIVE";
  const fallback = createDefaultStorefrontDocument("store-demo");
  fallback.regions.template[0].blocks[0].settings.text = "FALLBACK";
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    id: "publication-1", storeId: "store-demo", sourceRevision: 2, document: live, publishedAt: "2026-09-04T00:00:00.000Z",
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const result = await loadPublicStorefrontDocument({ baseUrl: "http://localhost:3001", storeId: "store-demo", fallback, fetch: fetcher });

  expect(result.regions.template[0].blocks[0].settings.text).toBe("LIVE");
  expect(fetcher).toHaveBeenCalledWith("http://localhost:3001/api/stores/store-demo/storefront/public", expect.not.objectContaining({ headers: expect.objectContaining({ Authorization: expect.anything() }) }));
  expect(fetcher).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cache: "no-store" }));
});

it("parses a compiled V4 publication without treating it as a V3 document", async () => {
  const snapshot: RuntimeStorefrontSnapshotV4 = {
    schemaVersion: 4,
    storeId: "store-demo",
    sourceGeneration: 12,
    compilerVersion: "2026-09",
    registryManifestHash: "registry-hash",
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: {},
    globalSections: {},
    menus: {},
    templateDefaults: {},
    assignments: [],
    dependencies: { edges: [] },
  };
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    id: "publication-v4",
    storeId: "store-demo",
    sourceRevision: 0,
    document: snapshot,
    publishedAt: "2026-09-13T00:00:00.000Z",
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  await expect(loadPublicStorefrontPublication({
    baseUrl: "http://localhost:3001",
    storeId: "store-demo",
    fetch: fetcher,
  })).resolves.toMatchObject({
    kind: "v4",
    publicationId: "publication-v4",
    snapshot: { schemaVersion: 4, sourceGeneration: 12 },
  });
});

it("uses the last safe storefront when no valid publication exists", async () => {
  const fallback = createDefaultStorefrontDocument("store-demo");
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ document: { unsafe: true } }), { status: 200, headers: { "Content-Type": "application/json" } }));

  await expect(loadPublicStorefrontDocument({ baseUrl: "http://localhost:3001", storeId: "store-demo", fallback, fetch: fetcher })).resolves.toBe(fallback);
});
