import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "./page";
vi.mock("@/features/auth/auth-provider", () => { const activeStore = { id: "store-demo", role: "OWNER", currency: "INR", country: "IN" }; const session = { access_token: "jelly-demo-merchant" }; return { useAuth: () => ({ activeStore, session }) }; });
const order = { id: "order-1", number: "JS-1001", storeId: "store-demo", status: "PAID", customerSnapshot: { name: "Asha Rao" }, totalMinor: 129900, currency: "INR", createdAt: "2026-09-16T12:00:00.000Z", subtotalMinor: 119900, shippingMinor: 10000, fulfilmentStartedAt: null, paymentStatus: "PAID" };
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });
describe("OrdersPage", () => {
    it("lists authoritative orders and requests server filters while preserving them in the URL", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ orders: [order], total: 1, page: 1, pageSize: 25, summary: { total: 1, PAID: 1 } }))));
        vi.stubGlobal("fetch", fetchMock);
        render(<OrdersPage />);
        expect(await screen.findByText("JS-1001")).toBeVisible();
        expect(screen.getByText("Asha Rao")).toBeVisible();
        await user.selectOptions(screen.getByLabelText("Payment status"), "PAID");
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("paymentStatus=PAID"), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) })));
        expect(window.location.search).toContain("paymentStatus=PAID");
        await user.type(screen.getByLabelText("Search orders"), "Asha");
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("query=Asha"), expect.anything()));
    });
    it("restores sorting and pagination from the URL", async () => {
        window.history.replaceState(null, "", "/admin/orders?sort=amount&direction=asc&page=2");
        const mock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ orders: [], total: 0, summary: {}, page: 2, pageSize: 25 }))));
        vi.stubGlobal("fetch", mock);
        render(<OrdersPage />);
        expect(await screen.findByText("No orders yet")).toBeVisible();
        expect(mock).toHaveBeenCalledWith(expect.stringContaining("sort=amount&direction=asc&page=2"), expect.anything());
    });
    it("enables the workspace through the store settings endpoint", async () => {
        const user = userEvent.setup();
        let enabled = false;
        const mock = vi.fn().mockImplementation((_url, init) => { if (init?.method === "PATCH") {
            enabled = true;
            return Promise.resolve(new Response(JSON.stringify({ enabled })));
        } return Promise.resolve(new Response(JSON.stringify({ orders: [], total: 0, page: 1, pageSize: 25, summary: {}, featureEnabled: enabled }))); });
        vi.stubGlobal("fetch", mock);
        render(<OrdersPage />);
        await user.click(await screen.findByRole("button", { name: "Enable order workspace" }));
        await waitFor(() => expect(mock).toHaveBeenCalledWith(expect.stringContaining("/orders/settings"), expect.objectContaining({ method: "PATCH", body: JSON.stringify({ enabled: true }) })));
        await waitFor(() => expect(screen.queryByRole("button", { name: "Enable order workspace" })).toBeNull());
    });
});
