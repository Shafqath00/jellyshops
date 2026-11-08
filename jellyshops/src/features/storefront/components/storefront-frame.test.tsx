import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { StorefrontFrame } from "./storefront-frame";

const fixture = vi.hoisted(() => ({ pathname: "/new/search", publication: null as unknown, store: { id: "store-1", name: "New", slug: "new", theme: {} } }));
vi.mock("next/navigation", () => ({ usePathname: () => fixture.pathname }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: { getStoreBySlug: () => fixture.store, getCartForStore: () => null }, state: { version: 1, products: [], collections: [] } }) }));
vi.mock("@/features/storefront/storefront-bootstrap", () => ({ useInitialStorefrontPublication: () => fixture.publication }));
vi.mock("@/features/storefront/public-storefront-api", () => ({ loadPublicStorefrontPublication: async () => fixture.publication }));
vi.mock("./cart-panel", () => ({ CartPanel: () => null }));

function publication() {
  const snapshot: RuntimeStorefrontSnapshotV4 = {
    schemaVersion: 4, storeId: "store-1", sourceGeneration: 1, compilerVersion: "test", registryManifestHash: "test",
    theme: { presetId: "jelly-avenue", id: "jelly-avenue", version: "1.0.0", settings: {}, artifactId: null },
    templates: {}, templateDefaults: { home: "home", search: "search" }, globalSections: {}, menus: {}, assignments: [], dependencies: { edges: [] },
  };
  for (const group of ["old-theme", "home", "search"] as const) {
    for (const type of ["announcement-bar", "header", "footer"]) {
      const id = `${group}-${type}`;
      snapshot.globalSections[id] = { id, section: { id, type, enabled: true, settings: { text: type === "announcement-bar" ? `${group} announcement` : `${group} footer` }, blocks: [] } };
    }
    if (group !== "old-theme") snapshot.templates[group] = { id: group, type: group, handle: "default", layout: { sections: ["announcement-bar", "header", "footer"].map(type => ({ kind: "global", globalSectionId: `${group}-${type}` })) } };
  }
  return { kind: "v4" as const, publicationId: "publication-1", snapshot };
}

afterEach(() => { fixture.pathname = "/new/search"; });

describe("published storefront frame", () => {
  it("renders only the current template's chrome when old theme sections remain saved", async () => {
    fixture.publication = publication();
    render(<StorefrontFrame storeSlug="new"><main>Search content</main></StorefrontFrame>);
    await waitFor(() => expect(screen.getAllByRole("banner")).toHaveLength(1));
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(screen.getByText("search announcement")).toBeVisible();
    expect(screen.queryByText("old-theme announcement")).toBeNull();
    expect(screen.queryByText("home announcement")).toBeNull();
    expect(screen.getByText("Search content")).toBeVisible();
  });

  it("uses the new route's referenced sections when navigating within the store", async () => {
    fixture.publication = publication();
    const { rerender } = render(<StorefrontFrame storeSlug="new"><main>Content</main></StorefrontFrame>);
    await screen.findByText("search announcement");
    fixture.pathname = "/new";
    rerender(<StorefrontFrame storeSlug="new"><main>Content</main></StorefrontFrame>);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getByText("home announcement")).toBeVisible();
    expect(screen.queryByText("search announcement")).toBeNull();
  });
});
