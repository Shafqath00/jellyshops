import { canTransitionOrder, formatMoney, getCategoryAncestors, getCategoryBreadcrumb, getCategoryChildren, getEffectiveCategoryOptionDefinitions, majorToMinor, minorToMajor } from "./domain";
import { createSeedState } from "./seed";

describe("commerce domain", () => {
  it("formats integer minor units in the requested currency", () => {
    expect(formatMoney(49999, "INR")).toBe("₹499.99");
  });

  it("accepts only explicit order transitions", () => {
    expect(canTransitionOrder("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransitionOrder("DELIVERED", "PENDING")).toBe(false);
    expect(canTransitionOrder("SHIPPED", "CANCELLED")).toBe(false);
  });

  it("seeds a rich demo catalog with distinct stores", () => {
    const state = createSeedState();
    expect(state.stores).toHaveLength(2);
    expect(state.products).toHaveLength(8);
    expect(state.products.some((product) => product.variants.some((variant) => variant.stock <= 3))).toBe(true);
  });

  it("builds defensive category hierarchy helpers", () => {
    const categories = [
      { id: "fashion", storeId: "s", name: "Fashion", slug: "fashion" },
      { id: "clothing", storeId: "s", name: "Clothing", slug: "clothing", parentId: "fashion" },
      { id: "shirts", storeId: "s", name: "T-Shirts", slug: "t-shirts", parentId: "clothing" },
    ];
    expect(getCategoryBreadcrumb("shirts", categories)).toBe("Fashion › Clothing › T-Shirts");
    expect(getCategoryAncestors("shirts", categories).map((item) => item.id)).toEqual(["fashion", "clothing", "shirts"]);
    expect(getCategoryChildren("fashion", categories).map((item) => item.id)).toEqual(["clothing"]);
    const cyclic = [...categories, { id: "cycle", storeId: "s", name: "Cycle", slug: "cycle", parentId: "cycle" }];
    expect(getCategoryAncestors("cycle", cyclic)).toHaveLength(1);
  });

  it("converts option money without floating point state", () => {
    expect(majorToMinor("50.00")).toBe(5000);
    expect(majorToMinor("0.5")).toBe(50);
    expect(minorToMajor(5000)).toBe("50.00");
  });

  it("inherits category templates and lets specific categories override them", () => {
    const categories = [
      { id: "beds", storeId: "s", name: "Beds", slug: "beds" },
      { id: "divan", storeId: "s", name: "Divan Beds", slug: "divan", parentId: "beds" },
    ];
    const definitions = [
      { id: "size", storeId: "s", categoryId: "beds", name: "Size", optionKind: "variant" as const, displayType: "buttons" as const, required: true, position: 0 },
      { id: "colour-a", storeId: "s", categoryId: "beds", name: "Colour", optionKind: "variant" as const, displayType: "color" as const, required: false, position: 1 },
      { id: "storage", storeId: "s", categoryId: "divan", name: "Storage", optionKind: "configuration" as const, displayType: "buttons" as const, required: false, position: 0 },
      { id: "colour-b", storeId: "s", categoryId: "divan", name: " colour ", optionKind: "variant" as const, displayType: "image" as const, required: true, position: 1 },
    ];
    const result = getEffectiveCategoryOptionDefinitions("divan", categories, definitions);
    expect(result.map((item) => item.name)).toEqual(["Size", "Storage", " colour "]);
    expect(result.find((item) => item.name.trim().toLowerCase() === "colour")?.displayType).toBe("image");
  });
});
