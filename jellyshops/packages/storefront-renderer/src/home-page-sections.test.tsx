import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { createStorefrontRuntimeContext } from "./runtime-context";
import { FooterSection } from "./sections/footer";
import { HeaderSection } from "./sections/header";
import { ProductGridSection } from "./sections/product-grid";
import { SlideshowSection } from "./sections/slideshow";
import { CategoryGridSection } from "./sections/theme-pack-sections";
import type { CommerceDataProvider } from "./types";

const block = (id: string, type: string, settings: Record<string, unknown>) => ({ id, type, enabled: true, settings });
const section = (type: string, settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []): SectionNode => ({ id: `${type}-1`, type, enabled: true, settings, blocks });
const context = createStorefrontRuntimeContext({ mode: "published", region: "template", commerce: { async getProducts() { return []; } }, storeSlug: "avenue" });

describe("slideshow", () => {
  afterEach(() => vi.useRealTimers());
  const slides = [
    block("s1", "slide", { heading: "Dressed for the city", buttonLabel: "Shop", buttonLink: "/shop", image: { url: "https://example.com/1.jpg", alt: "First" } }),
    block("s2", "slide", { heading: "Quiet confidence", image: { url: "https://example.com/2.jpg", alt: "Second" } }),
  ];

  it("shows one slide at a time, links buttons inside the store and moves with the controls", () => {
    render(<SlideshowSection section={section("slideshow", {}, slides)} context={context} />);
    expect(screen.getByRole("heading", { level: 1, name: "Dressed for the city" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/avenue/shop");
    const [first, second] = screen.getAllByRole("group", { hidden: true });
    expect(first).toHaveAttribute("data-active", "true");
    expect(second).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(second).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("button", { name: "Show slide 2" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(first).toHaveAttribute("data-active", "true");
  });

  it("advances automatically when autoplay is on, and pauses while hovered", () => {
    vi.useFakeTimers();
    render(<SlideshowSection section={section("slideshow", { autoplay: true, interval: 4 }, slides)} context={context} />);
    const carousel = screen.getByRole("region", { name: "Featured" });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByRole("button", { name: "Show slide 2" })).toHaveAttribute("aria-current", "true");
    fireEvent.mouseEnter(carousel);
    act(() => { vi.advanceTimersByTime(8000); });
    expect(screen.getByRole("button", { name: "Show slide 2" })).toHaveAttribute("aria-current", "true");
  });

  it("does not render an empty slideshow on the live store", () => {
    const { container } = render(<SlideshowSection section={section("slideshow", {})} context={context} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("product grid tabs", () => {
  it("switches the product list with tabs and the arrow keys", async () => {
    const getProducts = vi.fn<CommerceDataProvider["getProducts"]>(async (input) => [{ id: input?.sort ?? "none", name: `Sorted ${input?.sort}`, href: "#", imageUrl: "", price: "£1" }]);
    render(<ProductGridSection commerce={{ getProducts }} storeSlug="avenue" section={section("product-grid", { heading: "New this season", contentAlignment: "center" }, [
      block("t1", "product-tab", { label: "New in", sort: "newest" }),
      block("t2", "product-tab", { label: "Best sellers", sort: "best-selling" }),
    ])} />);
    const tabs = screen.getByRole("tablist", { name: "New this season" });
    expect(within(tabs).getByRole("tab", { name: "New in" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByText("Sorted newest")).toBeInTheDocument());
    fireEvent.keyDown(within(tabs).getByRole("tab", { name: "New in" }), { key: "ArrowRight" });
    expect(within(tabs).getByRole("tab", { name: "Best sellers" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByText("Sorted best-selling")).toBeInTheDocument());
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New this season" }).closest("section")).toHaveAttribute("data-align", "center");
  });
});

describe("footer columns and newsletter", () => {
  it("groups link blocks under their headings, resolves store links and shows the newsletter", () => {
    render(<FooterSection context={context} mode="published" section={section("footer", { storeName: "Avenue", showNewsletter: true, newsletterHeading: "Join the list" }, [
      block("h1", "link-heading", { text: "Help" }),
      block("l1", "link", { label: "Shipping", link: "/shipping" }),
      block("l2", "link", { label: "Returns", link: "/returns" }),
      block("h2", "link-heading", { text: "About" }),
      block("l3", "link", { label: "Our story", link: "/about" }),
      block("h3", "link-heading", { text: "Empty" }),
    ])} />);
    const nav = screen.getByRole("navigation", { name: "Footer navigation" });
    expect(within(nav).getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Help", "About"]);
    expect(within(nav).getByRole("link", { name: "Shipping" })).toHaveAttribute("href", "/avenue/shipping");
    expect(screen.getByRole("heading", { name: "Join the list" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});

describe("header over the first image", () => {
  it("marks the header transparent and solid once the page scrolls", () => {
    render(<HeaderSection context={context} section={section("header", { storeName: "Avenue", transparent: true, overlayLogo: { url: "https://example.com/white.svg" } })} />);
    const header = screen.getByRole("banner");
    expect(header).toHaveAttribute("data-transparent", "true");
    expect(header).toHaveAttribute("data-overlay-logo", "true");
    expect(header).not.toHaveAttribute("data-scrolled");
    act(() => { Object.defineProperty(window, "scrollY", { configurable: true, value: 200 }); window.dispatchEvent(new Event("scroll")); });
    expect(header).toHaveAttribute("data-scrolled", "true");
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });
});

describe("hidden section headings", () => {
  it("drops the collection list heading when it is saved empty", () => {
    render(<CategoryGridSection context={context} section={section("category-grid", { heading: "" }, [block("c1", "collection-card", { label: "For her", link: "/shop" })])} />);
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "For her" })).toHaveAttribute("href", "/avenue/shop");
  });
});
