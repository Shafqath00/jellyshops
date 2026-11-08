import { describe, expect, it } from "vitest";
import { descriptionAdvice, productMetaDescription, productMetaTitle, productSocialTitle, titleAdvice, truncateForMeta } from "./seo";

describe("truncateForMeta", () => {
  it("leaves short text alone and tidies whitespace", () => {
    expect(truncateForMeta("  A soft   linen\n\nshirt.  ")).toBe("A soft linen shirt.");
    expect(truncateForMeta("")).toBe("");
  });
  it("cuts long text at a word with an ellipsis, within the limit", () => {
    const text = "Breathable organic linen shirt cut for warm days and long evenings, with a relaxed fit, mother-of-pearl buttons and a hem that sits well untucked or tucked in, whatever the weather brings.";
    const cut = truncateForMeta(text);
    expect(cut.length).toBeLessThanOrEqual(160);
    expect(cut.endsWith("…")).toBe(true);
    expect(text.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut).not.toMatch(/\s…$/);
    expect(cut.slice(0, -1).endsWith(" ")).toBe(false);
  });
  it("cuts a single very long word instead of failing", () => {
    expect(truncateForMeta("x".repeat(400))).toHaveLength(160);
  });
  it("respects a different limit", () => {
    expect(truncateForMeta("one two three four five six", 20)).toBe("one two three four…");
  });
});

describe("what search engines and shoppers are shown", () => {
  const product = { name: "Linen shirt", description: "A soft linen shirt.", seoTitle: null, seoDescription: null };
  it("uses the seller's own title and description when there are some", () => {
    expect(productMetaTitle({ ...product, seoTitle: "Organic linen shirt | Hemp & Co" }, "Hemp & Co")).toBe("Organic linen shirt | Hemp & Co");
    expect(productMetaDescription({ ...product, seoDescription: "Breathable organic linen." })).toBe("Breathable organic linen.");
    expect(productSocialTitle({ ...product, seoTitle: "Organic linen shirt" })).toBe("Organic linen shirt");
  });
  it("falls back to the product's own words", () => {
    expect(productMetaTitle(product, "Hemp & Co")).toBe("Linen shirt · Hemp & Co");
    expect(productMetaTitle(product, "")).toBe("Linen shirt");
    expect(productMetaDescription(product)).toBe("A soft linen shirt.");
    expect(productSocialTitle(product)).toBe("Linen shirt");
  });
  it("treats blank text as nothing", () => {
    expect(productMetaTitle({ ...product, seoTitle: "   " }, "Hemp & Co")).toBe("Linen shirt · Hemp & Co");
    expect(productMetaDescription({ ...product, seoDescription: "  " })).toBe("A soft linen shirt.");
    expect(productMetaDescription({ ...product, seoDescription: undefined })).toBe("A soft linen shirt.");
  });
});

describe("advice", () => {
  it("says nothing about an empty field, and warns about lengths search engines cut", () => {
    expect(titleAdvice("")).toBeNull();
    expect(titleAdvice("Linen shirt")?.level).toBe("good");
    expect(titleAdvice("x".repeat(61))?.level).toBe("warning");
    expect(titleAdvice("x".repeat(60))?.level).toBe("good");
    expect(descriptionAdvice("")).toBeNull();
    expect(descriptionAdvice("Too short")?.message).toMatch(/at least 70/);
    expect(descriptionAdvice("x".repeat(100))?.level).toBe("good");
    expect(descriptionAdvice("x".repeat(161))?.message).toMatch(/after about 160/);
  });
});
