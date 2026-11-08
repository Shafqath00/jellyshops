import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/domain";
import { createProductPresentationContext } from "./product-presentation";

const product = (largeExtra: Record<string, unknown> = {}): Product => ({
  id: "cake", storeId: "store-a", name: "Celebration cake", slug: "celebration-cake", description: "Vanilla sponge", category: "Cakes", imageUrl: "/cake.jpg", published: true, archived: false, featured: false,
  variants: [
    { id: "small", name: "Small", sku: "CAKE-S", priceMinor: 1200, stock: 2, options: { size: "small" } },
    { id: "large", name: "Large", sku: "CAKE-L", priceMinor: 2400, stock: 5, options: { size: "large" }, ...largeExtra },
  ],
  inventoryOptionIds: ["size"],
  options: [{ id: "size", name: "Size", type: "variant", display: "buttons", required: true, position: 0, values: [{ id: "small", label: "Small", priceAdjustmentMinor: 0, position: 0 }, { id: "large", label: "Large", priceAdjustmentMinor: 0, position: 1 }] }],
} as unknown as Product);

const context = (item: Product, valueId: string) => createProductPresentationContext({
  product: item, currency: "USD", quantity: 1, selections: [{ optionId: "size", valueId }],
  onSelectionsChange: vi.fn(), onQuantityChange: vi.fn(), onAddToCart: vi.fn(async () => ({ ok: true })),
});

describe("a combination the merchant stopped selling", () => {
  it("is unavailable to shoppers even though it still has stock", () => {
    const sold = context(product(), "large");
    expect(sold.availability).toMatchObject({ state: "available", maxQuantity: 5 });
    expect(sold.canAddToCart).toBe(true);

    const notSold = context(product({ sellable: false, available: false }), "large");
    expect(notSold.availability).toMatchObject({ state: "unavailable", message: "This combination is unavailable", maxQuantity: 0 });
    expect(notSold.canAddToCart).toBe(false);
  });

  it("does not affect the other combinations", () => {
    const other = context(product({ sellable: false, available: false }), "small");
    expect(other.availability).toMatchObject({ state: "available", maxQuantity: 2 });
    expect(other.canAddToCart).toBe(true);
  });

  it("is not purchasable through the add to cart action", async () => {
    const result = await context(product({ sellable: false, available: false }), "large").addToCart();
    expect(result.ok).toBe(false);
  });

  it("is also unavailable when stock is not tracked", () => {
    const item = product({ sellable: false, available: false, trackInventory: false, stock: 0 });
    expect(context(item, "large").availability.state).toBe("unavailable");
    expect(context(product({ trackInventory: false, stock: 0, available: true }), "large").availability.state).toBe("available");
  });
});
