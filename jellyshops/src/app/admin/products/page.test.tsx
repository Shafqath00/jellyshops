import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import ProductsPage from "./page";

const api = vi.hoisted(() => ({ request: vi.fn(), all: vi.fn() }));
vi.mock("@/features/admin/api/catalog-api", () => ({ useAdminCatalog: () => ({ ...api, ready: true, storeId: "store" }) }));
vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth: () => ({ activeStore: { currency: "GBP" } }) }));
const rows = [
  { id: "p1", title: "Linen shirt", status: "ACTIVE", media: [], variants: [{ priceMinor: 4900, quantity: 12, reserved: 2 }], productType: "Shirts", vendor: "Jelly" },
  { id: "p2", title: "Ceramic mug", status: "DRAFT", media: [], variants: [{ priceMinor: 1800, quantity: 0 }], productType: null, vendor: null },
];
beforeEach(() => {
  vi.resetAllMocks();
  api.request.mockImplementation(async (_url: string, init?: RequestInit) => init?.method === "PATCH" ? {} : { nodes: rows, nextCursor: "page-2" });
  api.all.mockResolvedValue([{ id: "c1", title: "Summer", productIds: [] }]);
});
afterEach(cleanup);
const renderPage = () => render(<ToastProvider><ProductsPage /></ToastProvider>);
const patches = () => api.request.mock.calls.filter(([, init]) => init?.method === "PATCH");

describe("product management", () => {
  it("returns dialog focus to the correct row when two products share a title", async () => {
    api.request.mockResolvedValue({ nodes: [rows[0], { ...rows[1], title: rows[0].title }], nextCursor: null });
    const user = userEvent.setup();
    renderPage();
    const triggers = await screen.findAllByRole("button", { name: "Actions for Linen shirt" });
    await user.click(triggers[1]);
    await user.click(screen.getByRole("menuitem", { name: "Archive product" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(triggers[1]).toHaveFocus());
  });

  it("offers recovery after a load failure and distinguishes empty search results", async () => {
    api.request.mockRejectedValueOnce(new Error("Connection lost"));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("Connection lost")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("link", { name: "Linen shirt" });
    api.request.mockResolvedValue({ nodes: [], nextCursor: null });
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "missing");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "No matching products" })).toBeVisible();
  });

  it("preserves submitted search, status filtering, sorting and cursor pagination", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("link", { name: "Linen shirt" });
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "linen");
    expect(api.request).toHaveBeenCalledTimes(1);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).toContain("query=linen"));
    await user.click(screen.getByRole("tab", { name: "Active" }));
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).toContain("status=ACTIVE"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort products" }), "newest");
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).toContain("sort=newest"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).toContain("cursor=page-2"));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(api.request.mock.lastCall?.[0]).not.toContain("cursor="));
  });

  it("offers row actions without selecting the product and restores focus on Escape", async () => {
    const user = userEvent.setup();
    renderPage();
    const trigger = await screen.findByRole("button", { name: "Actions for Linen shirt" });
    await user.click(trigger);
    expect(screen.getByRole("menuitem", { name: "Edit product" })).toHaveAttribute("href", "/admin/products/p1");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("checkbox", { name: "Select Linen shirt" })).not.toBeChecked();
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "Set as draft" }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]).toEqual(["/products/p1", expect.objectContaining({ body: JSON.stringify({ status: "DRAFT" }) })]);
  });

  it("confirms a row archive and allows cancelling without changing the product", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Actions for Linen shirt" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive product" }));
    expect(screen.getByRole("dialog", { name: "Archive Linen shirt?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(patches()).toHaveLength(0);
  });

  it("keeps selections and reports partial bulk failures", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("checkbox", { name: "Select Linen shirt" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Ceramic mug" }));
    api.request.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH" && url.endsWith("p2")) throw new Error("Conflict");
      return init?.method === "PATCH" ? {} : { nodes: rows, nextCursor: null };
    });
    await user.click(screen.getByRole("button", { name: "Set as active" }));
    expect(await screen.findByText("1 of 2 products could not be changed. Try again.")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Select Linen shirt" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select Ceramic mug" })).toBeChecked();
  });

  it("adds a single product to an existing collection through its row action", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Actions for Linen shirt" }));
    await user.click(screen.getByRole("menuitem", { name: "Add to collection" }));
    await user.click(await screen.findByRole("radio", { name: /Summer/ }));
    await user.click(screen.getByRole("button", { name: "Add products" }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]).toEqual(["/collections/c1", expect.objectContaining({ body: JSON.stringify({ productIds: ["p1"] }) })]);
  });
});
