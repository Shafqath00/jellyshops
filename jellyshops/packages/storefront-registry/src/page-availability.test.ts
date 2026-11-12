import { describe, expect, it } from "vitest";
import { listSectionDefinitionsForPage, MAX_SECTION_BLOCKS, validateSectionAgainstRegistry } from "./registry";
import { anyTemplatePage } from "./sections/content";

const contentSections = ["hero", "slideshow", "category-grid", "image-with-text", "image-banner", "testimonials", "faq", "newsletter", "multicolumn", "rich-text", "custom-content", "product-grid", "featured-collection", "trust-strip", "rating-summary", "image-gallery", "logo-list", "contact-store-info", "recently-viewed"];

describe("where sections can go", () => {
  it("offers every content section on every page drawn from sections, like Shopify", () => {
    for (const page of anyTemplatePage) {
      const offered = listSectionDefinitionsForPage(page).map((definition) => definition.type);
      for (const type of contentSections) expect(offered, `${type} on ${page}`).toContain(type);
    }
  });

  it("keeps page-specific sections on their own page", () => {
    expect(listSectionDefinitionsForPage("home").map((definition) => definition.type)).not.toContain("product-purchase");
    expect(listSectionDefinitionsForPage("product").map((definition) => definition.type)).not.toContain("cart-summary");
    expect(listSectionDefinitionsForPage("collection").map((definition) => definition.type)).not.toContain("search-results");
  });

  it("refuses more than 50 blocks in one section", () => {
    const blocks = Array.from({ length: MAX_SECTION_BLOCKS + 1 }, (_, index) => ({ id: `b${index}`, type: "heading", enabled: true, settings: {} }));
    const issues = validateSectionAgainstRegistry({ id: "s", type: "custom-content", enabled: true, settings: {}, blocks }, "page");
    expect(issues.map((issue) => issue.code)).toContain("BLOCK_LIMIT_EXCEEDED");
  });
});
