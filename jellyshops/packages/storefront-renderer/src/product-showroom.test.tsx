import { act, fireEvent, render, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "./runtime-context";
import type { ProductPresentationContext } from "./types";
import { ProductInformationSection, ProductOptionsSection, ProductPurchaseSection } from "./sections/product-sections";
import { monthlyPayment, priceSaving } from "./sections/product-showroom";

const format = (minor: number) => `£${(minor / 100).toFixed(2)}`;
const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => violation.id);

function product(overrides: Partial<ProductPresentationContext> = {}): ProductPresentationContext {
  return {
    product: {
      id: "bed", title: "Harbour bed", description: "", imageUrl: "https://example.com/bed.jpg",
      options: [
        { id: "colour", name: "Colour", required: true, display: "color", values: [{ id: "oat", label: "Oat", selected: true, available: true, color: "#d8cbb5" }, { id: "slate", label: "Slate", selected: false, available: true, color: "#5a6470" }] },
        { id: "size", name: "Size", required: true, missing: true, values: [{ id: "double", label: "Double", selected: false, available: true }, { id: "king", label: "King", selected: false, available: false, priceAdjustment: "£100.00" }] },
        { id: "storage", name: "Storage", required: false, values: [{ id: "drawers", label: "2 drawers", selected: false, available: true, previewImageUrl: "https://example.com/drawers.jpg", priceAdjustment: "£80.00" }] },
      ],
    },
    selection: [{ optionId: "colour", valueId: "oat" }],
    quantity: 1,
    pricing: { price: "£499.00", compareAtPrice: "£999.00", priceMinor: 49_900, compareAtPriceMinor: 99_900, format },
    availability: { state: "available", message: "In stock", maxQuantity: 5 },
    canAddToCart: true,
    selectOption: vi.fn(),
    setQuantity: vi.fn(),
    addToCart: vi.fn(async () => ({ ok: true })),
    relatedProducts: [],
    ...overrides,
  };
}
const context = (presentation: ProductPresentationContext, mode: StorefrontRuntimeContext["mode"] = "published"): StorefrontRuntimeContext => ({
  mode, storeSlug: "demo", commerce: { getProducts: async () => [] },
  page: { pageType: "product", resource: { id: "bed", handle: "bed", data: { productPresentation: presentation } } },
} as StorefrontRuntimeContext);
const section = (type: string, settings: Record<string, unknown>): SectionNode => ({ id: type, type, enabled: true, settings, blocks: [] });

describe("price extras", () => {
  it("works out the saving and the monthly payment, rounding the payment up", () => {
    expect(priceSaving(product().pricing)).toEqual({ percent: 50, saving: "£500.00" });
    expect(priceSaving({ price: "£10", priceMinor: 1000, compareAtPriceMinor: 1000, format })).toBeNull();
    expect(priceSaving({ price: "£10" })).toBeNull();
    expect(monthlyPayment(product().pricing, 12)).toBe("£41.59");
    expect(monthlyPayment(product().pricing, 0)).toBeNull();
    expect(monthlyPayment({ price: "£10", priceMinor: 1000 }, 12)).toBeNull();
  });

  it("shows a % off or Save label beside the price, and a finance line with a link", () => {
    const { container, rerender } = render(<ProductInformationSection context={context(product())} section={{ settings: { discountChip: "percent", financeMonths: 12, financeLink: "/pages/finance" } }} />);
    const view = within(container);
    expect(view.getByText("50% off")).toHaveClass("jelly-price-chip");
    expect(container.querySelector(".jelly-finance-line")?.textContent).toBe("or £41.59 a month for 12 months Learn more");
    expect(view.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "/demo/pages/finance");
    rerender(<ProductInformationSection context={context(product())} section={{ settings: { discountChip: "amount", financeMonths: 10, financeText: "Pay {amount}/month, 0% APR" } }} />);
    expect(view.getByText("Save £500.00")).toBeInTheDocument();
    expect(container.querySelector(".jelly-finance-line")?.textContent).toBe("Pay £49.90/month, 0% APR");
  });

  it("shows nothing extra by default or without a higher old price", () => {
    const { container } = render(<ProductInformationSection context={context(product({ pricing: { price: "£499.00", priceMinor: 49_900, format } }))} section={{ settings: { discountChip: "percent" } }} />);
    expect(container.querySelector(".jelly-price-chip")).toBeNull();
    expect(container.querySelector(".jelly-finance-line")).toBeNull();
  });
});

describe("option tiles and tabs", () => {
  it("draws every option as large tiles with pictures, extra cost and sold out", async () => {
    const presentation = product();
    const { container } = render(<ProductOptionsSection context={context(presentation)} section={{ settings: { style: "tiles", tileColumns: 4 } }} />);
    expect(container.querySelector(".jelly-product-options")).toHaveStyle("--jelly-tile-columns: 4");
    expect(container.querySelectorAll("fieldset")).toHaveLength(3);
    const view = within(container);
    expect(view.getByRole("button", { name: "Oat" })).toHaveAttribute("aria-pressed", "true");
    expect(view.getByRole("button", { name: /King/ })).toBeDisabled();
    expect(view.getByRole("button", { name: /King/ }).textContent).toContain("Sold out");
    expect(view.getByRole("button", { name: /2 drawers/ }).querySelector("img")).toHaveAttribute("src", "https://example.com/drawers.jpg");
    fireEvent.click(view.getByRole("button", { name: "Slate" }));
    expect(presentation.selectOption).toHaveBeenCalledWith("colour", "slate");
    expect(await noViolations(container)).toEqual([]);
  });

  it("puts each option in a tab showing the chosen value, with arrow keys between tabs", async () => {
    const presentation = product();
    const { container } = render(<ProductOptionsSection context={context(presentation)} section={{ settings: { style: "tabs" } }} />);
    const view = within(container);
    const tabs = view.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["ColourOat", "2Size (required)Choose", "3StorageOptional"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("data-missing", "true");
    expect(view.getByRole("tabpanel")).toHaveAccessibleName(/Colour/);
    expect(view.getAllByRole("button", { name: /Oat|Slate/ })).toHaveLength(2);
    act(() => { tabs[0].focus(); });
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(view.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(view.getAllByRole("tab")[1]);
    expect(view.getByRole("button", { name: "Double" })).toBeInTheDocument();
    fireEvent.keyDown(view.getAllByRole("tab")[1], { key: "End" });
    expect(view.getByRole("button", { name: /2 drawers/ })).toBeInTheDocument();
    fireEvent.keyDown(view.getAllByRole("tab")[2], { key: "ArrowRight" });
    expect(view.getAllByRole("tab")[0]).toHaveAttribute("aria-selected", "true");
    expect(await noViolations(container)).toEqual([]);
  });

  it("uses plain tiles when there is only one option", () => {
    const one = product();
    one.product.options = one.product.options.slice(0, 1);
    const { container } = render(<ProductOptionsSection context={context(one)} section={{ settings: { style: "tabs" } }} />);
    expect(within(container).queryByRole("tablist")).toBeNull();
    expect(container.querySelectorAll(".jelly-option-tile")).toHaveLength(2);
  });
});

describe("sticky add to basket bar", () => {
  type Callback = (entries: Array<{ isIntersecting: boolean; boundingClientRect: { top: number } }>) => void;
  let observed: Callback | undefined;
  const original = window.IntersectionObserver;
  afterEach(() => { window.IntersectionObserver = original; observed = undefined; });
  function mockObserver() {
    window.IntersectionObserver = class { constructor(callback: Callback) { observed = callback; } observe() {} disconnect() {} } as unknown as typeof IntersectionObserver;
  }

  it("appears once the page's own button has scrolled up, and adds to the basket", async () => {
    mockObserver();
    const presentation = product();
    const { container } = render(<ProductPurchaseSection context={context(presentation)} section={{ settings: { stickyBar: true, label: "Add to basket" } }} />);
    const bar = container.querySelector(".jelly-sticky-purchase") as HTMLElement;
    expect(bar).not.toBeVisible();
    act(() => observed?.([{ isIntersecting: false, boundingClientRect: { top: -200 } }]));
    expect(bar).toBeVisible();
    expect(within(bar).getByText("Harbour bed")).toBeInTheDocument();
    await act(async () => { fireEvent.click(within(bar).getByRole("button", { name: "Add to basket" })); });
    expect(presentation.addToCart).toHaveBeenCalledTimes(1);
    act(() => observed?.([{ isIntersecting: true, boundingClientRect: { top: 300 } }]));
    expect(bar).not.toBeVisible();
    act(() => observed?.([{ isIntersecting: false, boundingClientRect: { top: 900 } }]));
    expect(bar).not.toBeVisible();
    expect(await noViolations(container)).toEqual([]);
  });

  it("asks shoppers to choose options first, and is off unless the merchant turns it on", () => {
    mockObserver();
    const scroll = vi.fn();
    const { container } = render(<>
      <section className="jelly-product-options"><button type="button">Double</button></section>
      <ProductPurchaseSection context={context(product({ canAddToCart: false, availability: { state: "selection-required", message: "Choose the required options" } }))} section={{ settings: { stickyBar: true } }} />
    </>);
    (container.querySelector(".jelly-product-options") as HTMLElement).scrollIntoView = scroll;
    act(() => observed?.([{ isIntersecting: false, boundingClientRect: { top: -10 } }]));
    fireEvent.click(within(container.querySelector(".jelly-sticky-purchase") as HTMLElement).getByRole("button", { name: "Choose options" }));
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toHaveTextContent("Double");
    const plain = render(<ProductPurchaseSection context={context(product())} section={{ settings: {} }} />);
    expect(plain.container.querySelector(".jelly-sticky-purchase")).toBeNull();
  });
});

describe("registry", () => {
  it("accepts the new product page settings and refuses bad values", () => {
    expect(validateSectionAgainstRegistry(section("product-options", { style: "tabs", tileColumns: 4 }), "product")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("product-options", { style: "tiles", tileColumns: 7 }), "product")).not.toEqual([]);
    expect(validateSectionAgainstRegistry(section("product-information", { discountChip: "percent", financeMonths: 24, financeText: "or {amount} a month" }), "product")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("product-information", { financeMonths: 120 }), "product")).not.toEqual([]);
    expect(validateSectionAgainstRegistry(section("product-purchase", { stickyBar: true }), "product")).toEqual([]);
  });
});
