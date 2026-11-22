import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import ProductsPage from "./page";

const api = vi.hoisted(() => ({ request: vi.fn(), all: vi.fn() }));
vi.mock("@/features/admin/api/catalog-api", () => ({ useAdminCatalog: () => ({ ...api, ready: true, storeId: "store" }) }));
vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth: () => ({ activeStore: { currency: "GBP" } }) }));
afterEach(cleanup);

const product = { id: "p1", title: "Oak bed", status: "ACTIVE", media: [], productType: "Beds", vendor: "Harbour", variants: [{ id: "v1", priceMinor: 49900, quantity: 4, reserved: 0 }] };
const listCalls = () => api.request.mock.calls.map((call) => String(call[0])).filter((path) => path.startsWith("/products?"));

beforeEach(() => {
  vi.resetAllMocks();
  api.all.mockResolvedValue([{ id: "c1", title: "Summer", productIds: [] }]);
  api.request.mockImplementation(async (path: string) => path === "/products/facets"
    ? { productTypes: ["Beds", "Lighting"], vendors: ["Harbour"], tags: ["oak"] }
    : { nodes: [product], nextCursor: null });
});

describe("products list filters", () => {
  it("offers the store's own types, brands, tags and collections and sends the chosen ones", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ProductsPage /></ToastProvider>);
    await screen.findByRole("link", { name: "Oak bed" });
    await user.selectOptions(await screen.findByRole("combobox", { name: "Filter by type" }), "Lighting");
    await waitFor(() => expect(listCalls().at(-1)).toContain("productType=Lighting"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by collection" }), "c1");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by stock" }), "false");
    await waitFor(() => expect(listCalls().at(-1)).toMatch(/productType=Lighting.*collectionId=c1.*available=false/));
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(listCalls().at(-1)).not.toMatch(/productType|collectionId|available/));
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("leaves out filters the store has nothing for", async () => {
    api.request.mockImplementation(async (path: string) => path === "/products/facets" ? { productTypes: [], vendors: [], tags: [] } : { nodes: [product], nextCursor: null });
    api.all.mockResolvedValue([]);
    render(<ToastProvider><ProductsPage /></ToastProvider>);
    await screen.findByRole("link", { name: "Oak bed" });
    expect(screen.queryByRole("combobox", { name: "Filter by type" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Filter by collection" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Filter by stock" })).toBeVisible();
  });

  it("asks before archiving several products and says how many", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ProductsPage /></ToastProvider>);
    await user.click(await screen.findByRole("checkbox", { name: "Select Oak bed" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("dialog", { name: "Archive 1 product?" });
    expect(api.request).not.toHaveBeenCalledWith("/products/p1", expect.anything());
    await user.click(within(dialog).getByRole("button", { name: "Archive products" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/products/p1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "ARCHIVED" }) })));
  });
});
