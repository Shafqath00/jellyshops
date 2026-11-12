import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const publication = { kind: "v4", publicationId: "pub-a", snapshot: { schemaVersion: 4, storeId: "store-a", sourceGeneration: 1, compilerVersion: "test", registryManifestHash: "hash", theme: { presetId: "minimal", settings: {}, artifactId: null }, templates: { search: { id: "search", type: "search", handle: "default", layout: { sections: [] } } }, globalSections: {}, menus: {}, templateDefaults: { search: "search" }, assignments: [], dependencies: { edges: [] } } };

vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a" }), useSearchParams: () => new URLSearchParams("q=shoes") }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: { getStoreBySlug: () => ({ id: "store-a", slug: "store-a", name: "Store A", currency: "USD" }), listProducts: () => [] }, state: { products: [] } }) }));
vi.mock("@/features/storefront/components/storefront-shell", () => ({ useThemePresentation: () => ({ shell: { SearchPage: () => <div>legacy search</div> }, settings: {} }) }));
vi.mock("@/features/storefront/storefront-bootstrap", () => ({ useInitialStorefrontPublication: () => publication }));
vi.mock("@/features/storefront/storefront-page", () => ({ PublishedRuntimeStorefront: ({ route }: { route: { template: { id: string }; context: { data: { query: string; state: string } } } }) => <div data-testid="v4-search">{route.template.id}:{route.context.data.query}:{route.context.data.state}</div> }));

import SearchPage from "./search-client";

it("renders the published Search template from the server's results on the first render", () => {
  render(<SearchPage searchContext={{ type: "search", query: "shoes", state: "none", resultCount: 0, results: [] }} />);
  expect(screen.getByTestId("v4-search")).toHaveTextContent("search:shoes:none");
});

it("still draws the Search template when the search service gave no answer", () => {
  render(<SearchPage searchContext={null} />);
  expect(screen.getByTestId("v4-search")).toHaveTextContent("search:shoes:none");
});
