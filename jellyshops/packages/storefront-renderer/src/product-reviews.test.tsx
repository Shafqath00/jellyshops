import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { StorefrontProductCard } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "./runtime-context";
import type { StorefrontReviewAccess } from "./types";
import { ProductReviewsSection } from "./sections/product-reviews";
import { CardRatingsContext, ProductCard } from "./product-card";

const reviews = Array.from({ length: 7 }, (_, index) => ({ id: `r${index}`, rating: index % 2 ? 4 : 5, title: index === 0 ? "Lovely" : "", body: `Review ${index}`, authorName: `Shopper ${index}`, verifiedPurchase: index === 0, createdAt: "2026-10-30T10:00:00Z" }));
function access(overrides: Partial<StorefrontReviewAccess> = {}): StorefrontReviewAccess {
  return {
    list: vi.fn(async (_id, page = {}) => ({ summary: { average: 4.6, count: 7, distribution: [4, 3, 0, 0, 0] as [number, number, number, number, number] }, reviews: reviews.slice(page.offset ?? 0, (page.offset ?? 0) + (page.limit ?? 5)) })),
    submit: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}
const context = (reviewsAccess?: StorefrontReviewAccess) => ({
  mode: "published", storeSlug: "demo",
  commerce: { getProducts: async () => [], reviews: reviewsAccess },
  page: { pageType: "product", resource: { id: "p1", handle: "serum", data: { productPresentation: { product: { id: "p1", title: "Serum" } } } } },
}) as unknown as StorefrontRuntimeContext;
const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => violation.id);

describe("product reviews section", () => {
  it("shows the summary and the first reviews, then more on request", async () => {
    const api = access();
    const { container } = render(<ProductReviewsSection context={context(api)} section={{ settings: { perPage: 5 } }} />);
    expect(await screen.findByText("Based on 7 reviews")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Average rating 4.6 out of 5" })).toBeTruthy();
    expect(container.querySelectorAll(".jelly-review")).toHaveLength(5);
    expect(screen.getByText("Verified buyer")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more reviews" }));
    await waitFor(() => expect(container.querySelectorAll(".jelly-review")).toHaveLength(7));
    expect(api.list).toHaveBeenLastCalledWith("p1", { limit: 5, offset: 5 });
    expect(screen.queryByRole("button", { name: "Show more reviews" })).toBeNull();
    expect(await noViolations(container)).toEqual([]);
  });

  it("asks for a rating and a name, sends the review and thanks the shopper", async () => {
    const api = access();
    const { container } = render(<ProductReviewsSection context={context(api)} section={{ settings: {} }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    const form = screen.getByRole("form", { name: "Write a review" });
    fireEvent.click(within(form).getByRole("button", { name: "Send review" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Choose a star rating.");
    fireEvent.click(within(form).getByRole("radio", { name: "4 stars" }));
    fireEvent.click(within(form).getByRole("button", { name: "Send review" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Add your name.");
    fireEvent.change(within(form).getByLabelText("Your name"), { target: { value: "Ana" } });
    fireEvent.change(within(form).getByLabelText("Your review"), { target: { value: "Gentle and light." } });
    expect(await noViolations(container)).toEqual([]);
    fireEvent.click(within(form).getByRole("button", { name: "Send review" }));
    expect(await screen.findByRole("status")).toHaveTextContent("will appear once the shop has checked it");
    expect(api.submit).toHaveBeenCalledWith("p1", expect.objectContaining({ rating: 4, authorName: "Ana", body: "Gentle and light." }));
  });

  it("shows the shop's message when a review is refused", async () => {
    render(<ProductReviewsSection context={context(access({ submit: async () => ({ ok: false, message: "You've sent several reviews in a short time." }) }))} section={{ settings: {} }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Write a review" }));
    const form = screen.getByRole("form", { name: "Write a review" });
    fireEvent.click(within(form).getByRole("radio", { name: "5 stars" }));
    fireEvent.change(within(form).getByLabelText("Your name"), { target: { value: "Ana" } });
    fireEvent.click(within(form).getByRole("button", { name: "Send review" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("several reviews");
  });

  it("shows the empty text, and no form when writing is off or there is no reviews connection", async () => {
    const none = access({ list: async () => ({ summary: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] }, reviews: [] }) });
    const { rerender } = render(<ProductReviewsSection context={context(none)} section={{ settings: { emptyText: "Be the first." } }} />);
    expect(await screen.findByText("Be the first.")).toBeTruthy();
    rerender(<ProductReviewsSection context={context(none)} section={{ settings: { allowWriting: false } }} />);
    expect(screen.queryByRole("button", { name: "Write a review" })).toBeNull();
    rerender(<ProductReviewsSection context={context(undefined)} section={{ settings: {} }} />);
    expect(screen.queryByRole("button", { name: "Write a review" })).toBeNull();
  });
});

describe("star ratings on product cards", () => {
  const product = { id: "p1", name: "Serum", href: "/demo/products/serum", imageUrl: "", price: "£20.00" };
  it("describes the rating for screen readers and skips products without reviews", () => {
    const { container, rerender } = render(<StorefrontProductCard product={{ ...product, rating: { average: 4.66, count: 12 } }} />);
    expect(container.querySelector('[data-card-part="rating"]')).toHaveTextContent("Rated 4.7 out of 5 from 12 reviews");
    rerender(<StorefrontProductCard product={{ ...product, rating: { average: 0, count: 0 } }} />);
    expect(container.querySelector('[data-card-part="rating"]')).toBeNull();
  });

  it("takes ratings from the section's ratings by product id", () => {
    const { container } = render(<CardRatingsContext.Provider value={{ p1: { average: 5, count: 1 } }}><ProductCard product={product} /></CardRatingsContext.Provider>);
    expect(container.querySelector('[data-card-part="rating"]')).toHaveTextContent("from 1 review");
  });
});
