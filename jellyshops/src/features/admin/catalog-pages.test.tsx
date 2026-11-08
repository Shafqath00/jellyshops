import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CollectionsPage from "@/app/admin/products/collections/page";
import ProductsPage from "@/app/admin/products/page";
import StockPage from "@/app/admin/products/inventory/page";

const api = vi.hoisted(() => ({ request: vi.fn(), all: vi.fn() }));
vi.mock("@/features/admin/api/catalog-api", () => ({ useAdminCatalog: () => ({ ...api, ready: true, storeId: "store-a" }) }));
vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth: () => ({ activeStore: { currency: "GBP" } }) }));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); });
const row = { productId: "p1", variantId: "v1", productTitle: "T-shirt", variantTitle: "Blue", sku: "TS-B", trackInventory: true, quantity: 8, reserved: 3, availableQuantity: 5, revision: "r1" };

describe("catalog management", () => {
  it("omits an empty query and sends product filters and cursor to the API", async () => {
    const product = { id: "p1", title: "T-shirt", status: "ACTIVE", media: [], productType: null, vendor: null, variants: [{ id: "v1", priceMinor: 1200, quantity: 4, reserved: 0, trackInventory: true }] };
    api.request.mockResolvedValue({ nodes: [product], nextCursor: "page-2" });
    const user = userEvent.setup(); render(<ProductsPage />);
    await screen.findByText("T-shirt");
    expect(screen.getByText("4 in stock")).toBeInTheDocument();
    expect(new URL(api.request.mock.calls[0][0], "http://local").searchParams.has("query")).toBe(false);
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "TS-B{Enter}");
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).toContain("query=TS-B"));
    await user.click(screen.getByRole("tab", { name: "Draft" }));
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).toContain("status=DRAFT"));
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).toContain("cursor=page-2"));
  });
  it("shows a first-product prompt and changes the status of selected products", async () => {
    const product = { id: "p1", title: "T-shirt", status: "DRAFT", media: [], productType: null, vendor: null, variants: [{ id: "v1", priceMinor: 1200, trackInventory: false }] };
    api.request.mockResolvedValueOnce({ nodes: [], nextCursor: null });
    const user = userEvent.setup(); const view = render(<ProductsPage />);
    expect(await screen.findByText("Add your first product")).toBeInTheDocument();
    view.unmount();
    api.request.mockResolvedValue({ nodes: [product], nextCursor: null });
    render(<ProductsPage />);
    await user.click(await screen.findByRole("checkbox", { name: "Select T-shirt" }));
    await user.click(screen.getByRole("button", { name: "Set as active" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/products/p1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) })));
    expect(screen.getByText("Not tracked")).toBeInTheDocument();
  });
  it("keeps collection membership and name after a failed save, then retries", async () => {
    api.all.mockImplementation(async (path: string) => path === "/products" ? [{ id: "p1", title: "T-shirt" }] : []);
    api.request.mockRejectedValueOnce(new Error("Could not save collection.")).mockResolvedValue({});
    const user = userEvent.setup(); render(<CollectionsPage />);
    await user.click(screen.getByRole("button", { name: "Create collection" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Collection name"), "Summer");
    await user.click(await within(dialog).findByLabelText("T-shirt"));
    await user.click(within(dialog).getByRole("button", { name: "Save collection" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not save");
    expect(within(dialog).getByLabelText("Collection name")).toHaveValue("Summer");
    expect(within(dialog).getByLabelText("T-shirt")).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Save collection" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.parse(api.request.mock.calls[1][1].body)).toMatchObject({ title: "Summer", productIds: ["p1"] });
  });
  it("preserves a stock edit on conflict and uses the refreshed revision on retry", async () => {
    let revision = "r1";
    api.request.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        if (JSON.parse(String(init.body)).expectedRevision === "r1") throw new Error("Stock changed. Refresh stock and try again.");
        return { ...row, quantity: 10, availableQuantity: 7, revision: "r3" };
      }
      return { nodes: [{ ...row, revision }], nextCursor: null };
    });
    const user = userEvent.setup(); render(<StockPage />);
    const input = await screen.findByLabelText("On hand for T-shirt Blue");
    await user.clear(input); await user.type(input, "10");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Stock changed. Refresh stock and try again.")).toBeInTheDocument();
    expect(input).toHaveValue("10");
    revision = "r2";
    await user.click(screen.getByRole("button", { name: "Refresh stock" }));
    await screen.findByLabelText("On hand for T-shirt Blue");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Stock saved.")).toBeInTheDocument();
    expect(api.request.mock.calls.filter((call) => call[1]?.method === "PATCH").map((call) => JSON.parse(call[1].body).expectedRevision)).toEqual(["r1", "r2"]);
  });
  it("shows untracked stock with a link to enable tracking", async () => {
    api.request.mockResolvedValue({ nodes: [{ ...row, trackInventory: false, quantity: null, revision: null, availableQuantity: null }], nextCursor: null });
    render(<StockPage />);
    expect(await screen.findByText("Not tracked")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up tracking" })).toHaveAttribute("href", "/admin/products/p1");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
