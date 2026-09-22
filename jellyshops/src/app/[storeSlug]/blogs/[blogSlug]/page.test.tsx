import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const loadPublication = vi.fn();
const loadBlog = vi.fn();

vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a", blogSlug: "news" }) }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: { getStoreBySlug: () => ({ id: "store-a", slug: "store-a", currency: "USD" }), listProducts: () => [] }, state: { products: [] } }) }));
vi.mock("@/features/storefront/public-storefront-api", () => ({ loadPublicStorefrontPublication: (...args: unknown[]) => loadPublication(...args) }));
vi.mock("@/features/storefront/public-page-context-api", () => ({ loadPublicBlogContext: (...args: unknown[]) => loadBlog(...args) }));
vi.mock("@/features/storefront/storefront-page", () => ({ PublishedRuntimeStorefront: ({ route }: { route: { template: { id: string } } }) => <div data-testid="v4-blog">{route.template.id}</div> }));

import BlogPage from "./page";

beforeEach(() => {
  loadPublication.mockResolvedValue({ kind: "v4", publicationId: "pub-a", snapshot: { schemaVersion: 4, storeId: "store-a", sourceGeneration: 1, compilerVersion: "test", registryManifestHash: "hash", theme: { presetId: "minimal", settings: {}, artifactId: null }, templates: { blog: { id: "blog", type: "blog", handle: "default", layout: { sections: [] } } }, globalSections: {}, menus: {}, templateDefaults: { blog: "blog" }, assignments: [], dependencies: { edges: [] } } });
  loadBlog.mockResolvedValue({ type: "blog", blog: { id: "blog-a", handle: "news", title: "News" }, articles: [] });
});

it("renders a published V4 Blog template from the current-store public context", async () => {
  render(<BlogPage />);
  await waitFor(() => expect(screen.getByTestId("v4-blog")).toHaveTextContent("blog"));
  expect(loadPublication).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-a" }));
  expect(loadBlog).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-a", handle: "news" }));
});
