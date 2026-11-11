import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "./runtime-context";
import type { CommerceDataProvider, ProductPresentationContext } from "./types";
import { ProductGallerySection, ProductOptionsSection } from "./sections/product-sections";
import { ProductDimensionsSection, dimensionRows, formatLength, parseLength } from "./sections/product-dimensions";
import { ProductSpecificationsSection } from "./sections/product-extras";
import { RatingSummarySection, storeReviewRating } from "./sections/social-proof";

afterEach(cleanup);

const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => violation.id);

function product(overrides: Partial<ProductPresentationContext["product"]> = {}, rest: Partial<ProductPresentationContext> = {}): ProductPresentationContext {
  return {
    product: {
      id: "ascot-natural", title: "Ascot bed - Natural", description: "", imageUrl: "https://example.com/bed.jpg",
      specifications: { "Width (Double)": "140 cm", "Width (King)": "1550 mm", "Length": "200cm", "Height (King)": "45 in", "Fabric": "Velvet" },
      options: [{ id: "size", name: "Size", required: true, values: [{ id: "double", label: "Double", selected: false, available: true }, { id: "king", label: "King", selected: true, available: true }] }],
      ...overrides,
    },
    selection: [{ optionId: "size", valueId: "king" }], quantity: 1,
    pricing: { price: "£289.00" }, availability: { state: "available", message: "In stock" },
    canAddToCart: true, selectOption: vi.fn(), setQuantity: vi.fn(), addToCart: vi.fn(async () => ({ ok: true })), relatedProducts: [],
    ...rest,
  };
}
const context = (presentation: ProductPresentationContext, mode: StorefrontRuntimeContext["mode"] = "published", commerce: Partial<CommerceDataProvider> = {}): StorefrontRuntimeContext => ({
  mode, storeSlug: "demo", commerce: { getProducts: async () => [], ...commerce },
  page: { pageType: "product", resource: { id: presentation.product.id, handle: "ascot", data: { productPresentation: presentation } } },
} as StorefrontRuntimeContext);
const section = (type: string, settings: Record<string, unknown> = {}): SectionNode => ({ id: type, type, enabled: true, settings, blocks: [] });

describe("Dimensions", () => {
  it("reads lengths in any common unit and converts them", () => {
    expect(parseLength("150 cm")).toBe(150);
    expect(parseLength("1500mm")).toBe(150);
    expect(parseLength("1,5 m")).toBe(150);
    expect(parseLength('59"')).toBeCloseTo(149.86);
    expect(parseLength("Velvet")).toBeNull();
    expect(parseLength("0 cm")).toBeNull();
    expect(formatLength(150, "cm")).toBe("150 cm");
    expect(formatLength(150, "in")).toBe("59.1 in");
  });

  it("follows the chosen size, lets a sized row win, and falls back to the first size", () => {
    const specs = { "Width (Double)": "140 cm", "Width (King)": "155 cm", "Width": "999 cm", "Length": "200 cm" };
    expect(dimensionRows(specs, ["King"])).toEqual({ size: "King", rows: [{ letter: "A", name: "Width", cm: 155 }, { letter: "B", name: "Length", cm: 200 }] });
    expect(dimensionRows(specs, []).size).toBe("Double");
    expect(dimensionRows({ Length: "200 cm" }, [])).toEqual({ rows: [{ letter: "A", name: "Length", cm: 200 }] });
  });

  it("reads sizes written as W x L x H in one row", () => {
    const specs = { "Double (W x L x H)": "146 x 205 x 120 cm", "King (W x L x H)": "161 x 215 x 120 cm", "Fabric": "Woven polyester", "Base height": "35 cm" };
    expect(dimensionRows(specs, ["King"])).toEqual({ size: "King", rows: [{ letter: "A", name: "Width", cm: 161 }, { letter: "B", name: "Length", cm: 215 }, { letter: "C", name: "Height", cm: 120 }, { letter: "D", name: "Base height", cm: 35 }] });
    expect(dimensionRows({ "Dimensions (W x D)": "60 x 40 cm" }, []).rows.map((row) => row.name)).toEqual(["Width", "Depth"]);
    expect(dimensionRows({ "Double (W x L x H)": "146 x 205 cm" }, []).rows).toEqual([]);
  });

  it("starts with the product's first size and lists width, length and height first, whatever order the store saved", () => {
    const saved = { "Base height": "35 cm", "King (W x L x H)": "161 x 215 x 120 cm", "Double (W x L x H)": "146 x 205 x 120 cm" };
    expect(dimensionRows(saved, [], ["Double", "King", "No storage"])).toEqual({ size: "Double", rows: [{ letter: "A", name: "Width", cm: 146 }, { letter: "B", name: "Length", cm: 205 }, { letter: "C", name: "Height", cm: 120 }, { letter: "D", name: "Base height", cm: 35 }] });
    expect(dimensionRows(saved, ["King"], ["Double", "King"]).size).toBe("King");
  });

  it("draws lettered rows for the chosen size with a cm/inches switch", async () => {
    const { container } = render(<ProductDimensionsSection section={section("product-dimensions", { note: "Allow 2 cm either way." })} context={context(product())} product={product()} />);
    expect(screen.getByText("King")).toBeInTheDocument();
    const list = container.querySelector("dl")!;
    expect(within(list as HTMLElement).getAllByRole("definition").map((cell) => cell.textContent)).toEqual(["155 cm", "200 cm", "114.3 cm"]);
    fireEvent.click(screen.getByRole("button", { name: "inches" }));
    expect(screen.getByRole("button", { name: "inches" })).toHaveAttribute("aria-pressed", "true");
    expect(within(list as HTMLElement).getAllByRole("definition").map((cell) => cell.textContent)).toEqual(["61 in", "78.7 in", "45 in"]);
    expect(screen.getByText("Allow 2 cm either way.")).toBeInTheDocument();
    expect(await noViolations(container)).toEqual([]);
  });

  it("is hidden on the live store without measurements and explains itself in the editor", () => {
    const bare = product({ specifications: { Fabric: "Velvet" } });
    const { container } = render(<ProductDimensionsSection section={section("product-dimensions")} context={context(bare)} product={bare} />);
    expect(container).toBeEmptyDOMElement();
    render(<ProductDimensionsSection section={section("product-dimensions")} context={context(bare, "editor")} product={bare} />);
    expect(screen.getByText(/Add measurements to the product/)).toBeInTheDocument();
  });

  it("lets Specifications leave the measurements out", () => {
    render(<ProductSpecificationsSection section={section("product-specifications", { hideMeasurements: true })} context={context(product())} />);
    expect(screen.getByText("Fabric")).toBeInTheDocument();
    expect(screen.queryByText("Length")).toBeNull();
  });

  it("has valid default settings", () => {
    expect(validateSectionAgainstRegistry(section("product-dimensions", { heading: "Dimensions", unit: "in", showUnitSwitch: false, diagram: { url: "https://example.com/d.png" } }), "product")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("product-dimensions", { diagram: { url: "javascript:alert(1)" } }), "product").length).toBeGreaterThan(0);
  });
});

describe("Other colours (product family)", () => {
  const family: ProductPresentationContext["family"] = { label: "Colour", members: [
    { id: "ascot-natural", label: "Natural", href: "/demo/products/ascot-natural", current: true, color: "#d8cbb5" },
    { id: "ascot-navy", label: "Navy", href: "/demo/products/ascot-navy", current: false, image: "https://example.com/navy.jpg" },
    { id: "ascot-stone", label: "Stone", href: "/demo/products/ascot-stone", current: false },
  ] };

  it("links the other colours and marks the one shown", async () => {
    const presentation = product({}, { family });
    const { container } = render(<ProductOptionsSection context={context(presentation)} section={{ settings: {} }} />);
    const nav = screen.getByRole("navigation", { name: "Other colour choices" });
    expect(nav).toHaveTextContent("Colour: Natural");
    expect(within(nav).getByRole("link", { name: "Navy" })).toHaveAttribute("href", "/demo/products/ascot-navy");
    expect(within(nav).queryByRole("link", { name: /Natural/ })).toBeNull();
    expect(nav.querySelector("[aria-current='true']")).toHaveTextContent("Natural (shown)");
    expect(await noViolations(container)).toEqual([]);
  });

  it("shows for a product with no options and can be switched off", () => {
    const presentation = product({ options: [] }, { family });
    const first = render(<ProductOptionsSection context={context(presentation)} section={{ settings: {} }} />);
    expect(screen.getByRole("link", { name: "Stone" })).toBeInTheDocument();
    first.unmount();
    const { container } = render(<ProductOptionsSection context={context(presentation)} section={{ settings: { showFamily: false } }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Photo label and rating from reviews", () => {
  it("puts the label over the main photo", () => {
    render(<ProductGallerySection context={context(product())} section={{ settings: { badgeText: "60-night trial" } }} />);
    expect(screen.getByText("60-night trial")).toHaveClass("jelly-gallery-badge");
  });

  it("averages the store's reviews, or uses the product's own on its page", () => {
    const ratings = { a: { average: 5, count: 3 }, b: { average: 4, count: 1 }, c: { average: 0, count: 0 } };
    expect(storeReviewRating(ratings)).toEqual({ rating: 4.8, count: 4 });
    expect(storeReviewRating(ratings, "b")).toEqual({ rating: 4, count: 1 });
    expect(storeReviewRating(ratings, "missing")).toEqual({ rating: 0, count: 0 });
    expect(storeReviewRating(undefined)).toEqual({ rating: 0, count: 0 });
  });

  it("draws the store's reviews and stays hidden without any", () => {
    const presentation = product();
    render(<RatingSummarySection section={section("rating-summary", { source: "reviews", rating: 1, text: "from {count} reviews" })} context={context(presentation, "published", { ratings: { "ascot-natural": { average: 4.6, count: 12 } } })} />);
    expect(screen.getByText("4.6 out of 5")).toBeInTheDocument();
    expect(screen.getByText("from 12 reviews")).toBeInTheDocument();
    cleanup();
    const { container } = render(<RatingSummarySection section={section("rating-summary", { source: "reviews" })} context={context(presentation, "published", { ratings: {} })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
