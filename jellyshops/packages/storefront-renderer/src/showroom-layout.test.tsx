import { act, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { createSectionFromDefinition, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { STORE_ICON_NAMES, type SectionNode } from "@jelly/storefront-schema";
import { StorefrontProductCard } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "./runtime-context";
import { defaultSectionRenderRegistry } from "./render-registry";
import { HeaderSection } from "./sections/header";
import { CollectionHeaderSection } from "./sections/collection-sections";
import { ImageGallerySection, RatingSummarySection } from "./sections/social-proof";
import { StoreIcon } from "./sections/store-icon";
import { TrustStripSection } from "./sections/trust-points";

const context = (storeSlug?: string): StorefrontRuntimeContext => ({ mode: "published", commerce: { getProducts: async () => [] }, storeSlug });
const block = (id: string, type: string, settings: Record<string, unknown>, enabled = true) => ({ id, type, enabled, settings });
const section = (type: string, settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []): SectionNode => ({ id: type, type, enabled: true, settings, blocks });
const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => violation.id);

describe("trust badges", () => {
  const points = [
    block("a", "trust-point", { text: "Free delivery", icon: "truck", link: "/pages/delivery" }),
    block("b", "trust-point", { text: "5-year warranty", icon: "shield" }),
    block("c", "text", { text: "Made by hand" }),
    block("d", "trust-point", { text: "Hidden" }, false),
  ];

  it("shows points with their icons and links in a row, older text blocks with a tick", () => {
    render(<TrustStripSection section={section("trust-strip", {}, points)} context={context("demo")} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Free delivery" })).toHaveAttribute("href", "/demo/pages/delivery");
    expect(document.querySelector('[data-icon="truck"]')).toBeTruthy();
    expect(screen.getByText("Made by hand").closest("li")?.querySelector('[data-icon="check"]')).toBeTruthy();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("scrolls with a hidden second copy that screen readers and the keyboard skip", async () => {
    const { container } = render(<TrustStripSection section={section("trust-strip", { layout: "scroll", speed: "fast" }, points)} context={context("demo")} />);
    const tracks = container.querySelectorAll(".jelly-trust-track");
    expect(tracks).toHaveLength(2);
    expect(tracks[1]).toHaveAttribute("aria-hidden", "true");
    expect(within(tracks[1] as HTMLElement).getByText("Free delivery").closest("a")).toHaveAttribute("tabindex", "-1");
    expect(screen.getAllByRole("link", { name: "Free delivery" })).toHaveLength(1);
    expect((container.querySelector(".jelly-trust-marquee") as HTMLElement).style.getPropertyValue("--jelly-marquee-duration")).toBe("7.5s");
    expect(await noViolations(container)).toEqual([]);
  });

  it("can hide the icons, and falls back to sample points when it has none", () => {
    const { container } = render(<TrustStripSection section={section("trust-strip", { showIcons: false }, [])} />);
    expect(screen.getByText("Secure checkout")).toBeInTheDocument();
    expect(container.querySelector(".jelly-icon")).toBeNull();
  });

  it("marks points for the editor", () => {
    render(<TrustStripSection section={section("trust-strip", {}, points)} mode="editor" selectedBlockId="b" />);
    expect(screen.getByText("5-year warranty").closest("li")).toHaveAttribute("data-editor-block-selected", "true");
  });

  it("draws every icon the editor offers", () => {
    for (const name of STORE_ICON_NAMES) {
      const { container, unmount } = render(<StoreIcon name={name} />);
      expect(container.querySelector("path")?.getAttribute("d")).toBeTruthy();
      unmount();
    }
    const { container } = render(<StoreIcon name="nope" />);
    expect(container.querySelector("svg")).toHaveAttribute("data-icon", "check");
  });
});

describe("header search bar layout", () => {
  const header = (settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []) => section("header", { storeName: "Dreamy Beds", showCart: true, ...settings }, blocks);

  it("puts a search box first, drops the search icon, and adds the extra link and trust row", async () => {
    const { container } = render(<HeaderSection section={header(
      { layout: "search-bar", extraLinkLabel: "Free swatches", extraLink: "/pages/swatches", extraLinkIcon: "palette", showToolLabels: true },
      [block("t1", "trust-point", { text: "60-night trial", icon: "moon" }), block("t2", "trust-point", { text: "Free delivery", icon: "truck" })],
    )} context={context("demo")} />);
    const element = container.querySelector(".jelly-header") as HTMLElement;
    expect(element).toHaveAttribute("data-header-layout", "search-bar");
    expect(element).toHaveAttribute("data-tool-labels", "true");
    const search = screen.getByRole("search");
    expect(search).toHaveAttribute("action", "/demo/search");
    expect(within(search).getByRole("searchbox", { name: "Search products" })).toHaveAttribute("name", "q");
    expect(element.firstElementChild?.nextElementSibling).toBe(search);
    expect(container.querySelector('[data-tool="search"]')).toBeNull();
    expect(screen.getByRole("link", { name: "Free swatches" })).toHaveAttribute("href", "/demo/pages/swatches");
    expect(within(screen.getByRole("list", { name: "Why shop with us" })).getAllByRole("listitem")).toHaveLength(2);
    expect(await noViolations(container)).toEqual([]);
  });

  it("keeps the classic header unchanged when no layout is chosen", () => {
    const { container } = render(<HeaderSection section={header({ showSearch: true })} context={context("demo")} />);
    expect(screen.queryByRole("search")).toBeNull();
    expect(container.querySelector('[data-tool="search"]')).toBeTruthy();
    expect(container.querySelector(".jelly-header")).not.toHaveAttribute("data-header-layout");
    expect(container.querySelector(".jelly-header-trust")).toBeNull();
  });
});

describe("rating line and photo gallery", () => {
  it("shows the rating with the review count put into the text, and links to the reviews", () => {
    render(<RatingSummarySection section={section("rating-summary", { rating: 4.83, reviewCount: 14620, text: "from {count} reviews", link: "/pages/reviews", linkLabel: "Read reviews" })} context={context("demo")} />);
    expect(screen.getByText("4.8 out of 5")).toBeInTheDocument();
    expect(screen.getByText("from 14,620 reviews")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read reviews" })).toHaveAttribute("href", "/demo/pages/reviews");
    expect((document.querySelector(".jelly-rating-stars") as HTMLElement).style.getPropertyValue("--jelly-rating-fill")).toBe("96.6%");
  });

  it("never shows a made-up rating: hidden without one, and no count text when the count is 0", () => {
    const empty = render(<RatingSummarySection section={section("rating-summary", { rating: 0 })} />);
    expect(empty.container).toBeEmptyDOMElement();
    empty.unmount();
    render(<RatingSummarySection section={section("rating-summary", { rating: 5, reviewCount: 0, text: "from {count} reviews" })} />);
    expect(screen.getByText("5 out of 5")).toBeInTheDocument();
    expect(screen.queryByText(/reviews/)).toBeNull();
  });

  it("shows gallery photos with captions and links, as a scrolling row when asked", async () => {
    const { container } = render(<ImageGallerySection section={section("image-gallery", { heading: "Loved in homes like yours", layout: "scroll", columns: 3, ratio: "portrait" }, [
      block("p1", "gallery-image", { image: { url: "https://cdn.test/a.jpg", alt: "A grey bed by a window" }, caption: "Sam, Leeds", link: "/products/bed" }),
      block("p2", "gallery-image", { caption: "No photo" }),
    ])} context={context("demo")} />);
    expect(screen.getByRole("img", { name: "A grey bed by a window" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sam, Leeds/ })).toHaveAttribute("href", "/demo/products/bed");
    expect(screen.queryByText("No photo")).toBeNull();
    const list = container.querySelector(".jelly-image-gallery-items") as HTMLElement;
    expect(list).toHaveAttribute("tabindex", "0");
    expect(list.style.getPropertyValue("--jelly-columns")).toBe("3");
    expect(container.querySelector(".jelly-image-gallery")).toHaveAttribute("data-ratio", "portrait");
    expect(await noViolations(container)).toEqual([]);
  });

  it("hides an empty gallery on the live store and explains it in the editor", () => {
    const { container, rerender } = render(<ImageGallerySection section={section("image-gallery", {})} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ImageGallerySection section={section("image-gallery", {})} mode="editor" />);
    expect(screen.getByText(/Add photo blocks/)).toBeInTheDocument();
  });
});

describe("collection description Read more", () => {
  const contextFor = (description: string) => ({
    page: { pageType: "collection", resource: { id: "c1", handle: "beds", data: { collectionPresentation: { collection: { id: "c1", title: "Beds", description }, products: [], totalProducts: 0 } } } },
  }) as unknown as StorefrontRuntimeContext;

  it("cuts a long description and opens it with Read more", () => {
    const heights = { scroll: 200, client: 48 };
    const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return heights.scroll; } });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return heights.client; } });
    try {
      const { container } = render(<CollectionHeaderSection context={contextFor("A long story about beds.")} section={{ settings: { showDescription: true, descriptionLines: "2" } }} />);
      const body = container.querySelector(".jelly-clamped-text-body") as HTMLElement;
      expect(body.style.getPropertyValue("--jelly-clamp-lines")).toBe("2");
      const button = screen.getByRole("button", { name: "Read more" });
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-controls", body.id);
      act(() => { fireEvent.click(button); });
      expect(screen.getByRole("button", { name: "Read less" })).toHaveAttribute("aria-expanded", "true");
      expect(body.style.getPropertyValue("--jelly-clamp-lines")).toBe("");
    } finally {
      // jsdom defines these on Element, so the mocks on HTMLElement are simply removed.
      if (scroll) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scroll); else delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
      if (client) Object.defineProperty(HTMLElement.prototype, "clientHeight", client); else delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
    }
  });

  it("shows no button when the text fits, and the full text when the setting is off", () => {
    const short = render(<CollectionHeaderSection context={contextFor("Short.")} section={{ settings: { showDescription: true, descriptionLines: "3" } }} />);
    expect(within(short.container).getByText("Short.")).toBeInTheDocument();
    expect(within(short.container).queryByRole("button")).toBeNull();
    const { container } = render(<CollectionHeaderSection context={contextFor("Full text.")} section={{ settings: { showDescription: true } }} />);
    expect(container.querySelector(".jelly-clamped-text")).toBeNull();
  });
});

describe("product card extras", () => {
  it("adds the saving, the percentage off and a chip", () => {
    render(<StorefrontProductCard product={{ name: "Oslo bed", href: "#", imageUrl: "", price: "£250.00", compareAtPrice: "£500.00", saving: "£250.00", discountPercent: 50, chip: "More colours" }} />);
    expect(screen.getByText("Save £250.00")).toHaveAttribute("data-saving", "amount");
    expect(screen.getByText("50% off")).toHaveAttribute("data-saving", "percent");
    expect(screen.getByText("More colours")).toHaveClass("jelly-product-card-chip");
  });

  it("adds nothing for a product at full price", () => {
    const { container } = render(<StorefrontProductCard product={{ name: "Pillow", href: "#", imageUrl: "", price: "£20.00" }} />);
    expect(container.querySelector(".jelly-product-card-saving")).toBeNull();
    expect(container.querySelector(".jelly-product-card-chip")).toBeNull();
  });
});

describe("registry", () => {
  it("creates valid trust, rating and gallery sections and accepts the new header and collection settings", () => {
    let next = 0;
    const id = () => `id-${next++}`;
    for (const type of ["trust-strip", "rating-summary", "image-gallery"]) {
      expect(validateSectionAgainstRegistry(createSectionFromDefinition(type, id), "home")).toEqual([]);
      expect(defaultSectionRenderRegistry.get(type)).toBeTruthy();
    }
    const strip = section("trust-strip", { layout: "scroll", speed: "slow", showIcons: true }, [block("a", "trust-point", { text: "Free delivery", icon: "truck", link: "/pages/delivery" })]);
    expect(validateSectionAgainstRegistry(strip, "home")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("trust-strip", {}, [block("a", "trust-point", { text: "x", icon: "rocket" })]), "home").map((issue) => issue.code)).toContain("SETTINGS_INVALID");
    const header = section("header", { storeName: "Beds", layout: "search-bar", showToolLabels: true, extraLinkLabel: "Free swatches", extraLink: "/pages/swatches", extraLinkIcon: "palette" }, [block("m", "menu", {}), block("t", "trust-point", { text: "Free delivery", icon: "truck" })]);
    expect(validateSectionAgainstRegistry(header, "home")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("collection-header", { showDescription: true, descriptionLines: "3" }), "collection")).toEqual([]);
    expect(validateSectionAgainstRegistry(section("rating-summary", { rating: 6 }), "home").map((issue) => issue.code)).toContain("SETTINGS_INVALID");
  });
});
