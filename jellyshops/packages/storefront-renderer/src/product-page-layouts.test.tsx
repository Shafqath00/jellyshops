import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { SectionNode } from "@jelly/storefront-schema";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { StorefrontRuntimeContext } from "./runtime-context";
import { ProductGallerySection } from "./sections/product-sections";

const presentation = { product: { id: "p", title: "Lamp", description: "", imageUrl: "https://cdn.example.com/lamp.jpg", options: [] }, addToCart: async () => ({ ok: true }) };
const context = { mode: "published", storeSlug: "demo", commerce: { getProducts: async () => [] }, page: { pageType: "product", resource: { id: "p", handle: "lamp", data: { productPresentation: presentation } } } } as unknown as StorefrontRuntimeContext;

describe("product page layouts", () => {
  it("marks the gallery with the chosen page layout, and leaves the theme default unmarked", () => {
    const withLayout = render(<ProductGallerySection context={context} section={{ settings: { layout: "stacked", pageLayout: "gallery-right" } }} />);
    expect(withLayout.container.querySelector(".jelly-product-gallery")).toHaveAttribute("data-page-layout", "gallery-right");
    withLayout.unmount();
    const theme = render(<ProductGallerySection context={context} section={{ settings: { layout: "stacked" } }} />);
    expect(theme.container.querySelector(".jelly-product-gallery")).not.toHaveAttribute("data-page-layout");
    theme.unmount();
    const unknown = render(<ProductGallerySection context={context} section={{ settings: { layout: "stacked", pageLayout: "sideways" } }} />);
    expect(unknown.container.querySelector(".jelly-product-gallery")).not.toHaveAttribute("data-page-layout");
  });

  it("the registry accepts every layout and refuses others", () => {
    const section = (pageLayout: string) => ({ id: "g", type: "product-gallery", enabled: true, blocks: [], settings: { imageFit: "cover", pageLayout } }) as SectionNode;
    for (const layout of ["theme", "gallery-left", "gallery-right", "centred", "compact", "details-below"]) expect(validateSectionAgainstRegistry(section(layout), "product")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("sideways"), "product").length).toBeGreaterThan(0);
  });
});
