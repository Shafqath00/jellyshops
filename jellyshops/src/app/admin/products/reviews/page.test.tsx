import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { expectNoRawCodes } from "@/test/raw-codes";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReviewsPage from "./page";

const api = vi.hoisted(() => ({ list: vi.fn(), setStatus: vi.fn(), remove: vi.fn() }));
vi.mock("@/features/admin/api/reviews-api", () => ({ useAdminReviews: () => ({ ...api, ready: true, storeId: "store-a" }) }));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); });

const review = { id: "r1", productId: "p1", productTitle: "Vitamin C serum", rating: 4, title: "Lovely", body: "Gentle on my skin.", authorName: "Ana", authorEmail: "ana@example.test", status: "pending", verifiedPurchase: false, createdAt: "2026-11-08T10:00:00Z", publishedAt: null };

describe("reviews page", () => {
  it("lists waiting reviews with the product and email, and publishes one", async () => {
    api.list.mockResolvedValue({ reviews: [review], counts: { pending: 1, published: 3, hidden: 0 } });
    api.setStatus.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<ReviewsPage />);
    const table = await screen.findByRole("table");
    expect(api.list).toHaveBeenCalledWith("pending");
    expect(within(table).getByText("Vitamin C serum")).toBeVisible();
    expectNoRawCodes();
    expect(within(table).getByRole("link", { name: "ana@example.test" })).toHaveAttribute("href", "mailto:ana@example.test");
    expect(within(table).getByLabelText("4 out of 5 stars")).toBeVisible();
    await user.click(within(table).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith("r1", "published"));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("tab", { name: /Published/ }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith("published"));
  });

  it("asks before deleting a review", async () => {
    api.list.mockResolvedValue({ reviews: [review], counts: { pending: 1, published: 0, hidden: 0 } });
    api.remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ReviewsPage />);
    await user.click(await screen.findByRole("button", { name: "Delete the review from Ana" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete this review?" });
    expect(dialog).toHaveTextContent("removed for good");
    await user.click(within(dialog).getByRole("button", { name: "Delete review" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("r1"));
  });
});
