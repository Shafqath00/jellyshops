import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BLOCK_ELEMENTS, createSectionFromDefinition, getSectionDefinition, SECTION_ELEMENTS, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import type { CommerceDataProvider, RendererMode } from "./types";

const product = { id: "p1", name: "Linen shirt", href: "/products/linen-shirt", price: "£40.00", imageUrl: "" };
const commerce: CommerceDataProvider = { getProducts: async () => [product, { ...product, id: "p2" }] };
const image = { id: "m1", url: "https://cdn.example.com/photo.jpg", alt: "" };

/** A section with every element filled in, and without heading/text blocks so the copy comes from section settings. */
function filled(type: string, extra: Record<string, unknown> = {}): SectionNode {
  const section = createSectionFromDefinition(type, () => `${type}-1`);
  const blocks = type === "product-specifications" ? [{ id: "row", type: "spec-row", enabled: true, settings: { label: "Warranty", value: "10 years" } }] : section.blocks.filter((block) => !["heading", "text"].includes(block.type));
  return { ...section, id: `${type}-1`, blocks, settings: { ...section.settings, eyebrow: "New season", heading: "Our picks", text: "Chosen this week", viewAllLabel: "View all", image, ...(EXTRA[type] ?? {}), ...extra } };
}
/** Settings some sections need before a part shows (a footer newsletter, a header extra link). */
const EXTRA: Record<string, Record<string, unknown>> = {
  header: { extraLinkLabel: "Showroom", extraLink: "/pages/showroom" },
  footer: { showNewsletter: true, newsletterText: "News", storeName: "Harbour", contactEmail: "hi@shop.test", copyright: "© Harbour" },
  "contact-store-info": { address: "1 High St" },
  "rating-summary": { rating: 4 },
  "product-information": { showVendor: true },
  "collection-header": { showImage: true, layout: "simple" },
};
const presentation = {
  product: { id: "bed", title: "Harbour bed", vendor: "Harbour", description: "A bed.", imageUrl: "", options: [] },
  selection: [], quantity: 1, pricing: { price: "£499.00" }, availability: { state: "available", message: "In stock" }, canAddToCart: true,
  selectOption: vi.fn(), setQuantity: vi.fn(), addToCart: vi.fn(async () => ({ ok: true })), relatedProducts: [product, { ...product, id: "p2" }],
};
const productPage = { pageType: "product", resource: { id: "bed", handle: "bed", data: { productPresentation: presentation } } };
const PAGES: Record<string, unknown> = {
  "product-information": productPage, "product-purchase": productPage, "product-description": productPage, "related-products": productPage,
  "collection-header": { pageType: "collection", resource: { id: "c1", handle: "c", data: { collectionPresentation: { collection: { id: "c1", title: "Cakes", description: "", imageUrl: "https://cdn.example.com/c.jpg" }, products: [], totalProducts: 0 } } } },
  "blog-header": { pageType: "blog", resource: { id: "b1", handle: "news", data: { blog: { title: "News", handle: "news" }, articles: [] } } },
};
const draw = (section: SectionNode, mode: RendererMode, onSelect = vi.fn()) => render(<RegistrySectionRenderer section={section} mode={mode} commerce={commerce} region="template" onSelect={onSelect} storeSlug="demo" {...(PAGES[section.type] ? { page: PAGES[section.type] as never } : {})} />);
const marked = (container: HTMLElement) => [...new Set([...container.querySelectorAll<HTMLElement>("[data-editor-element]")].map((item) => item.dataset.editorElement))].sort();

describe("section elements in the editor preview", () => {
  it.each(Object.entries(SECTION_ELEMENTS))("%s marks every element it declares, only in the editor", async (type, elements) => {
    const section = filled(type);
    const editor = draw(section, "editor");
    await waitFor(() => expect(marked(editor.container)).toEqual(elements.map((element) => element.id).sort()));
    editor.unmount();
    expect(marked(draw(section, "published").container)).toEqual([]);
  });

  it("clicking an element selects it, not its section; the nth product card keeps its place", async () => {
    const onSelect = vi.fn();
    const view = draw(filled("product-grid"), "editor", onSelect);
    fireEvent.click(view.getByText("Our picks"));
    expect(onSelect).toHaveBeenLastCalledWith({ kind: "section", region: "template", sectionId: "product-grid-1", elementId: "heading", elementIndex: 0 });
    await waitFor(() => expect(view.container.querySelectorAll('[data-editor-element="productCard"]')).toHaveLength(2));
    fireEvent.click(view.container.querySelectorAll('[data-editor-element="productCard"]')[1]);
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ elementId: "productCard", elementIndex: 1 }));
  });

  it("a block inside the section still wins over the section's own parts", () => {
    const onSelect = vi.fn();
    const hero = { ...filled("hero"), blocks: [{ id: "h", type: "heading", enabled: true, settings: { text: "Made for everyday" } }] };
    const view = draw(hero, "editor", onSelect);
    fireEvent.click(view.getByText("Made for everyday"));
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "block", blockId: "h" }));
    fireEvent.click(view.getByText("New season"));
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "section", elementId: "eyebrow" }));
  });

  it("element style settings draw inline on that element only, in the editor and the live store", () => {
    const section = filled("product-grid", { el_heading_color: "#aa2200", el_heading_size: 48, el_heading_align: "center", el_heading_font: "Inter", el_heading_weight: "700" });
    expect(validateSectionAgainstRegistry(section, "home")).toEqual([]);
    const heading = draw(section, "published").getByText("Our picks");
    expect(heading.style.color).toBe("rgb(170, 34, 0)");
    expect(heading.style.fontSize).toBe("48px");
    expect(heading.style.textAlign).toBe("center");
    expect(heading.style.fontWeight).toBe("700");
    expect(heading.style.fontFamily).toContain("--font-inter");
  });

  it("refuses element style values outside their limits", () => {
    const issues = validateSectionAgainstRegistry(filled("product-grid", { el_heading_color: "red", el_heading_size: 400 }), "home");
    expect(issues.some((issue) => issue.code === "SETTINGS_INVALID")).toBe(true);
  });

  it("element style settings stay out of the section's own panel list but are known to the section", () => {
    const controls = getSectionDefinition("hero")?.controls ?? [];
    expect(controls.filter((control) => control.element === "eyebrow").map((control) => control.key)).toEqual(["el_eyebrow_color", "el_eyebrow_font", "el_eyebrow_size", "el_eyebrow_weight", "el_eyebrow_align"]);
  });

  // Each block with parts, in a section that draws it.
  const blockCases: Array<[string, string, Record<string, unknown>]> = [
    ["column", "multicolumn", { heading: "Free delivery", text: "On every order" }],
    ["collection-card", "category-grid", { label: "Beds", image, link: "/collections/beds" }],
    ["testimonial", "testimonials", { quote: "Lovely", author: "Sam" }],
  ];
  it("every block part is covered here", () => {
    expect(blockCases.map(([type]) => type).sort()).toEqual(Object.keys(BLOCK_ELEMENTS).sort());
  });
  it.each(blockCases)("%s marks its parts inside the block, and a click selects the block's part", (type, sectionType, settings) => {
    const onSelect = vi.fn();
    const section = { ...filled(sectionType), blocks: [{ id: "b1", type, enabled: true, settings }] };
    const view = draw(section, "editor", onSelect);
    const block = view.container.querySelector<HTMLElement>('[data-editor-block-id="b1"]')!;
    const parts = BLOCK_ELEMENTS[type].map((element) => element.id);
    expect(marked(block)).toEqual([...parts].sort());
    fireEvent.click(block.querySelector(`[data-editor-element="${parts[0]}"]`)!);
    expect(onSelect).toHaveBeenLastCalledWith({ kind: "block", region: "template", sectionId: section.id, blockId: "b1", elementId: parts[0], elementIndex: 0 });
  });
});
