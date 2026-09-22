import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const loadPublication = vi.fn();
const loadContext = vi.fn();

vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a" }), useSearchParams: () => new URLSearchParams("q=shoes") }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: { getStoreBySlug: () => ({ id: "store-a", slug: "store-a", name: "Store A", currency: "USD" }), listProducts: () => [] }, state: { products: [] } }) }));
vi.mock("@/components/storefront-shell", () => ({ useThemePresentation: () => ({ shell: { SearchPage: () => <div>legacy search</div> }, settings: {} }) }));
vi.mock("@/features/storefront/public-storefront-api", () => ({ loadPublicStorefrontPublication: (...args: unknown[]) => loadPublication(...args) }));
vi.mock("@/features/storefront/public-page-context-api", () => ({ loadPublicSearchPageContext: (...args: unknown[]) => loadContext(...args) }));
vi.mock("@/features/storefront/storefront-page", () => ({ PublishedRuntimeStorefront: ({ route }: { route: { template: { id: string } } }) => <div data-testid="v4-search">{route.template.id}</div> }));

import SearchPage from "./page";

beforeEach(() => {
  loadPublication.mockResolvedValue({ kind: "v4", publicationId: "pub-a", snapshot: { schemaVersion: 4, storeId: "store-a", sourceGeneration: 1, compilerVersion: "test", registryManifestHash: "hash", theme: { presetId: "minimal", settings: {}, artifactId: null }, templates: { search: { id: "search", type: "search", handle: "default", layout: { sections: [] } } }, globalSections: {}, menus: {}, templateDefaults: { search: "search" }, assignments: [], dependencies: { edges: [] } } });
  loadContext.mockResolvedValue({ type: "search", query: "shoes", state: "none", resultCount: 0, results: [] });
});

it("renders a published V4 Search template from anonymous live context", async () => {
  render(<SearchPage />);
  await waitFor(() => expect(screen.getByTestId("v4-search")).toHaveTextContent("search"));
  expect(loadContext).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-a", query: "shoes" }));
  expect(loadPublication).toHaveBeenCalledWith(expect.objectContaining({ storeId: "store-a" }));
});
