import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateCartItem = vi.fn();
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "store-a", productSlug: "cake" }) }));
vi.mock("@/components/storefront-shell", () => ({ useThemePresentation: () => ({ shell: { ProductPage: () => <p>Legacy product</p> }, settings: {} }) }));
vi.mock("@/features/commerce/components/storefront-catalog-sync", () => ({ useStorefrontCatalogStatus: () => "ready" }));
vi.mock("@/features/storefront/public-storefront-api", () => ({ loadPublicStorefrontPublication: async () => ({ kind: "v4", snapshot: { templateDefaults: { product: "product-default" }, templates: { "product-default": { id: "product-default", type: "product", layout: { sections: [] } } }, globalSections: {}, assignments: [], theme: { presetId: "minimal", settings: {} } } }) }));
vi.mock("@/features/storefront/resource-loader", () => ({ resolveStorefrontRoute: async (_snapshot: unknown, _route: unknown, reader: { findByHandle: (type: string, handle: string) => Promise<unknown> }) => ({ status: "ready", layout: { announcement: [], header: [], template: [], footer: [] }, context: { pageType: "product", resource: await reader.findByHandle("product", "cake") } }) }));
vi.mock("@/features/storefront/storefront-page", () => ({ PublishedRuntimeStorefront: ({ route }: { route: { context: { resource: { data: { productPresentation: { quantity: number; addToCart: () => Promise<unknown>; setQuantity: (value: number) => void } } } } } }) => <><p>Quantity {route.context.resource.data.productPresentation.quantity}</p><button onClick={() => route.context.resource.data.productPresentation.setQuantity(2)}>Choose quantity</button><button onClick={() => void route.context.resource.data.productPresentation.addToCart()}>Add to cart</button></> }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: {
  getStoreBySlug: () => ({ id: "store-a", slug: "store-a", currency: "USD" }),
  getProductBySlug: () => ({ id: "cake", storeId: "store-a", name: "Cake", slug: "cake", description: "Fresh", category: "Cakes", imageUrl: "", published: true, archived: false, featured: false, variants: [{ id: "small", name: "Small", sku: "CAKE", priceMinor: 1200, stock: 4 }], options: [] }),
  listProducts: () => [], getCartForStore: () => ({ id: "cart-a", items: [] }), createCart: () => ({ id: "cart-a", items: [] }), updateCartItem,
} }) }));

import ProductPage from "./page";

describe("V4 Product route", () => {
  beforeEach(() => updateCartItem.mockReset());

  it("passes live quantity and cart actions to the shared V4 Product renderer", async () => {
    render(<ProductPage />);
    await screen.findByText("Quantity 1");
    await userEvent.click(screen.getByRole("button", { name: "Choose quantity" }));
    await screen.findByText("Quantity 2");
    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(updateCartItem).toHaveBeenCalledWith("cart-a", "small", 2, [], 1200);
  });
});
