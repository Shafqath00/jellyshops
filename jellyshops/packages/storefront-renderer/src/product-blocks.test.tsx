import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { getBlockDefinition, getSectionDefinition, PRODUCT_BLOCK_TYPES, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import { deliveryWindow } from "./sections/product-blocks";
import type { CommerceDataProvider } from "./types";

afterEach(cleanup);
const commerce = { getProducts: async () => [], getCollections: async () => [] } as unknown as CommerceDataProvider;
const related = [
  { id: "p2", name: "Oak bedside table", href: "/demo/products/oak-bedside", imageUrl: "https://example.com/a.jpg", price: "£120.00" },
  { id: "p3", name: "Linen duvet cover", href: "/demo/products/linen-duvet", imageUrl: "https://example.com/b.jpg", price: "£80.00" },
];
const presentation = { product: { id: "p1", title: "Harbour bed", description: "A calm bed.", imageUrl: "", media: [], specifications: { "King (W x L x H)": "161 x 215 x 120 cm" }, options: [] }, pricing: { price: "£499.00" }, availability: { state: "available", message: "In stock" }, options: [], selection: [], quantity: 1, setQuantity: () => undefined, selectOption: () => undefined, addToCart: async () => ({ ok: true }), canAddToCart: true, relatedProducts: related };
const productPage = { pageType: "product", resource: { type: "product", id: "p1", handle: "harbour-bed", visible: true, data: { title: "Harbour bed", productPresentation: presentation } } };
const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);

function blockOf(type: string, id = type): BlockNode {
  const definition = getBlockDefinition(type)!;
  return { id, type, enabled: true, settings: structuredClone(definition.defaultSettings), ...(definition.defaultBlocks ? { blocks: structuredClone(definition.defaultBlocks) } : {}) };
}
const mainProduct = (blocks: BlockNode[]): SectionNode => ({ id: "main", type: "main-product", enabled: true, settings: structuredClone(getSectionDefinition("main-product")!.defaultSettings), blocks });
const draw = (blocks: BlockNode[], mode: "editor" | "published" = "published", page: unknown = productPage) =>
  render(<RegistrySectionRenderer section={mainProduct(blocks)} mode={mode} commerce={commerce} page={page as never} storeSlug="demo" />).container;

describe("Main product buying column", () => {
  it("takes product parts, product blocks and the shared content blocks", () => {
    const allowed = getSectionDefinition("main-product")!.allowedBlockTypes;
    for (const type of ["part-product-information", "part-product-purchase", "part-product-dimensions", ...PRODUCT_BLOCK_TYPES, "accordion", "icon-list", "share", "app"]) expect(allowed).toContain(type);
    expect(allowed).not.toContain("slide");
    expect(getSectionDefinition("main-product")!.blockSets).toEqual(["@product", "@content", "@app"]);
    // Product blocks stay out of Custom section (they need a product).
    expect(getSectionDefinition("custom-content")!.allowedBlockTypes).not.toContain("delivery-estimate");
  });

  it("validates a column mixing parts, product blocks and content blocks", () => {
    const blocks = [blockOf("product-breadcrumbs"), blockOf("part-product-information"), blockOf("part-product-purchase"), blockOf("delivery-estimate"), blockOf("notice"), blockOf("accordion"), blockOf("complementary-products"), blockOf("part-product-dimensions")];
    expect(validateSectionAgainstRegistry(mainProduct(blocks), "product")).toEqual([]);
  });

  it("draws product blocks and content blocks beside the photos, without accessibility problems", async () => {
    const container = draw([blockOf("product-breadcrumbs"), blockOf("part-product-information"), blockOf("notice"), blockOf("accordion"), blockOf("complementary-products")]);
    const column = container.querySelector(".jelly-main-product-details")!;
    expect(column.querySelector(".jelly-product-breadcrumbs [aria-current]")?.textContent).toBe("Harbour bed");
    expect(column.querySelector(".jelly-product-breadcrumbs a[href='/demo/shop']")).not.toBeNull();
    expect(column.querySelector(".jelly-notice")?.textContent).toContain("WELCOME10");
    expect(column.querySelectorAll("details.jelly-accordion-row")).toHaveLength(3);
    expect([...column.querySelectorAll(".jelly-complementary-name")].map((item) => item.textContent)).toEqual(["Oak bedside table", "Linen duvet cover"]);
    expect(column.querySelectorAll(".jelly-product-part[data-part='block']")).toHaveLength(4);
    expect(await noViolations(container)).toEqual([]);
  });

  it("draws Dimensions as a part", () => {
    const container = draw([blockOf("part-product-dimensions")]);
    expect(container.querySelector(".jelly-product-part[data-part='product-dimensions']")).not.toBeNull();
  });

  it("marks content blocks for the editor so they can be selected", () => {
    const container = draw([blockOf("notice", "n1"), blockOf("delivery-estimate", "d1")], "editor");
    expect(container.querySelector("[data-editor-block-id='n1']")).not.toBeNull();
  });

  it("explains product blocks outside a product page in the editor, and hides them for shoppers", () => {
    const section: SectionNode = { id: "c", type: "custom-content", enabled: true, settings: {}, blocks: [blockOf("delivery-estimate")] };
    render(<RegistrySectionRenderer section={section} mode="editor" commerce={commerce} page={{ pageType: "home" } as never} />);
    expect(screen.getByText("Delivery estimate shows on product pages")).toBeInTheDocument();
  });
});

describe("delivery estimate", () => {
  // Wednesday 12 November 2025, 10:00 and 16:00 in London (GMT).
  const wedMorning = Date.UTC(2025, 10, 12, 10);
  const wedEvening = Date.UTC(2025, 10, 12, 16);
  const fridayEvening = Date.UTC(2025, 10, 14, 16);
  const day = (date: Date) => date.toISOString().slice(0, 10);

  it("counts working days from today before the cut-off", () => {
    const window = deliveryWindow({ cutoffHour: 14, dispatchDays: 0, deliveryMin: 2, deliveryMax: 4 }, wedMorning);
    expect(window.hoursLeft).toBe(4);
    expect(day(window.from)).toBe("2025-11-14");
    expect(day(window.to)).toBe("2025-11-18");
  });

  it("starts from the next working day after the cut-off and skips weekends", () => {
    expect(day(deliveryWindow({ cutoffHour: 14, deliveryMin: 1, deliveryMax: 1 }, wedEvening).from)).toBe("2025-11-14");
    const friday = deliveryWindow({ cutoffHour: 14, deliveryMin: 1, deliveryMax: 2 }, fridayEvening);
    expect(friday.hoursLeft).toBe(0);
    expect(day(friday.from)).toBe("2025-11-18");
    expect(day(friday.to)).toBe("2025-11-19");
  });

  it("counts weekends when the shop delivers on them", () => {
    expect(day(deliveryWindow({ cutoffHour: 14, deliveryMin: 1, deliveryMax: 1, weekendDispatch: true }, fridayEvening).from)).toBe("2025-11-16");
  });
});
