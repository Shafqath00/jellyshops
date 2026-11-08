import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StockHistory } from "./stock-history";

afterEach(cleanup);

const entry = (id: string, quantityDelta: number, quantityAfter: number, reason: string, note: string | null = null) => ({ id, quantityDelta, quantityAfter, reason, note, actor: null, createdAt: "2026-10-28T10:00:00.000Z" });

describe("StockHistory", () => {
  it("lists changes newest first with their reason, note and resulting stock", async () => {
    const request = vi.fn().mockResolvedValue({ nodes: [entry("3", 4, 14, "manual", "Recount after delivery"), entry("2", -3, 10, "sale"), entry("1", 13, 13, "initial")], nextCursor: null });
    render(<StockHistory variantId="v 1" title="Tee · Blue" request={request} onClose={() => {}} />);
    const list = await screen.findByRole("list", { name: "Stock changes" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Adjusted by hand");
    expect(items[0]).toHaveTextContent("Recount after delivery");
    expect(items[0]).toHaveTextContent("+4");
    expect(items[0]).toHaveTextContent("14 on hand");
    expect(items[1]).toHaveTextContent("Sold");
    expect(items[1]).toHaveTextContent("−3");
    expect(items[2]).toHaveTextContent("Starting stock");
    expect(request).toHaveBeenCalledWith("/inventory/v%201/history?limit=20");
    expect(screen.getByText("Tee · Blue")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Show older changes" })).not.toBeInTheDocument();
  });

  it("loads older changes with the cursor and appends them", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ nodes: [entry("5", 1, 9, "restock")], nextCursor: "5" })
      .mockResolvedValueOnce({ nodes: [entry("4", -2, 8, "sale")], nextCursor: null });
    const user = userEvent.setup();
    render(<StockHistory variantId="v1" title="Tee" request={request} onClose={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Show older changes" }));
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Stock changes" })).getAllByRole("listitem")).toHaveLength(2));
    expect(request).toHaveBeenLastCalledWith("/inventory/v1/history?limit=20&cursor=5");
    expect(screen.queryByRole("button", { name: "Show older changes" })).not.toBeInTheDocument();
  });

  it("says so when nothing was recorded, and lets the seller retry after an error", async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error("Could not load.")).mockResolvedValueOnce({ nodes: [], nextCursor: null });
    const user = userEvent.setup();
    render(<StockHistory variantId="v1" title="Tee" request={request} onClose={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/No changes recorded yet/)).toBeVisible();
  });
});
