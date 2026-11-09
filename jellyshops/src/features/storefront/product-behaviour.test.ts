import { describe, expect, it } from "vitest";
import type { Product, ProductVariant } from "@/lib/domain";
import { isUntrackedStock, isVariantBuyable, UNTRACKED_MAX_QUANTITY, variantMaxQuantity } from "@/lib/variant-stock";
import { optionValueState } from "./product-presentation";
import { quickAddFor, productCardData } from "./product-card-data";
import { addressWithVariant, selectionsForVariant } from "./use-variant-address";

/** Phase 4 (component behaviour): stock, sold-out choices and the variant in the address. */
const variant = (id: string, options: Record<string, string>, stock: number, extra: Partial<ProductVariant> = {}): ProductVariant => ({ id, name: id, sku: id, priceMinor: 1000, stock, options, ...extra });

describe("variant stock", () => {
  it("lets shoppers buy a variant whose stock is not tracked, and every digital product", () => {
    const untracked = variant("u", {}, 0, { available: true });
    expect(isUntrackedStock(untracked)).toBe(true);
    expect(isVariantBuyable(untracked)).toBe(true);
    expect(variantMaxQuantity(untracked)).toBe(UNTRACKED_MAX_QUANTITY);
  });

  it("caps a counted variant at its stock and refuses an empty or withdrawn one", () => {
    expect(variantMaxQuantity(variant("t", {}, 3))).toBe(3);
    expect(isVariantBuyable(variant("empty", {}, 0, { available: false }))).toBe(false);
    expect(isVariantBuyable(variant("empty", {}, 0))).toBe(false);
    expect(isVariantBuyable(variant("withdrawn", {}, 5, { sellable: false }))).toBe(false);
    expect(isVariantBuyable(undefined)).toBe(false);
  });

  it("gives untracked products quick add and counts them as in stock on cards", () => {
    const product: Product = { id: "p", storeId: "s", name: "E-book", slug: "e-book", description: "", category: "", imageUrl: "", published: true, archived: false, featured: false, variants: [variant("only", {}, 0, { available: true })] };
    expect(quickAddFor(product).quickAdd).toEqual({ variantId: "only", max: 99 });
    expect(productCardData(product, "/s/products/e-book", "GBP").available).toBe(true);
  });
});

describe("sold-out choices", () => {
  const product: Pick<Product, "variants" | "inventoryOptionIds"> = {
    inventoryOptionIds: ["colour", "size"],
    variants: [
      variant("red-s", { colour: "red", size: "s" }, 2),
      variant("red-m", { colour: "red", size: "m" }, 0),
      variant("blue-s", { colour: "blue", size: "s" }, 0),
      variant("blue-m", { colour: "blue", size: "m" }, 4),
    ],
  };

  it("marks a value sold out when no variant with it and the other choices can be bought", () => {
    const red = [{ optionId: "colour", valueId: "red" }];
    expect(optionValueState(product, red, "size", "s")).toEqual({ available: true });
    expect(optionValueState(product, red, "size", "m")).toEqual({ available: true, soldOut: true });
    // With nothing else chosen, a value is sold out only when every variant with it is.
    expect(optionValueState(product, [], "size", "m")).toEqual({ available: true });
  });

  it("only refuses a value that no variant has, and never limits choices that do not decide the variant", () => {
    expect(optionValueState(product, [], "size", "xl")).toEqual({ available: false });
    expect(optionValueState(product, [], "engraving", "gold")).toEqual({ available: true });
  });
});

describe("variant in the address", () => {
  const product: Pick<Product, "variants" | "inventoryOptionIds"> = {
    inventoryOptionIds: ["size"],
    variants: [variant("v-small", { size: "small" }, 1), variant("v-large", { size: "large" }, 1)],
  };

  it("reads ?variant= into the choices that pick that variant", () => {
    expect(selectionsForVariant(product, "?variant=v-large")).toEqual([{ optionId: "size", valueId: "large" }]);
    expect(selectionsForVariant(product, "?variant=missing")).toBeNull();
    expect(selectionsForVariant(product, "")).toBeNull();
  });

  it("sets and removes ?variant= without touching the rest of the address", () => {
    expect(addressWithVariant("https://shop.test/demo/products/tee?utm_source=mail#reviews", "v-small")).toBe("/demo/products/tee?utm_source=mail&variant=v-small#reviews");
    expect(addressWithVariant("https://shop.test/demo/products/tee?variant=v-small&utm_source=mail", undefined)).toBe("/demo/products/tee?utm_source=mail");
  });
});
