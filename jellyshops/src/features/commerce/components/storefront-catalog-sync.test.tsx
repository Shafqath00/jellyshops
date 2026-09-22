import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createRepository, memoryStorage, type ShopRepository } from "@/lib/repository";
import { loadCollectionPageContext } from "@/features/storefront/page-context-loaders";

let testRepository: ShopRepository;
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: testRepository }) }));

import { StorefrontCatalogSync, useStorefrontCatalogStatus } from "./storefront-catalog-sync";

function Status() {
  return <span>{useStorefrontCatalogStatus()}</span>;
}

afterEach(() => vi.unstubAllGlobals());

it("hydrates backend Collection descriptions into only the matching public store", async () => {
  testRepository = createRepository(memoryStorage());
  const other = testRepository.createCollection({ storeId: "store-bloom-home", name: "Private", description: "Store B only" });
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    if (input.endsWith("/api/public/storefronts/sweet-bakes")) return Response.json({ store: { id: "store-sweet-bakes", name: "Sweet Bakes", slug: "sweet-bakes", currency: "USD" } });
    if (input.includes("/catalog/products")) return Response.json({ nodes: [], nextCursor: null });
    if (input.includes("/catalog/collections")) return Response.json({ nodes: [
      { id: "cakes", storeId: "store-sweet-bakes", externalId: null, handle: "cakes", title: "Cakes", description: "Baked today", productIds: [] },
      { id: "plain", storeId: "store-sweet-bakes", externalId: null, handle: "plain", title: "Plain", description: "", productIds: [] },
    ], nextCursor: null });
    throw new Error(`Unexpected request: ${input}`);
  }));

  render(<StorefrontCatalogSync storeSlug="sweet-bakes"><Status /></StorefrontCatalogSync>);
  await screen.findByText("ready");
  await waitFor(() => expect(testRepository.getCollections("store-sweet-bakes")).toContainEqual({ id: "cakes", storeId: "store-sweet-bakes", name: "Cakes", slug: "cakes", description: "Baked today" }));
  expect(testRepository.getCollections("store-sweet-bakes").find((item) => item.id === "plain")).not.toHaveProperty("description");
  expect(testRepository.getCollections("store-bloom-home")).toContainEqual(other);
  expect(testRepository.getCollections("store-bloom-home").some((item) => item.id === "cakes")).toBe(false);

  const reader = {
    findCollection: async (handle: string) => testRepository.getCollections("store-sweet-bakes").find((item) => item.slug === handle) ?? null,
    listProducts: async () => testRepository.listProducts("sweet-bakes"),
  };
  expect((await loadCollectionPageContext(reader, "cakes"))?.collection.description).toBe("Baked today");
  expect((await loadCollectionPageContext(reader, "plain"))?.collection).not.toHaveProperty("description");
  expect((await loadCollectionPageContext(reader, "private"))?.collection).toBeUndefined();
});
