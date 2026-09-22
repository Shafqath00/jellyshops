import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a", collectionSlug: "cakes" }) }));
vi.mock("@/features/commerce/components/storefront-catalog-sync", () => ({ useStorefrontCatalogStatus: () => "ready" }));
vi.mock("@/features/storefront/public-storefront-api", () => ({ loadPublicStorefrontPublication: async () => ({ kind: "v4", snapshot: { templates: {}, assignments: [] } }) }));
vi.mock("@/features/storefront/resource-loader", () => ({ resolveStorefrontRoute: async (_snapshot: unknown, _route: unknown, reader: { findByHandle(type: string, handle: string): Promise<unknown> }) => ({ status: "ready", context: { pageType: "collection", resource: await reader.findByHandle("collection", "cakes") } }) }));
vi.mock("@/features/storefront/storefront-page", () => ({ PublishedRuntimeStorefront: ({ route }: { route: { context: { resource: { data: { collectionPresentation: { collection: { title: string; description: string }; products: Array<{ id: string; price: string }>; totalProducts: number } } } } } }) => <p>{JSON.stringify(route.context.resource.data.collectionPresentation)}</p> }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: {
  getStoreBySlug: () => ({ id: "store-a", slug: "store-a", currency: "USD" }),
  getCollections: () => [{ id: "collection-a", storeId: "store-a", slug: "cakes", name: "Fresh cakes", description: "Baked today" }],
  listProducts: () => [{ id: "cake", storeId: "store-a", slug: "cake", name: "Cake", description: "", category: "", imageUrl: "/cake.jpg", published: true, archived: false, featured: false, collectionIds: ["collection-a"], variants: [{ id: "slice", name: "Slice", sku: "CAKE", priceMinor: 1200, stock: 2 }] }],
} }) }));

import CollectionPage from "./page";

it("passes live Collection identity and formatted products to the shared V4 renderer", async () => {
  render(<CollectionPage />);
  const output = await screen.findByText(/"title":"Fresh cakes"/);
  expect(output).toHaveTextContent('"description":"Baked today"');
  expect(output).toHaveTextContent('"id":"cake"');
  expect(output).toHaveTextContent('"price":"$12.00"');
  expect(output).toHaveTextContent('"totalProducts":1');
});
