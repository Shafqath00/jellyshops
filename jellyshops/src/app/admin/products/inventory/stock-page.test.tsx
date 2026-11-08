import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StockPage from "./page";

const api = vi.hoisted(() => ({ request: vi.fn(), all: vi.fn() }));
vi.mock("@/features/admin/api/catalog-api", () => ({ useAdminCatalog: () => ({ ...api, ready: true, storeId: "store-a" }) }));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); });

const row = { productId: "p1", variantId: "v1", productTitle: "T-shirt", variantTitle: "Blue", sku: "TS-B", barcode: "5012345678900", lowStockThreshold: null, stockStatus: "low", trackInventory: true, quantity: 4, reserved: 1, availableQuantity: 3, revision: "r1" };
const untracked = { ...row, variantId: "v2", variantTitle: "Red", sku: "TS-R", barcode: null, stockStatus: "untracked", trackInventory: false, quantity: null, availableQuantity: null, revision: null };

describe("stock page", () => {
  it("shows barcode and stock status, and searches by barcode", async () => {
    api.request.mockResolvedValue({ nodes: [row, { ...row, variantId: "v3", variantTitle: "Green", barcode: null, quantity: 20, availableQuantity: 19, stockStatus: "in_stock" }, { ...row, variantId: "v4", variantTitle: "Black", barcode: null, quantity: 0, availableQuantity: 0, stockStatus: "out" }, untracked], nextCursor: null });
    const user = userEvent.setup();
    render(<StockPage />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("5012345678900")).toBeVisible();
    expect(within(table).getByText("Low stock")).toBeVisible();
    expect(within(table).getByText("In stock")).toBeVisible();
    expect(within(table).getByText("Out of stock")).toBeVisible();
    expect(within(table).getAllByText("Not tracked").length).toBeGreaterThan(0);
    await user.type(screen.getByRole("searchbox", { name: "Search stock" }), "5012345678900");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).toContain("query=5012345678900"));
    await user.click(screen.getByRole("tab", { name: "Out of stock" }));
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).toContain("stock=out"));
  });

  it("sends the reason with a manual change and clears it afterwards", async () => {
    api.request.mockResolvedValueOnce({ nodes: [row], nextCursor: null }).mockResolvedValueOnce({ ...row, quantity: 9, availableQuantity: 8, stockStatus: "in_stock", revision: "r2" });
    const user = userEvent.setup();
    render(<StockPage />);
    const onHand = await screen.findByLabelText("On hand for T-shirt Blue");
    expect(screen.queryByLabelText("Why did the stock change?")).not.toBeInTheDocument();
    await user.clear(onHand);
    await user.type(onHand, "9");
    await user.selectOptions(screen.getByLabelText("Why did the stock change?"), "Received new stock");
    await user.type(screen.getByLabelText("Note (optional)"), "  Recount  ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(2));
    expect(api.request.mock.calls[1][0]).toBe("/inventory/v1");
    expect(JSON.parse(api.request.mock.calls[1][1].body)).toEqual({ quantity: 9, expectedRevision: "r1", note: "Received new stock: Recount" });
    await waitFor(() => expect(screen.queryByLabelText("Note (optional)")).not.toBeInTheDocument());
  });

  it("opens the history of a tracked variant and offers none for untracked ones", async () => {
    api.request.mockImplementation(async (path: string) => path.includes("/history") ? { nodes: [{ id: "1", quantityDelta: 4, quantityAfter: 4, reason: "initial", note: null, actor: null, createdAt: "2026-10-28T10:00:00.000Z" }], nextCursor: null } : { nodes: [row, untracked], nextCursor: null });
    const user = userEvent.setup();
    render(<StockPage />);
    await user.click(await screen.findByRole("button", { name: "Stock history for T-shirt Blue" }));
    expect(await screen.findByRole("list", { name: "Stock changes" })).toHaveTextContent("Starting stock");
    expect(api.request).toHaveBeenCalledWith("/inventory/v1/history?limit=20");
    expect(screen.queryByRole("button", { name: "Stock history for T-shirt Red" })).not.toBeInTheDocument();
  });
});
