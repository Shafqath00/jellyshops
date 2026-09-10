import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { expect, it, vi } from "vitest";
import { loadPublicStorefrontDocument } from "./public-storefront-api";

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
});

it("uses the last safe storefront when no valid publication exists", async () => {
  const fallback = createDefaultStorefrontDocument("store-demo");
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ document: { unsafe: true } }), { status: 200, headers: { "Content-Type": "application/json" } }));

  await expect(loadPublicStorefrontDocument({ baseUrl: "http://localhost:3001", storeId: "store-demo", fallback, fetch: fetcher })).resolves.toBe(fallback);
});
