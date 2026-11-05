import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/domain";
import { productCardChip, productCardData } from "./product-card-data";

const product = (over: Partial<Product> = {}, variant: Partial<Product["variants"][number]> = {}) => ({
  id: "p1", name: "Oslo bed", slug: "oslo-bed", imageUrl: "https://cdn.test/oslo.jpg", tags: [],
  variants: [{ id: "v1", name: "Double", sku: "", priceMinor: 25000, stock: 3, ...variant }],
  ...over,
}) as unknown as Product;

describe("product card data", () => {
  it("adds the old price, the saving and the percentage off for a discounted variant", () => {
    expect(productCardData(product({}, { compareAtPriceMinor: 50000 }), "/s/products/oslo-bed", "GBP")).toEqual({
      id: "p1", name: "Oslo bed", href: "/s/products/oslo-bed", imageUrl: "https://cdn.test/oslo.jpg",
      price: "£250.00", compareAtPrice: "£500.00", saving: "£250.00", discountPercent: 50,
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
