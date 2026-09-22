import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/domain";
import { catalogProductToProduct, createProductPresentationContext } from "./product-presentation";

const product: Product = {
  id: "cake", storeId: "store-a", name: "Celebration cake", slug: "celebration-cake", description: "Vanilla sponge", category: "Cakes", imageUrl: "/cake.jpg", published: true, archived: false, featured: false,
  variants: [{ id: "small", name: "Small", sku: "CAKE-S", priceMinor: 1200, stock: 2, options: { size: "small" } }, { id: "large", name: "Large", sku: "CAKE-L", priceMinor: 2400, stock: 5, options: { size: "large" } }],
  inventoryOptionIds: ["size"],
  options: [{ id: "size", name: "Size", type: "variant", display: "buttons", required: true, position: 0, values: [{ id: "small", label: "Small", priceAdjustmentMinor: 0, position: 0 }, { id: "large", label: "Large", priceAdjustmentMinor: 0, position: 1 }] }],
};

describe("createProductPresentationContext", () => {
  it("requires a live required option before purchase", async () => {
    const addToCart = vi.fn();
    const context = createProductPresentationContext({ product, currency: "USD", selections: [], quantity: 1, onSelectionsChange: vi.fn(), onQuantityChange: vi.fn(), onAddToCart: addToCart });

    expect(context.availability).toMatchObject({ state: "selection-required", maxQuantity: 0 });
    expect(context.canAddToCart).toBe(false);
    await expect(context.addToCart()).resolves.toEqual({ ok: false, message: "Choose the required options" });
    expect(addToCart).not.toHaveBeenCalled();
  });

  it("clamps quantity to live variant stock and delegates add-to-cart", async () => {
    const onQuantityChange = vi.fn();
    const addToCart = vi.fn().mockResolvedValue({ ok: true });
    const context = createProductPresentationContext({ product, currency: "USD", selections: [{ optionId: "size", valueId: "small" }], quantity: 9, onSelectionsChange: vi.fn(), onQuantityChange, onAddToCart: addToCart });

    expect(context.quantity).toBe(2);
    context.setQuantity(99);
    expect(onQuantityChange).toHaveBeenCalledWith(2);
    await expect(context.addToCart()).resolves.toEqual({ ok: true });
    expect(addToCart).toHaveBeenCalledWith({ variantId: "small", quantity: 2, selections: [{ optionId: "size", valueId: "small" }], priceMinor: 1200 });
  });

  it("preserves catalog detail media, options, compare-at price, and availability for the shared contract", () => {
    const catalogProduct = catalogProductToProduct({
      id: "cake", storeId: "store-a", handle: "celebration-cake", title: "Celebration cake", description: "Vanilla sponge", vendor: "Jelly Bakery", productType: "Cakes", status: "ACTIVE", available: true,
      media: [{ id: "hero", url: "/hero.jpg", altText: "Cake", position: 0 }, { id: "side", url: "/side.jpg", altText: null, position: 1 }],
      options: product.options, inventoryOptionIds: ["size"], variants: [{ id: "small", title: "Small", sku: "CAKE-S", priceMinor: 1200, compareAtPriceMinor: 1500, quantity: 2, available: true, options: { size: "small" } }],
    });
    const context = createProductPresentationContext({ product: catalogProduct, currency: "USD", selections: [{ optionId: "size", valueId: "small" }], quantity: 1, onSelectionsChange: vi.fn(), onQuantityChange: vi.fn(), onAddToCart: vi.fn() });

    expect(context).toMatchObject({
      product: { vendor: "Jelly Bakery", media: [{ id: "hero", url: "/hero.jpg" }, { id: "side", url: "/side.jpg" }] },
      pricing: { compareAtPrice: "$15.00" }, availability: { state: "available", maxQuantity: 2 },
    });
  });
});
