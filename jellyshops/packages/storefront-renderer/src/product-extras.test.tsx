import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { createStorefrontRuntimeContext } from "./runtime-context";
import { ProductStockCounterSection, ProductTabsSection } from "./sections/product-extras";
import type { StorefrontPageContext } from "./types";

const block = (id: string, type: string, settings: Record<string, unknown>) => ({ id, type, enabled: true, settings });
const section = (type: string, settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []): SectionNode => ({ id: `${type}-1`, type, enabled: true, settings, blocks });
const productPage = (availability: Record<string, unknown>) => ({ pageType: "product", resource: { id: "p", handle: "p", data: { productPresentation: { availability } } } }) as unknown as StorefrontPageContext;
const contextFor = (page?: StorefrontPageContext) => createStorefrontRuntimeContext({ mode: "published", region: "template", commerce: { async getProducts() { return []; } }, page });

describe("product information tabs", () => {
  const tabs = section("product-tabs", {}, [
    block("t1", "info-tab", { title: "Materials & care", text: "Organic cotton.\n\nMachine wash cold." }),
    block("t2", "info-tab", { title: "Shipping & returns", text: "Free delivery." }),
    block("t3", "info-tab", { title: "", text: "Ignored without a title." }),
  ]);

  it("shows one accordion item per titled tab, closed by default, with text split into paragraphs", () => {
    const { container } = render(<ProductTabsSection section={tabs} />);
    const items = container.querySelectorAll("details");
    expect(items).toHaveLength(2);
    expect([...items].every((item) => !item.open)).toBe(true);
    expect(within(items[0] as HTMLElement).getAllByText(/cotton|wash/)).toHaveLength(2);
    expect(screen.getByText("Shipping & returns")).toBeInTheDocument();
  });

  it("can open the first tab and renders nothing without tabs", () => {
    const { container, rerender } = render(<ProductTabsSection section={{ ...tabs, settings: { firstOpen: true } }} />);
    expect((container.querySelectorAll("details")[0] as HTMLDetailsElement).open).toBe(true);
    rerender(<ProductTabsSection section={section("product-tabs", {})} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("stock counter", () => {
  const counter = (settings: Record<string, unknown> = {}) => section("product-stock-counter", settings);

  it("shows the count when stock is plentiful and a low-stock message at the threshold", () => {
    const { rerender } = render(<ProductStockCounterSection section={counter()} context={contextFor(productPage({ state: "available", maxQuantity: 72 }))} />);
    expect(screen.getByRole("status")).toHaveTextContent("72 items in stock");
    rerender(<ProductStockCounterSection section={counter({ lowStockThreshold: 10 })} context={contextFor(productPage({ state: "available", maxQuantity: 3 }))} />);
    expect(screen.getByRole("status")).toHaveTextContent("Only 3 left");
    rerender(<ProductStockCounterSection section={counter()} context={contextFor(productPage({ state: "available", maxQuantity: 1 }))} />);
    expect(screen.getByRole("status")).toHaveTextContent("Only 1 left");
  });

  it("can hide the count until stock runs low, and shows nothing when stock is untracked, unavailable or off the product page", () => {
    const hidden = counter({ showWhenPlentiful: false });
    const { container, rerender } = render(<ProductStockCounterSection section={hidden} context={contextFor(productPage({ state: "available", maxQuantity: 40 }))} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ProductStockCounterSection section={counter()} context={contextFor(productPage({ state: "available" }))} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ProductStockCounterSection section={counter()} context={contextFor(productPage({ state: "selection-required", maxQuantity: 0 }))} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ProductStockCounterSection section={counter()} context={contextFor()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
