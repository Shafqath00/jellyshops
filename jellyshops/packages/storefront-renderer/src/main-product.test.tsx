import { fireEvent, render, screen } from "@testing-library/react";
import { getBlockDefinition, getSectionDefinition, listSectionDefinitionsForPage, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import { describe, expect, it, vi } from "vitest";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import type { CommerceDataProvider } from "./types";

const commerce = { getProducts: async () => [] } as unknown as CommerceDataProvider;
const product = {
  pageType: "product" as const,
  resource: { type: "product", id: "p1", handle: "bed", visible: true, data: { title: "Harbour bed", productPresentation: {
    product: { id: "p1", title: "Harbour bed", imageUrl: "/bed.jpg", media: [{ id: "m1", url: "/bed.jpg", altText: "Bed" }], specifications: {} },
    pricing: { price: "£499.00" }, availability: { state: "in-stock", message: "In stock" }, options: [], quantity: 1, setQuantity: () => undefined, addToCart: async () => ({ ok: true }), canAddToCart: true,
  } } },
};

function mainProduct(blocks: SectionNode["blocks"], settings: Record<string, unknown> = {}): SectionNode {
  return { id: "main", type: "main-product", enabled: true, settings, blocks };
}

describe("Main product", () => {
  it("is offered on product pages only, with the product sections as its parts", () => {
    expect(listSectionDefinitionsForPage("product").map((definition) => definition.type)).toContain("main-product");
    expect(listSectionDefinitionsForPage("home").map((definition) => definition.type)).not.toContain("main-product");
    expect(getSectionDefinition("main-product")?.allowedBlockTypes).toEqual(expect.arrayContaining(["part-product-information", "part-product-options", "part-product-purchase", "part-trust-strip", "part-product-description"]));
    expect(getBlockDefinition("part-trust-strip")?.allowedBlockTypes).toContain("trust-point");
  });

  it("validates part settings and the parts' own blocks", () => {
    const ok = mainProduct([
      { id: "info", type: "part-product-information", enabled: true, settings: { showSku: false } },
      { id: "trust", type: "part-trust-strip", enabled: true, settings: { layout: "row" }, blocks: [{ id: "t1", type: "trust-point", enabled: true, settings: { text: "Free delivery", icon: "truck" } }] },
    ], { mediaPosition: "right", mediaWidth: "wide", stickyColumn: "details" });
    expect(validateSectionAgainstRegistry(ok, "product")).toEqual([]);
    expect(validateSectionAgainstRegistry(mainProduct([{ id: "x", type: "hero", enabled: true, settings: {} } as never]), "product").map((issue) => issue.code)).toContain("BLOCK_NOT_ALLOWED");
    expect(validateSectionAgainstRegistry(mainProduct([], { mediaWidth: "huge" }), "product").map((issue) => issue.code)).toContain("SETTINGS_INVALID");
    expect(validateSectionAgainstRegistry(ok, "home").map((issue) => issue.code)).toContain("SECTION_NOT_ALLOWED_ON_PAGE");
  });

  it("draws the photos and the buying column itself, parts in order, hidden parts left out", () => {
    const { container } = render(<RegistrySectionRenderer mode="published" commerce={commerce} page={product as never} section={mainProduct([
      { id: "info", type: "part-product-information", enabled: true, settings: {} },
      { id: "hidden", type: "part-product-description", enabled: false, settings: {} },
      { id: "buy", type: "part-product-purchase", enabled: true, settings: { label: "Add to basket" } },
    ], { mediaPosition: "right", stickyColumn: "details" })} />);
    const section = container.querySelector(".jelly-main-product")!;
    expect(section).toHaveAttribute("data-media-position", "right");
    expect(section).toHaveAttribute("data-sticky", "details");
    expect(section.querySelector(".jelly-main-product-media .jelly-product-gallery")).not.toBeNull();
    expect([...section.querySelectorAll(".jelly-product-part")].map((part) => part.getAttribute("data-part"))).toEqual(["product-information", "product-purchase"]);
    expect(screen.getByRole("heading", { level: 1, name: "Harbour bed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to basket" })).toBeInTheDocument();
  });

  it("selects the whole part in the editor, not a piece inside it", () => {
    const onSelect = vi.fn();
    render(<RegistrySectionRenderer mode="editor" commerce={commerce} page={product as never} onSelect={onSelect} section={mainProduct([
      { id: "info", type: "part-product-information", enabled: true, settings: {} },
    ])} />);
    fireEvent.click(screen.getByRole("heading", { level: 1, name: "Harbour bed" }));
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "block", sectionId: "main", blockId: "info" }));
    expect(onSelect.mock.lastCall?.[0]).not.toHaveProperty("elementId");
  });
});
