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

  describe("choices beyond size", () => {
    const value = (id: string, label: string, priceAdjustmentMinor = 0) => ({ id, label, priceAdjustmentMinor, position: 0 });
    const bed: Product = {
      ...product, id: "bed", name: "Bed",
      variants: [{ id: "single", name: "Single", sku: "B1", priceMinor: 10000, stock: 3, options: { size: "single" } }, { id: "king", name: "King", sku: "B2", priceMinor: 20000, stock: 3, options: { size: "king" } }],
      options: [
        { id: "size", name: "Size", type: "variant", display: "buttons", required: true, position: 0, values: [value("single", "Single"), value("king", "King")] },
        { id: "extras", name: "Extras", type: "addon", display: "buttons", required: false, multiple: true, maxSelect: 2, position: 1, values: [value("head", "Headboard", 5000), value("rug", "Rug", 1000), value("lamp", "Lamp", 500)] },
        { id: "long", name: "Extra long", type: "configuration", display: "buttons", required: true, position: 2, visibleWhen: { optionId: "size", valueIds: ["king"] }, values: [value("yes", "Yes", 100)] },
      ],
    };
    const build = (selections: Array<{ optionId: string; valueId: string }>, onSelectionsChange = vi.fn()) => createProductPresentationContext({ product: bed, currency: "USD", selections, quantity: 1, onSelectionsChange, onQuantityChange: vi.fn(), onAddToCart: vi.fn() });

    it("adds up every picked extra and lists price changes on the values", () => {
      const context = build([{ optionId: "size", valueId: "single" }, { optionId: "extras", valueId: "head" }, { optionId: "extras", valueId: "rug" }]);
      expect(context.pricing.price).toBe("$160.00");
      const extras = context.product.options.find((option) => option.id === "extras")!;
      expect(extras).toMatchObject({ multiple: true });
      expect(extras.values.map((v) => [v.label, v.selected, v.priceAdjustment])).toEqual([["Headboard", true, "$50.00"], ["Rug", true, "$10.00"], ["Lamp", false, "$5.00"]]);
      expect(context.product.options.find((option) => option.id === "size")).not.toHaveProperty("multiple");
    });

    it("toggles extras on and off, respects the maximum, and replaces single-pick choices", () => {
      const onChange = vi.fn();
      build([{ optionId: "extras", valueId: "head" }], onChange).selectOption("extras", "rug");
      expect(onChange).toHaveBeenLastCalledWith([{ optionId: "extras", valueId: "head" }, { optionId: "extras", valueId: "rug" }]);
      build([{ optionId: "extras", valueId: "head" }], onChange).selectOption("extras", "head");
      expect(onChange).toHaveBeenLastCalledWith([]);
      const full = [{ optionId: "extras", valueId: "head" }, { optionId: "extras", valueId: "rug" }];
      build(full, onChange).selectOption("extras", "lamp");
      expect(onChange).toHaveBeenLastCalledWith(full);
      build([{ optionId: "size", valueId: "single" }], onChange).selectOption("size", "king");
      expect(onChange).toHaveBeenLastCalledWith([{ optionId: "size", valueId: "king" }]);
    });

    it("only shows and requires a conditional choice once its condition is met", () => {
      const single = build([{ optionId: "size", valueId: "single" }]);
      expect(single.product.options.map((option) => option.id)).toEqual(["size", "extras"]);
      expect(single.canAddToCart).toBe(true);
      const king = build([{ optionId: "size", valueId: "king" }]);
      expect(king.product.options.map((option) => option.id)).toEqual(["size", "extras", "long"]);
      expect(king.product.options.find((option) => option.id === "long")).toMatchObject({ missing: true });
      expect(king.canAddToCart).toBe(false);
      expect(king.availability.state).toBe("selection-required");
      expect(build([{ optionId: "size", valueId: "king" }, { optionId: "long", valueId: "yes" }]).canAddToCart).toBe(true);
    });
  });
});
