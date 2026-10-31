import { describe, expect, it } from "vitest";
import { listSectionPresets } from "@jelly/storefront-registry";
import { defaultSectionRenderRegistry } from "./render-registry";
import { isRenderableHomeSection } from "./section-support";

describe("editor preset renderer support", () => {
  it("renders every section exposed by an editor preset", () => {
    expect(listSectionPresets().every((preset) => isRenderableHomeSection(preset.sectionType))).toBe(true);
  });

  it.each([
    "category-grid",
    "testimonials",
    "trust-strip",
    "logo-list",
    "image-mosaic",
    "journal-teaser",
    "cart-summary",
    "search-results",
    "not-found-message",
  ])("registers the %s section used by the complete ecommerce packs", (type) => {
    expect(defaultSectionRenderRegistry.has(type)).toBe(true);
  });
});
