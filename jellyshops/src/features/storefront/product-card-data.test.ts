import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/domain";
import { productCardChip, productCardData, productCardSwatches, quickAddFor } from "./product-card-data";

const product = (over: Partial<Product> = {}, variant: Partial<Product["variants"][number]> = {}) => ({
  id: "p1", name: "Oslo bed", slug: "oslo-bed", imageUrl: "https://cdn.test/oslo.jpg", tags: [],
  variants: [{ id: "v1", name: "Double", sku: "", priceMinor: 25000, stock: 3, ...variant }],
  ...over,
}) as unknown as Product;

describe("product card data", () => {
  it("adds the old price, the saving and the percentage off for a discounted variant", () => {
    expect(productCardData(product({}, { compareAtPriceMinor: 50000 }), "/s/products/oslo-bed", "GBP")).toEqual({
      id: "p1", name: "Oslo bed", href: "/s/products/oslo-bed", imageUrl: "https://cdn.test/oslo.jpg",
      price: "£250.00", priceMinor: 25000, available: true, quickAdd: { variantId: "v1", max: 3 }, compareAtPrice: "£500.00", saving: "£250.00", discountPercent: 50,
    });
  });

  it("uses the product's compare-at price when the variant has none, and ignores one that is not higher", () => {
    expect(productCardData(product({ compareAtPriceMinor: 30000 }), "/x", "GBP")).toMatchObject({ compareAtPrice: "£300.00", saving: "£50.00", discountPercent: 17 });
    const fullPrice = productCardData(product({ compareAtPriceMinor: 25000 }), "/x", "GBP");
    expect(fullPrice).not.toHaveProperty("compareAtPrice");
    expect(fullPrice).not.toHaveProperty("saving");
  });

  it("never rounds a real discount down to 0% off", () => {
    expect(productCardData(product({}, { priceMinor: 99900, compareAtPriceMinor: 100000 }), "/x", "GBP").discountPercent).toBe(1);
  });

  it("takes the chip from the first label: tag", () => {
    expect(productCardChip(["bed", " Label: More colours ", "label:Medium firm"])).toBe("More colours");
    expect(productCardChip(["label:"])).toBeUndefined();
    expect(productCardChip(undefined)).toBeUndefined();
    expect(productCardData(product({ tags: ["label:Medium firm"] }), "/x", "GBP").chip).toBe("Medium firm");
  });
});

it("gives cards the brand and up to five colours of the first colour option", () => {
  const option = (display: "color" | "image" | undefined, values: Array<{ label: string; color?: string; image?: string }>, position = 0) => ({ id: `o${position}`, name: "Colour", position, display, values: values.map((value, index) => ({ id: `v${index}`, ...value })) });
  const colours = ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"].map((color, index) => ({ label: `C${index}`, color }));
  expect(productCardSwatches({ options: [option(undefined, [{ label: "S" }], 0), option("color", colours, 1)] } as never)).toEqual({ swatches: colours.slice(0, 5), moreSwatches: 2 });
  expect(productCardSwatches({ options: [option("color", [{ label: "Bad", color: "red" }])] } as never)).toEqual({});
  expect(productCardSwatches({ options: [option("image", [{ label: "Linen", image: "https://cdn.example.com/l.jpg" }, { label: "X", image: "http://insecure.example.com/x.jpg" }])] } as never)).toEqual({ swatches: [{ label: "Linen", image: "https://cdn.example.com/l.jpg" }] });
  expect(productCardSwatches({ options: undefined } as never)).toEqual({});
});

describe("quick add on cards", () => {
  it("allows quick add only for one buyable variant with no options", () => {
    expect(quickAddFor(product())).toEqual({ quickAdd: { variantId: "v1", max: 3 } });
    expect(productCardData(product(), "/s/p", "GBP").quickAdd).toEqual({ variantId: "v1", max: 3 });
    expect(quickAddFor(product({}, { stock: 0 }))).toEqual({});
    expect(quickAddFor(product({}, { sellable: false }))).toEqual({});
    expect(quickAddFor(product({ options: [{ id: "o", name: "Size", values: [] }] } as unknown as Partial<Product>))).toEqual({});
    const twoVariants = product();
    twoVariants.variants.push({ ...twoVariants.variants[0], id: "v2" });
    expect(quickAddFor(twoVariants)).toEqual({});
  });
});
