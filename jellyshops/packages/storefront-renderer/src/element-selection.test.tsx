import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSectionFromDefinition, getSectionDefinition, SECTION_ELEMENTS, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import type { CommerceDataProvider, RendererMode } from "./types";

const product = { id: "p1", name: "Linen shirt", href: "/products/linen-shirt", price: "£40.00", imageUrl: "" };
const commerce: CommerceDataProvider = { getProducts: async () => [product, { ...product, id: "p2" }] };
const image = { id: "m1", url: "https://cdn.example.com/photo.jpg", alt: "" };

/** A section with every element filled in, and without heading/text blocks so the copy comes from section settings. */
function filled(type: string, extra: Record<string, unknown> = {}): SectionNode {
  const section = createSectionFromDefinition(type, () => `${type}-1`);
  return { ...section, id: `${type}-1`, blocks: section.blocks.filter((block) => !["heading", "text"].includes(block.type)), settings: { ...section.settings, eyebrow: "New season", heading: "Our picks", text: "Chosen this week", viewAllLabel: "View all", image, ...extra } };
}
const draw = (section: SectionNode, mode: RendererMode, onSelect = vi.fn()) => render(<RegistrySectionRenderer section={section} mode={mode} commerce={commerce} region="template" onSelect={onSelect} storeSlug="demo" />);
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
});
