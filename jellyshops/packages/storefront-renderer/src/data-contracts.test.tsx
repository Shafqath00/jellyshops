import { cleanup, render } from "@testing-library/react";
import { listSectionDefinitions, SECTION_DATA_NEEDS, sectionEmptyMessage } from "@jelly/storefront-registry";
import { afterEach, describe, expect, it } from "vitest";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import type { CommerceDataProvider } from "./types";

const presentation = { product: { id: "p1", title: "Bed", description: "", imageUrl: "", media: [], specifications: {}, options: [] }, pricing: { price: "£1.00" }, availability: { state: "in-stock", message: "In stock" }, options: [], quantity: 1, setQuantity: () => undefined, selectOption: () => undefined, addToCart: async () => ({ ok: true }), canAddToCart: true, relatedProducts: [] };
const pages: Record<string, unknown> = {
  product: { pageType: "product", resource: { type: "product", id: "p1", handle: "bed", visible: true, data: { title: "Bed", productPresentation: presentation } } },
  collection: { pageType: "collection", resource: { type: "collection", id: "c1", handle: "beds", visible: true, data: { title: "Beds", description: "", products: [] } } },
  page: { pageType: "page", resource: { type: "page", id: "pg", handle: "about", visible: true, data: { title: "About", content: [] } } },
  blog: { pageType: "blog", resource: { type: "blog", id: "b", handle: "news", visible: true, data: { title: "News", articles: [] } } },
  article: { pageType: "article", resource: { type: "article", id: "a", handle: "post", visible: true, data: { title: "Post", content: [] } } },
};
const commerce = { getProducts: async () => [], getCollections: async () => [] } as unknown as CommerceDataProvider;
/**
 * Data contracts (Phase 5): on a store with no data a section may draw nothing for shoppers, but in the editor it must
 * never leave an unexplained gap. Every section is drawn here with its defaults and empty data (no products, an
 * empty product, collection, page, blog and post).
 */
afterEach(cleanup);
const draw = (type: string, mode: "editor" | "published") => {
  const definition = listSectionDefinitions().find((item) => item.type === type)!;
  const section = { id: "s", type, enabled: true, settings: structuredClone(definition.defaultSettings), blocks: structuredClone(definition.defaultBlocks ?? []) };
  const page = definition.supportedPages[0];
  return render(<RegistrySectionRenderer section={section} mode={mode} commerce={commerce} page={(pages[page] ?? { pageType: page }) as never} />).container;
};

describe("Section data contracts", () => {
  it("names only real sections", () => {
    const types = new Set(listSectionDefinitions().map((item) => item.type));
    expect(Object.keys(SECTION_DATA_NEEDS).filter((type) => !types.has(type))).toEqual([]);
  });

  it.each(listSectionDefinitions().map((item) => item.type))("%s draws something in the editor, or explains why not", (type) => {
    const frame = draw(type, "editor").querySelector("[data-section-frame]")!;
    const content = [...frame.children].filter((child) => child.tagName !== "STYLE" && !child.hasAttribute("data-section-empty"));
    const note = frame.querySelector("[data-section-empty]");
    expect(note?.textContent).toBe(sectionEmptyMessage(type));
    // A section that draws nothing on a fresh store says what it needs in its own words, not the general hint.
    if (content.length === 0) expect(SECTION_DATA_NEEDS[type], `${type} draws nothing with empty data: add it to SECTION_DATA_NEEDS`).toBeTruthy();
  });

  it("never shows the note to shoppers", () => {
    for (const type of ["related-products", "hero", "collection-product-grid"]) expect(draw(type, "published").querySelector("[data-section-empty]")).toBeNull();
  });
});
