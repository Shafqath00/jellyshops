import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { createStorefrontRuntimeContext, type StorefrontRuntimeContext } from "./runtime-context";
import { SlideshowSection } from "./sections/slideshow";
import { VideoBlock } from "./sections/block-content";
import { HeaderSection } from "./sections/header";
import { ProductOptionsSection } from "./sections/product-sections";
import { OptionTiles } from "./sections/product-showroom";
import type { ProductPresentationContext } from "./types";

/**
 * Phase 4 of docs/reports/2026-11-09-shopify-template-parity.md: each interactive part behaves like its Shopify
 * counterpart (Dawn's custom elements), whatever theme draws it.
 */
const block = (id: string, type: string, settings: Record<string, unknown>): BlockNode => ({ id, type, enabled: true, settings });
const section = (type: string, settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []): SectionNode => ({ id: `${type}-1`, type, enabled: true, settings, blocks });
const context = createStorefrontRuntimeContext({ mode: "published", region: "template", commerce: { async getProducts() { return []; } }, storeSlug: "demo" });

describe("slideshow", () => {
  afterEach(() => vi.useRealTimers());
  const slides = [
    block("s1", "slide", { heading: "First slide", image: { url: "https://example.com/1.jpg", alt: "" } }),
    block("s2", "slide", { heading: "Second slide", image: { url: "https://example.com/2.jpg", alt: "" } }),
    block("s3", "slide", { heading: "Third slide", image: { url: "https://example.com/3.jpg", alt: "" } }),
  ];
  const current = () => screen.getAllByRole("button", { name: /^Show slide/ }).findIndex((dot) => dot.getAttribute("aria-current") === "true") + 1;

  it("has a Pause button that stops autoplay until Play is pressed (also on touch screens)", () => {
    vi.useFakeTimers();
    render(<SlideshowSection section={section("slideshow", { autoplay: true, interval: 3 }, slides)} context={context} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));
    act(() => { vi.advanceTimersByTime(9000); });
    expect(current()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Play slideshow" }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(current()).toBe(2);
  });

  it("shows no Pause button when the slides do not move on their own", () => {
    render(<SlideshowSection section={section("slideshow", {}, slides)} context={context} />);
    expect(screen.queryByRole("button", { name: /Pause slideshow|Play slideshow/ })).toBeNull();
  });

  it("changes slide with the left and right arrow keys, wrapping round", () => {
    render(<SlideshowSection section={section("slideshow", {}, slides)} context={context} />);
    const carousel = screen.getByRole("region", { name: "Featured" });
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(current()).toBe(2);
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(current()).toBe(3);
  });

  it("changes slide with a sideways swipe but not with an up-and-down scroll", () => {
    const { container } = render(<SlideshowSection section={section("slideshow", {}, slides)} context={context} />);
    const track = container.querySelector(".jelly-slideshow-track") as HTMLElement;
    fireEvent.pointerDown(track, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(track, { clientX: 200, clientY: 110 });
    expect(current()).toBe(2);
    fireEvent.pointerDown(track, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(track, { clientX: 150, clientY: 400 });
    expect(current()).toBe(2);
    fireEvent.pointerDown(track, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(track, { clientX: 220, clientY: 100 });
    expect(current()).toBe(1);
  });

  it("shows the slide selected in the editor", () => {
    const editorContext = createStorefrontRuntimeContext({ mode: "editor", region: "template", commerce: { async getProducts() { return []; } }, storeSlug: "demo" });
    render(<SlideshowSection section={section("slideshow", {}, slides)} context={editorContext} editor selectedBlockId="s3" />);
    expect(current()).toBe(3);
  });
});

describe("video", () => {
  const video = (settings: Record<string, unknown>) => block("v1", "video", settings);

  it("shows a cover with a play button and loads the YouTube player only when pressed", () => {
    const { container } = render(<VideoBlock block={video({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "How it is made" })} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute("src", "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Play video: How it is made" }));
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(frame?.getAttribute("src")).toContain("autoplay=1");
    expect(frame).toHaveAttribute("title", "How it is made");
  });

  it("uses the merchant's cover picture when there is one (Vimeo has no automatic cover)", () => {
    const { container } = render(<VideoBlock block={video({ url: "https://vimeo.com/123456789", poster: { url: "https://example.com/cover.jpg", alt: "" } })} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/cover.jpg");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("starts an autoplaying video at once, but not for shoppers who ask for less motion", () => {
    const autoplay = video({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", autoplay: true });
    const first = render(<VideoBlock block={autoplay} />);
    expect(first.container.querySelector("iframe")?.getAttribute("src")).toContain("mute=1");
    first.unmount();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      const reduced = render(<VideoBlock block={autoplay} />);
      expect(reduced.container.querySelector("iframe")).toBeNull();
      expect(screen.getByRole("button", { name: /^Play video/ })).toBeInTheDocument();
    } finally { window.matchMedia = original; }
  });

  it("never loads a player in the editor", () => {
    const { container } = render(<VideoBlock block={video({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })} editor />);
    fireEvent.click(screen.getByRole("button", { name: /^Play video/ }));
    expect(container.querySelector("iframe")).toBeNull();
  });
});

describe("phone menu", () => {
  const header = section("header", { storeName: "Demo" }, [block("menu", "menu", { handle: "main" })]);
  const withMenu: StorefrontRuntimeContext = { ...context, region: "header", menus: { main: { id: "m", handle: "main", items: [{ id: "a", label: "About", target: { kind: "home" }, children: [] }] } } } as StorefrontRuntimeContext;

  it("names its button by what it does and closes on Escape, returning focus to the button", () => {
    const { container } = render(<HeaderSection section={header} context={withMenu} />);
    const menu = container.querySelector("details.jelly-mobile-navigation") as HTMLDetailsElement;
    const button = container.querySelector("details.jelly-mobile-navigation > summary") as HTMLElement;
    expect(button).toHaveAttribute("aria-label", "Open menu");
    act(() => { menu.open = true; fireEvent(menu, new Event("toggle")); });
    expect(button).toHaveAttribute("aria-label", "Close menu");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(button).toHaveAttribute("aria-label", "Open menu");
  });

  it("closes when the shopper taps outside it", () => {
    const { container } = render(<div><p>Page</p><HeaderSection section={header} context={withMenu} /></div>);
    const menu = container.querySelector("details.jelly-mobile-navigation") as HTMLDetailsElement;
    act(() => { menu.open = true; fireEvent(menu, new Event("toggle")); });
    fireEvent.pointerDown(screen.getByText("Page"));
    expect(menu.open).toBe(false);
  });
});

describe("sold-out option values", () => {
  const presentation = (selectOption = vi.fn()): ProductPresentationContext => ({
    product: { id: "p", title: "Tee", description: "", imageUrl: "", options: [
      { id: "size", name: "Size", required: true, values: [
        { id: "s", label: "Small", selected: false, available: true },
        { id: "m", label: "Medium", selected: false, available: true, soldOut: true },
        { id: "xl", label: "XL", selected: false, available: false },
      ] },
      { id: "colour", name: "Colour", required: true, display: "color", values: [{ id: "red", label: "Red", selected: false, available: true, soldOut: true, color: "#cc0000" }] },
    ] },
    selection: [], quantity: 1, pricing: { price: "£10.00", priceMinor: 1000, format: (minor: number) => `£${minor / 100}` },
    availability: { state: "selection-required", message: "Choose" }, canAddToCart: false,
    selectOption, setQuantity: vi.fn(), addToCart: vi.fn(async () => ({ ok: true })), relatedProducts: [],
  });
  const productContext = (product: ProductPresentationContext) => ({ ...context, page: { pageType: "product", resource: { id: "p", handle: "p", data: { productPresentation: product } } } } as StorefrontRuntimeContext);

  it("keeps a sold-out value selectable and says it is sold out; a value no variant has cannot be chosen", () => {
    const selectOption = vi.fn();
    render(<ProductOptionsSection section={section("product-options", {})} context={productContext(presentation(selectOption))} />);
    const medium = screen.getByRole("button", { name: "Medium, sold out" });
    expect(medium).toBeEnabled();
    expect(medium).toHaveAttribute("data-sold-out", "true");
    fireEvent.click(medium);
    expect(selectOption).toHaveBeenCalledWith("size", "m");
    expect(screen.getByRole("button", { name: "XL" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Red, sold out" })).toBeEnabled();
  });

  it("marks sold-out and unavailable values in a dropdown", () => {
    render(<ProductOptionsSection section={section("product-options", { style: "select" })} context={productContext(presentation())} />);
    expect(screen.getByRole("option", { name: "Medium — sold out" })).toBeEnabled();
    expect(screen.getByRole("option", { name: "XL — unavailable" })).toBeDisabled();
  });

  it("labels sold-out tiles and keeps them selectable", () => {
    const product = presentation();
    render(<OptionTiles option={product.product.options[0]} product={product} />);
    expect(screen.getByRole("button", { name: /Medium.*Sold out/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /XL.*Unavailable/ })).toBeDisabled();
  });
});
