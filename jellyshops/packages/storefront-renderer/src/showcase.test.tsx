import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { createStorefrontRuntimeContext } from "./runtime-context";
import { FeaturedProductSection, pickProduct, ShopTheLookSection } from "./sections/showcase";
import { AnnouncementBarSection } from "./sections/home-sections";
import { TestimonialsSection } from "./sections/theme-pack-sections";
import { FooterSection } from "./sections/footer";
import type { CommerceDataProvider, PublicProduct } from "./types";

const block = (id: string, type: string, settings: Record<string, unknown>): BlockNode => ({ id, type, enabled: true, settings, blocks: [] });
const section = (type: string, settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []): SectionNode => ({ id: `${type}-1`, type, enabled: true, settings, blocks });
const products: PublicProduct[] = [
  { id: "p1", name: "Harbour bed", href: "/demo/products/harbour", imageUrl: "https://example.com/bed.jpg", price: "£899.00", compareAtPrice: "£1,099.00", saving: "Save 18%", vendor: "Resthaven" },
  { id: "p2", name: "Linen duvet cover", href: "/demo/products/linen", imageUrl: "https://example.com/linen.jpg", price: "£120.00" },
];
const commerce: CommerceDataProvider = { initialProducts: products, async getProducts() { return products; }, ratings: { p1: { average: 4.8, count: 32 } } };
const context = createStorefrontRuntimeContext({ mode: "published", region: "template", commerce, storeSlug: "demo" });

describe("pickProduct", () => {
  it("uses the chosen product, else the store's products in order", () => {
    expect(pickProduct(products, "p2", 0)?.name).toBe("Linen duvet cover");
    expect(pickProduct(products, "missing", 1)?.name).toBe("Linen duvet cover");
    expect(pickProduct(products, undefined, 2)?.name).toBe("Harbour bed");
    expect(pickProduct([], undefined, 0)).toBeUndefined();
  });
});

describe("Shop the look", () => {
  const look = section("shop-the-look", { heading: "The sunny main bedroom", image: { url: "https://example.com/room.jpg", alt: "A bedroom" } }, [
    block("pin-1", "hotspot", { productId: "p2", x: 30, y: 60 }),
    block("pin-2", "hotspot", { x: 70, y: 40 }),
  ]);

  it("draws a pin per product and the same products as a list", () => {
    render(<ShopTheLookSection section={look} commerce={commerce} context={context} />);
    const pins = screen.getAllByRole("button", { name: /^Show / });
    expect(pins).toHaveLength(2);
    expect(pins[0]?.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("list").textContent).toContain("Linen duvet cover");
    expect(screen.getByRole("list").textContent).toContain("Harbour bed");
  });

  it("opens one card at a time and closes it with Escape", () => {
    render(<ShopTheLookSection section={look} commerce={commerce} context={context} />);
    const [first] = screen.getAllByRole("button", { name: /^Show / });
    fireEvent.click(first!);
    expect(first!.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(first!.getAttribute("aria-controls")!)?.hidden).toBe(false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(first!.getAttribute("aria-expanded")).toBe("false");
  });

  it("stays hidden on the live store without a photo", () => {
    const { container } = render(<ShopTheLookSection section={section("shop-the-look", {})} commerce={commerce} context={context} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("Featured product", () => {
  it("shows the product's name, sale price, rating and the merchant's words", () => {
    render(<FeaturedProductSection section={section("featured-product", { text: "Our most-loved bed.", buttonLabel: "View the bed" })} commerce={commerce} context={context} />);
    expect(screen.getByRole("heading", { name: "Harbour bed" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "4.8 out of 5 stars" })).toBeTruthy();
    expect(screen.getByText("Our most-loved bed.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View the bed" }).getAttribute("href")).toBe("/demo/products/harbour");
  });
});

describe("rotating announcement", () => {
  afterEach(() => vi.useRealTimers());
  const bar = section("announcement-bar", { text: "Free delivery over £50", rotateSeconds: 4 }, [block("m1", "announcement-message", { text: "100-night sleep trial" })]);

  it("moves to the next message on its own and with the arrows", () => {
    vi.useFakeTimers();
    render(<AnnouncementBarSection section={bar} />);
    expect(screen.getByText("Free delivery over £50")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText("100-night sleep trial")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next message" }));
    expect(screen.getByText("Free delivery over £50")).toBeTruthy();
  });

  it("keeps a single message as plain text", () => {
    render(<AnnouncementBarSection section={section("announcement-bar", { text: "Only one" })} />);
    expect(screen.queryByRole("button", { name: "Next message" })).toBeNull();
  });
});

describe("reviews carousel and payment methods", () => {
  it("draws reviews with stars and what the customer bought in a scrolling region", () => {
    render(<TestimonialsSection section={section("testimonials", { layout: "carousel" }, [block("r1", "testimonial", { quote: "Lovely bed.", author: "Hannah", detail: "Bought the Harbour bed", rating: 5 }), block("r2", "testimonial", { quote: "Great sleep.", author: "Tom" })])} />);
    expect(screen.getByRole("region", { name: "Customer reviews" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "5 out of 5 stars" })).toBeTruthy();
    expect(screen.getByText("Bought the Harbour bed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next reviews" })).toBeTruthy();
  });

  it("lists payment methods in the footer only when set", () => {
    const { rerender } = render(<FooterSection section={section("footer", { paymentMethods: "Visa, PayPal, " })} context={context} />);
    expect(screen.getByRole("list", { name: "Ways to pay" }).textContent).toBe("VisaPayPal");
    rerender(<FooterSection section={section("footer", {})} context={context} />);
    expect(screen.queryByRole("list", { name: "Ways to pay" })).toBeNull();
  });
});
