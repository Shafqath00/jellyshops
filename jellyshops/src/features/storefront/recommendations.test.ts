import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cardSignals, productSignals, recommendProducts, type RecommendationSignals } from "./recommendations";

const ids = (items: RecommendationSignals[]) => items.map((item) => item.id);
const same = (item: RecommendationSignals) => item;

describe("recommendProducts", () => {
  const current: RecommendationSignals = { id: "bed", collectionIds: ["beds"], categoryIds: ["bedroom"], productType: "Bed", vendor: "Resthaven", tags: ["Fabric:Linen", "family:harbour"] };
  const catalogue: RecommendationSignals[] = [
    { id: "lamp" },
    { id: "bed", collectionIds: ["beds"] },
    { id: "same-brand", vendor: "resthaven" },
    { id: "same-type", productType: "bed" },
    { id: "same-collection", collectionIds: ["beds"] },
    { id: "other-colour", collectionIds: ["beds"], tags: ["family:Harbour"] },
    { id: "same-category", categoryIds: ["bedroom"] },
    { id: "same-tag", tags: ["fabric:linen"] },
    { id: "featured", featured: true },
  ];

  it("ranks by collection, category, type, tags, brand, then featured and catalogue order", () => {
    expect(ids(recommendProducts(current, catalogue, same, 12))).toEqual(["same-collection", "same-category", "same-type", "same-tag", "same-brand", "featured", "lamp"]);
  });

  it("never recommends the product itself or its other colours", () => {
    const result = ids(recommendProducts(current, catalogue, same, 12));
    expect(result).not.toContain("bed");
    expect(result).not.toContain("other-colour");
  });

  it("fills up with other products, so a store with two products always shows one", () => {
    expect(ids(recommendProducts({ id: "a" }, [{ id: "a" }, { id: "b" }], same))).toEqual(["b"]);
    expect(recommendProducts({ id: "a" }, [{ id: "a" }], same)).toEqual([]);
    expect(recommendProducts(current, catalogue, same, 2)).toHaveLength(2);
  });

  it("reads catalogue products and sample cards", () => {
    expect(productSignals({ id: "p", primaryCategoryId: "c1", additionalCategoryIds: ["c2"], collectionIds: ["x"], featured: true })).toMatchObject({ categoryIds: ["c1", "c2"], collectionIds: ["x"], featured: true });
    expect(cardSignals({ id: "card", filters: [{ name: "Type", values: ["Bed"] }, { name: "Brand", values: ["Ola"] }, { name: "Size", values: ["King"] }] })).toEqual({ id: "card", productType: "Bed", vendor: "Ola", tags: ["Size:King"] });
  });
});

describe("one recommendation rule for the live store and both previews", () => {
  const root = path.join(__dirname, "..", "..");
  const callers = [
    "app/[storeSlug]/products/[productSlug]/product-client.tsx",
    "features/store-editor/preview-context.ts",
    "features/theme-preview/template-preview.tsx",
  ];
  it.each(callers)("%s builds related products with recommendProducts", (file) => {
    const source = readFileSync(path.join(root, file), "utf8");
    const lines = source.split(/\r?\n/).filter((line) => /relatedProducts\s*[:,(]/.test(line) && !/^\s*(\*|\/\/)/.test(line));
    expect(source).toContain("recommendProducts(");
    // Any place that hands related products to the page goes through the shared rule.
    for (const line of lines.filter((item) => /relatedProducts:\s*[a-z(]/.test(item))) expect(line).toMatch(/recommendProducts\(|editorRecommendations\(/);
  });
});
