import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderDetailView } from "./page";
vi.mock("@/features/auth/auth-provider", () => { const activeStore = { id: "store-demo", currency: "INR", country: "IN" }; const session = { access_token: "merchant" }; return { useAuth: () => ({ activeStore, session }) }; });
const order = { id: "order-1", number: "JS-1001", storeId: "store-demo", status: "PAID", revision: 3, customerSnapshot: { name: "Asha", email: "asha@example.com" }, totalMinor: 1200, currency: "INR", createdAt: "2026-09-16T12:00:00Z", subtotalMinor: 1200, shippingMinor: 0, fulfilmentStartedAt: null };
const detail = { order, items: [{ variantId: "v1", titleSnapshot: "Berry cake", skuSnapshot: "CAKE-1", imageSnapshot: null, unitPriceMinor: 1200, quantity: 1 }], payment: { id: "p1", status: "PAID", amountMinor: 1200, currency: "INR", paymentIntentId: "pi_123", chargeId: null }, refunds: [], disputes: [], capabilities: { manage: true, edit: true, refund: true } };
const json = (value: unknown) => new Response(JSON.stringify(value));
beforeEach(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; });
afterEach(() => vi.unstubAllGlobals());
describe("OrderDetailView", () => {
    it("sends a fulfilment transition and reloads authoritative detail", async () => {
        const user = userEvent.setup();
        let confirmed = false;
        const mock = vi.fn().mockImplementation((_url, init) => { if (init?.method === "POST") {
            confirmed = true;
            return Promise.resolve(json({ ...order, status: "CONFIRMED" }));
        } return Promise.resolve(json({ ...detail, order: { ...order, status: confirmed ? "CONFIRMED" : "PAID" } })); });
        vi.stubGlobal("fetch", mock);
        render(<OrderDetailView orderId="order-1"/>);
        await user.click(await screen.findByRole("button", { name: "Confirm order" }));
        await waitFor(() => expect(mock).toHaveBeenCalledWith(expect.stringContaining("/fulfilment"), expect.objectContaining({ body: JSON.stringify({ status: "CONFIRMED" }) })));
        expect(await screen.findByRole("button", { name: "Start processing" })).toBeVisible();
    });
    it("confirms a financial action with revision and idempotency key, and preserves its form on error", async () => {
        const user = userEvent.setup();
        const mock = vi.fn().mockImplementation((_url, init) => Promise.resolve(init?.method === "POST" ? new Response(JSON.stringify({ error: { message: "Order revision changed" } }), { status: 409 }) : json(detail)));
        vi.stubGlobal("fetch", mock);
        render(<OrderDetailView orderId="order-1"/>);
        await user.click(await screen.findByRole("button", { name: "Refund" }));
        await user.clear(screen.getByLabelText(/Refund amount/));
        await user.type(screen.getByLabelText(/Refund amount/), "5");
        await user.click(screen.getByRole("button", { name: "Confirm" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Order revision changed");
        expect(screen.getByLabelText(/Refund amount/)).toHaveValue(5);
        const call = mock.mock.calls.find(([, init]) => init?.method === "POST");
        expect(JSON.parse(call![1].body)).toMatchObject({ revision: 3, amountMinor: 500, idempotencyKey: expect.any(String) });
    });
    it("hides financial actions for operational staff", async () => { vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(json({ ...detail, capabilities: { manage: true, edit: false, refund: false } })))); render(<OrderDetailView orderId="order-1"/>); expect(await screen.findByRole("button", { name: "Confirm order" })).toBeVisible(); expect(screen.queryByRole("button", { name: "Refund" })).toBeNull(); expect(screen.queryByRole("button", { name: "Edit items" })).toBeNull(); });
});

it("refunds selected items using their captured allocations", async () => {
    const user = userEvent.setup();
    const mock = vi.fn().mockImplementation((_url, init) => Promise.resolve(json(init?.method === "POST" ? { status: "PENDING" } : detail)));
    vi.stubGlobal("fetch", mock);
    render(<OrderDetailView orderId="order-1"/>);
    await user.click(await screen.findByRole("button", { name: "Refund" }));
    await user.selectOptions(screen.getByLabelText("Refund by"), "items");
    await user.clear(screen.getByLabelText("Berry cake quantity"));
    await user.type(screen.getByLabelText("Berry cake quantity"), "1");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => {
        const request = mock.mock.calls.find(([, init]) => init?.method === "POST");
        expect(request).toBeDefined();
        expect(JSON.parse(request![1].body)).toMatchObject({ revision: 3, items: [{ variantId: "v1", quantity: 1 }] });
        expect(JSON.parse(request![1].body)).not.toHaveProperty("amountMinor");
    });
});

it("does not offer physical packing steps for fulfilled digital-only orders", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(json({ ...detail, order: { ...order, fulfilmentStatus: "FULFILLED" }, items: detail.items.map(item => ({ ...item, fulfillmentType: "DIGITAL" })) }))));
    render(<OrderDetailView orderId="order-1"/>);
    expect(await screen.findByText("JS-1001")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirm order" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Start processing" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create shipment" })).toBeNull();
    expect(screen.getByText("Digital delivery", { exact: false })).toBeVisible();
});
