import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const loadPublication = vi.fn();
const loadArticle = vi.fn();

vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a", blogSlug: "news", articleSlug: "opening" }) }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: { getStoreBySlug: () => ({ id: "store-a", slug: "store-a", currency: "USD" }), listProducts: () => [] }, state: { products: [] } }) }));
vi.mock("@/features/storefront/public-storefront-api", () => ({ loadPublicStorefrontPublication: (...args: unknown[]) => loadPublication(...args) }));
vi.mock("@/features/storefront/public-page-context-api", () => ({ loadPublicArticleContext: (...args: unknown[]) => loadArticle(...args) }));
vi.mock("@/features/storefront/storefront-page", () => ({ PublishedRuntimeStorefront: ({ route }: { route: { template: { id: string } } }) => <div data-testid="v4-article">{route.template.id}</div> }));

import ArticlePage from "./page";

beforeEach(() => {
  loadPublication.mockResolvedValue({ kind: "v4", publicationId: "pub-a", snapshot: { schemaVersion: 4, storeId: "store-a", sourceGeneration: 1, compilerVersion: "test", registryManifestHash: "hash", theme: { presetId: "minimal", settings: {}, artifactId: null }, templates: { article: { id: "article", type: "article", handle: "default", layout: { sections: [] } } }, globalSections: {}, menus: {}, templateDefaults: { article: "article" }, assignments: [], dependencies: { edges: [] } } });
  loadArticle.mockResolvedValue({ type: "article", blog: { id: "blog-a", handle: "news", title: "News" }, article: { id: "article-a", handle: "opening", title: "Opening", excerpt: "We opened", content: { text: "Hello" }, publishedAt: "2026-09-20T00:00:00.000Z" } });
});

it("renders a published V4 Article template from its current-store Blog context", async () => {
  render(<ArticlePage />);
  await waitFor(() => expect(screen.getByTestId("v4-article")).toHaveTextContent("article"));
  expect(loadPublication).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-a" }));
  expect(loadArticle).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-a", blogHandle: "news", articleHandle: "opening" }));
});
