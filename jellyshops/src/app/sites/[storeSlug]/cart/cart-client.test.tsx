import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const shop = { hydrated: false };
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a" }) }));
const design: { publication: unknown } = { publication: null };
vi.mock("@/features/storefront/storefront-bootstrap", () => ({ useInitialStorefrontPublication: () => design.publication }));
vi.mock("@/features/storefront/storefront-page", () => ({ PublishedRuntimeStorefront: ({ route }: { route: { context: { data?: { pending?: boolean; discounts?: Array<{ title: string; amount: string }>; total?: string } } } }) => <div data-testid="themed-bag">{route.context.data?.pending ? "pending" : "ready"}{route.context.data?.discounts?.map((line) => <span key={line.title}>{line.title} {line.amount}</span>)}{route.context.data?.total ? <span>Total {route.context.data.total}</span> : null}</div> }));
const bagDiscounts: { preview: unknown } = { preview: null };
vi.mock("@/features/checkout/use-bag-discounts", () => ({ useBagDiscounts: () => ({ preview: bagDiscounts.preview, codeProblem: null, pending: false }) }));
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
  beforeEach(() => { shop.hydrated = false; design.publication = null; bagDiscounts.preview = null; });
  const publication = { kind: "v4", publicationId: "pub-a", snapshot: { schemaVersion: 4, storeId: "store-a", sourceGeneration: 1, compilerVersion: "test", registryManifestHash: "hash", theme: { presetId: "minimal", settings: {}, artifactId: null }, templates: { cart: { id: "cart", type: "cart", handle: "default", layout: { sections: [] } } }, globalSections: {}, menus: {}, templateDefaults: { cart: "cart" }, assignments: [], dependencies: { edges: [] } } };

  it("shows the shop's automatic discounts and the total after them", () => {
    shop.hydrated = true;
    design.publication = publication;
    bagDiscounts.preview = { code: null, label: null, subtotalMinor: 2400, discountMinor: 240, shippingMinor: 0, totalMinor: 2160, currency: "GBP", discounts: [
      { title: "Cake week", code: null, type: "order_amount", label: "10% off the whole order", amountMinor: 240, shippingMinor: 0 },
      { title: "Free delivery", code: null, type: "free_shipping", label: "Free shipping", amountMinor: 0, shippingMinor: 400 },
    ] };
    render(<CartPage />);
    expect(screen.getByText("Cake week −£2.40")).toBeInTheDocument();
    expect(screen.getByText("Free delivery Free delivery")).toBeInTheDocument();
    expect(screen.getByText("Total £21.60")).toBeInTheDocument();
  });

  it("ignores an answer for a different bag", () => {
    shop.hydrated = true;
    design.publication = publication;
    bagDiscounts.preview = { code: null, label: null, subtotalMinor: 9999, discountMinor: 100, shippingMinor: 0, totalMinor: 9899, currency: "GBP", discounts: [{ title: "Old", code: null, type: "order_amount", label: "", amountMinor: 100, shippingMinor: 0 }] };
    render(<CartPage />);
    expect(screen.queryByText(/Old/)).not.toBeInTheDocument();
  });

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
