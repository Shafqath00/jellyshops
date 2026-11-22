import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const shop = { hydrated: false };
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a" }) }));
const design: { publication: unknown } = { publication: null };
vi.mock("@/features/storefront/storefront-bootstrap", () => ({ useInitialStorefrontPublication: () => design.publication }));
vi.mock("@/features/storefront/storefront-page", () => ({ PublishedRuntimeStorefront: ({ route }: { route: { context: { data?: { pending?: boolean } } } }) => <div data-testid="themed-bag">{route.context.data?.pending ? "pending" : "ready"}</div> }));
vi.mock("@/features/storefront/components/storefront-shell", () => ({ useThemePresentation: () => ({ shell: { CartPage: ({ lines }: { lines: unknown[] }) => <p>Built-in bag with {lines.length} items</p> }, settings: {} }) }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({
  hydrated: shop.hydrated,
  state: { products: [{ id: "cake", name: "Cake", variants: [{ id: "small", name: "Small", priceMinor: 1200, stock: 5 }], options: [] }] },
  repository: {
    getStoreBySlug: () => ({ id: "store-a", slug: "store-a", name: "Store A", currency: "GBP" }),
    getCartForStore: () => ({ id: "cart-a", items: [{ variantId: "small", quantity: 2 }] }),
    updateCartItem: vi.fn(),
  },
}) }));
vi.mock("@/lib/product-media", () => ({ cartProductImage: () => "" }));

import CartPage from "./cart-client";

describe("cart page", () => {
  beforeEach(() => { shop.hydrated = false; design.publication = null; });

  it("shows a loading state until the saved bag is in, instead of an empty bag", () => {
    render(<CartPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your bag…");
    expect(screen.queryByText(/Built-in bag/)).not.toBeInTheDocument();
  });

  it("draws the store's own bag page straight away, with the bag section waiting for the saved bag", () => {
    design.publication = { kind: "v4", publicationId: "pub-a", snapshot: { schemaVersion: 4, storeId: "store-a", sourceGeneration: 1, compilerVersion: "test", registryManifestHash: "hash", theme: { presetId: "minimal", settings: {}, artifactId: null }, templates: { cart: { id: "cart", type: "cart", handle: "default", layout: { sections: [] } } }, globalSections: {}, menus: {}, templateDefaults: { cart: "cart" }, assignments: [], dependencies: { edges: [] } } };
    render(<CartPage />);
    expect(screen.getByTestId("themed-bag")).toHaveTextContent("pending");
  });

  it("shows the built-in bag with its items once the bag is in and the store has no published design", async () => {
    shop.hydrated = true;
    render(<CartPage />);
    expect(await screen.findByText("Built-in bag with 1 items")).toBeInTheDocument();
  });
});
