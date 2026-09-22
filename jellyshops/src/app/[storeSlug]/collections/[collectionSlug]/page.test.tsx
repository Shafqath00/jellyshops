import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const metadata = vi.hoisted(() => ({ description: "Baked today" as string | undefined, imageUrl: undefined as string | undefined }));

vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a", collectionSlug: "cakes" }) }));
vi.mock("@/features/commerce/components/storefront-catalog-sync", () => ({ useStorefrontCatalogStatus: () => "ready" }));
vi.mock("@/features/storefront/public-storefront-api", () => ({ loadPublicStorefrontPublication: async () => ({ kind: "v4", snapshot: { templates: {}, assignments: [] } }) }));
vi.mock("@/features/storefront/resource-loader", () => ({ resolveStorefrontRoute: async (_snapshot: unknown, _route: unknown, reader: { findByHandle(type: string, handle: string): Promise<unknown> }) => ({ status: "ready", context: { pageType: "collection", resource: await reader.findByHandle("collection", "cakes") } }) }));
vi.mock("@/features/storefront/storefront-page", () => ({ PublishedRuntimeStorefront: ({ route }: { route: { context: { resource: { data: { collectionPresentation: { collection: { title: string; description: string }; products: Array<{ id: string; price: string }>; totalProducts: number } } } } } }) => <p>{JSON.stringify(route.context.resource.data.collectionPresentation)}</p> }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: {
  getStoreBySlug: () => ({ id: "store-a", slug: "store-a", currency: "USD" }),
  getCollections: () => [{ id: "collection-a", storeId: "store-a", slug: "cakes", name: "Fresh cakes", ...(metadata.description ? { description: metadata.description } : {}), ...(metadata.imageUrl ? { imageUrl: metadata.imageUrl } : {}) }],
  listProducts: () => [{ id: "cake", storeId: "store-a", slug: "cake", name: "Cake", description: "", category: "", imageUrl: "/cake.jpg", published: true, archived: false, featured: false, collectionIds: ["collection-a"], variants: [{ id: "slice", name: "Slice", sku: "CAKE", priceMinor: 1200, stock: 2 }] }],
} }) }));

import CollectionPage from "./page";

afterEach(() => { metadata.description = "Baked today"; metadata.imageUrl = undefined; });

it("passes live Collection identity and formatted products to the shared V4 renderer", async () => {
  render(<CollectionPage />);
  const output = await screen.findByText(/"title":"Fresh cakes"/);
  expect(output).toHaveTextContent('"description":"Baked today"');
  expect(output).toHaveTextContent('"id":"cake"');
  expect(output).toHaveTextContent('"price":"$12.00"');
  expect(output).toHaveTextContent('"totalProducts":1');
  expect(JSON.parse(output.textContent ?? "").collection).not.toHaveProperty("imageUrl");
});

it("keeps absent description empty and renders an existing local Collection image", async () => {
  metadata.description = undefined;
  metadata.imageUrl = "/legacy-collection.jpg";
  render(<CollectionPage />);
  const output = await screen.findByText(/"imageUrl":"\/legacy-collection.jpg"/);
  expect(JSON.parse(output.textContent ?? "").collection).toEqual({ id: "collection-a", title: "Fresh cakes", description: "", imageUrl: "/legacy-collection.jpg" });
});
