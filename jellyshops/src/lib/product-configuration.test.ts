import { getConfiguredPriceMinor, resolveProductVariant } from "./product-configuration";

describe("product configuration", () => {
  const product = {
    id: "p", storeId: "s", name: "Bed", slug: "bed", description: "", category: "Beds", imageUrl: "", published: true, archived: false, featured: false,
    inventoryOptionIds: ["colour"],
    options: [
      { id: "colour", name: "Colour", type: "variant" as const, display: "buttons" as const, required: true, position: 0, values: [{ id: "pink", label: "Pink", priceAdjustmentMinor: 0, position: 0 }] },
      { id: "storage", name: "Storage", type: "configuration" as const, display: "buttons" as const, required: false, position: 1, values: [{ id: "drawers", label: "4 drawers", priceAdjustmentMinor: 400000, position: 0 }] },
    ],
    variants: [{ id: "v", name: "Pink", sku: "BED-PNK", priceMinor: 400000, stock: 3, options: { colour: "pink" } }],
  };
  it("resolves by IDs and adds configuration adjustments", () => {
    const variant = resolveProductVariant(product, [{ optionId: "colour", valueId: "pink" }]);
    expect(variant?.sku).toBe("BED-PNK");
    expect(getConfiguredPriceMinor(variant, product.options, [{ optionId: "colour", valueId: "pink" }, { optionId: "storage", valueId: "drawers" }])).toBe(800000);
  });
});
