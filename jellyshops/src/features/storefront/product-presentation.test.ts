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
  it("resolves tagged gallery metadata without selecting purchase values", () => {
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS", "store-a");
    const tagged = { ...product, media: [{ id: "cover", url: "/cover.jpg" }, { id: "large-photo", url: "/large.jpg", width: 1200, height: 800, appliesTo: { size: ["large"] } }, { id: "small-photo", url: "/small.jpg", appliesTo: { size: ["small"] } }] };
    const props = { product: tagged, currency: "USD" as const, quantity: 1, onSelectionsChange: vi.fn(), onQuantityChange: vi.fn(), onAddToCart: vi.fn() };
    expect(createProductPresentationContext({ ...props, selections: [] }).product.media?.map((item) => item.id)).toEqual(["cover", "large-photo", "small-photo"]);
    const selected = createProductPresentationContext({ ...props, selections: [{ optionId: "size", valueId: "large" }] });
    expect(selected.product.imageUrl).toBe("/large.jpg");
    expect(selected.product.media?.[0]).toMatchObject({ width: 1200, height: 800 });
    expect(props.onSelectionsChange).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
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
    expect(addToCart).toHaveBeenCalledWith({ variantId: "small", quantity: 2, selections: [{ optionId: "size", valueId: "small" }], priceMinor: 1200, personalisation: [] });
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

describe("personalisation on the product page", () => {
  const ring: Product = { ...product, personalisation: [{ id: "engraving", label: "Engraving", required: true, maxLength: 12, priceAdjustmentMinor: 500 }, { id: "note", label: "Gift message", required: false, maxLength: 200, multiline: true }] };
  const build = (values: Record<string, string>, extra: Partial<Parameters<typeof createProductPresentationContext>[0]> = {}) => createProductPresentationContext({ product: ring, currency: "GBP", selections: [{ optionId: "size", valueId: "small" }], quantity: 1, onSelectionsChange: vi.fn(), onQuantityChange: vi.fn(), onAddToCart: vi.fn(async () => ({ ok: true })), personalisationValues: values, ...extra });

  it("lists the fields with the extra price and refuses adding until the required text is there", async () => {
    const context = build({});
    expect(context.personalisation?.fields.map((field) => [field.label, field.priceAdjustment ?? ""])).toEqual([["Engraving", "£5.00"], ["Gift message", ""]]);
    expect(context.personalisation?.problems).toBeUndefined();
    expect(await context.addToCart()).toEqual({ ok: false, message: "Please fill in Engraving." });
    expect(build({}, { showPersonalisationProblems: true }).personalisation?.problems).toEqual({ engraving: "Please fill in Engraving." });
  });

  it("adds the cleaned text to the line and its price", async () => {
    const onAddToCart = vi.fn(async () => ({ ok: true }));
    const context = build({ engraving: "  SAM ", note: "" }, { onAddToCart });
    expect(context.pricing.priceMinor).toBe(1700);
    await context.addToCart();
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ priceMinor: 1700, personalisation: [{ fieldId: "engraving", value: "SAM" }] }));
  });

  it("passes typing back to the page", () => {
    const onPersonalisationChange = vi.fn();
    build({ engraving: "S" }, { onPersonalisationChange }).personalisation?.setValue("engraving", "SA");
    expect(onPersonalisationChange).toHaveBeenCalledWith({ engraving: "SA" });
  });

  it("has no personalisation for products without fields", () => {
    expect(createProductPresentationContext({ product, currency: "GBP", selections: [], quantity: 1, onSelectionsChange: vi.fn(), onQuantityChange: vi.fn(), onAddToCart: vi.fn() }).personalisation).toBeUndefined();
  });
});

describe("quantity rules on the product page", () => {
  const packs: Product = { ...product, variants: product.variants.map((variant) => ({ ...variant, stock: variant.id === "small" ? 4 : 40 })), quantityRule: { min: 6, step: 6, max: 24 } };
  const build = (valueId: string, quantity: number, onQuantityChange = vi.fn(), onAddToCart = vi.fn(async () => ({ ok: true }))) => createProductPresentationContext({ product: packs, currency: "GBP", selections: [{ optionId: "size", valueId }], quantity, onSelectionsChange: vi.fn(), onQuantityChange, onAddToCart });

  it("starts at the minimum, moves in steps and passes the rule to the stepper", async () => {
    const onQuantityChange = vi.fn();
    const onAddToCart = vi.fn(async () => ({ ok: true }));
    const context = build("large", 1, onQuantityChange, onAddToCart);
    expect(context.quantity).toBe(6);
    expect(context.quantityRule).toEqual({ min: 6, step: 6, max: 24, text: "Sold in steps of 6 · at most 24" });
    context.setQuantity(13);
    expect(onQuantityChange).toHaveBeenLastCalledWith(12);
    context.setQuantity(100);
    expect(onQuantityChange).toHaveBeenLastCalledWith(24);
    await context.addToCart();
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ quantity: 6 }));
  });

  it("cannot be bought when less stock is left than the minimum", () => {
    const context = build("small", 1);
    expect(context.availability).toMatchObject({ state: "unavailable", message: "Only 4 left, under the minimum order of 6" });
    expect(context.canAddToCart).toBe(false);
  });
});
