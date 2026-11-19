import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/domain";
import { setChoicesFor } from "./product-card-data";
import { pairProducts } from "./recommendations";

const sizeOption = { id: "size", name: "Size", type: "variant", display: "buttons", required: true, position: 0, values: ["Single", "Double", "King"].map((label, position) => ({ id: `size-${label.toLowerCase()}`, label, position, priceAdjustmentMinor: 0 })) };
const variant = (label: string, priceMinor: number, stock = 4) => ({ id: `v-${label}`, name: label, sku: "", priceMinor, stock, options: { size: `size-${label.toLowerCase()}` } });
const product = (over: Partial<Product> = {}) => ({
  id: "p1", name: "Hollis mattress", slug: "hollis", imageUrl: "", tags: [], options: [sizeOption],
  variants: [variant("King", 37400), variant("Single", 24900), variant("Double", 32400, 0)], ...over,
}) as unknown as Product;

describe("pairProducts", () => {
  const items = [
    { id: "bed2", collectionIds: ["beds"] }, { id: "m1", collectionIds: ["mattresses"] }, { id: "m2", collectionIds: ["mattresses"] },
    { id: "h1", collectionIds: ["headboards"] }, { id: "loose" },
  ];
  it("leaves out the product's own collections and takes one from each other collection first", () => {
    expect(pairProducts({ id: "bed1", collectionIds: ["beds"] }, items, (item) => item, 4).map((item) => item.id)).toEqual(["m1", "h1", "loose", "m2"]);
  });
  it("is the ordinary recommendation list for a product with no collection", () => {
    expect(pairProducts({ id: "x" }, items, (item) => item, 2)).toHaveLength(2);
  });
});

describe("setChoicesFor", () => {
  it("lists sizes in the product's own order with prices, sold-out sizes as max 0", () => {
    expect(setChoicesFor(product(), "GBP")).toEqual({ setChoices: { optionName: "Size", values: [
      { variantId: "v-Single", label: "Single", price: "£249.00", priceMinor: 24900, max: 4 },
      { variantId: "v-Double", label: "Double", price: "£324.00", priceMinor: 32400, max: 0 },
      { variantId: "v-King", label: "King", price: "£374.00", priceMinor: 37400, max: 4 },
    ] } });
  });
  it("allows optional extras but not products that need other choices first", () => {
    const extras = { id: "extras", name: "Extras", type: "addon", display: "buttons", required: false, position: 1, values: [] };
    expect(setChoicesFor(product({ options: [sizeOption, extras] as Product["options"] }), "GBP").setChoices).toBeDefined();
    expect(setChoicesFor(product({ options: [sizeOption, { ...extras, type: "configuration", required: true }] as Product["options"] }), "GBP")).toEqual({});
    expect(setChoicesFor(product({ quantityRule: { min: 2, step: 2 } } as Partial<Product>), "GBP")).toEqual({});
    expect(setChoicesFor(product({ options: [sizeOption, { ...sizeOption, id: "colour", name: "Colour" }] as Product["options"] }), "GBP")).toEqual({});
  });
});

describe("defaultSelections", () => {
  it("starts on the value the merchant marked, never on a paid extra, and not on a size that cannot be bought", async () => {
    const { defaultSelections } = await import("./use-variant-address");
    const marked = { ...sizeOption, values: sizeOption.values.map((value) => ({ ...value, isDefault: value.label === "King" })) };
    const extras = { id: "extras", name: "Extras", type: "addon", display: "buttons", required: false, multiple: true, position: 1, values: [{ id: "assembly", label: "Assembly", position: 0, priceAdjustmentMinor: 3900, isDefault: true }] };
    expect(defaultSelections(product({ options: [marked, extras], inventoryOptionIds: ["size"] } as Partial<Product>))).toEqual([{ optionId: "size", valueId: "size-king" }]);
    const soldOutDefault = { ...sizeOption, values: sizeOption.values.map((value) => ({ ...value, isDefault: value.label === "Double" })) };
    expect(defaultSelections(product({ options: [soldOutDefault], inventoryOptionIds: ["size"] } as Partial<Product>))).toEqual([]);
    expect(defaultSelections(product({ inventoryOptionIds: ["size"] } as Partial<Product>))).toEqual([]);
  });
});
