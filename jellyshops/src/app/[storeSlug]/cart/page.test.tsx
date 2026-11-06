import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const shop = { hydrated: false };
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a" }) }));
vi.mock("@/features/storefront/storefront-bootstrap", () => ({ useInitialStorefrontPublication: () => null }));
vi.mock("@/features/storefront/components/storefront-shell", () => ({ useThemePresentation: () => ({ shell: { CartPage: ({ lines }: { lines: unknown[] }) => <p>Built-in bag with {lines.length} items</p> }, settings: {} }) }));
// A store without a published design: the built-in bag is the real page once loading has finished.
vi.mock("@/features/storefront/public-storefront-api", () => ({ loadPublicStorefrontPublication: async () => null }));
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

import CartPage from "./page";

describe("cart page", () => {
  beforeEach(() => { shop.hydrated = false; });

  it("shows a loading state until the saved bag is in, instead of an empty bag", () => {
    render(<CartPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your bag…");
    expect(screen.queryByText(/Built-in bag/)).not.toBeInTheDocument();
  });

  it("shows the built-in bag with its items once the bag is in and the store has no published design", async () => {
    shop.hydrated = true;
    render(<CartPage />);
    expect(await screen.findByText("Built-in bag with 1 items")).toBeInTheDocument();
  });
});
