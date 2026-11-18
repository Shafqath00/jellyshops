import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicOrderPage from "./view";
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "berry", publicToken: "secret" }) }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: { getStoreBySlug: () => ({ name: "Berry", slug: "berry" }) } }) }));
vi.mock("@/features/storefront/components/storefront-shell", () => ({ useThemePresentation: () => ({ shell: { OrderPage: ({ children }: {
                children: React.ReactNode;
            }) => children }, settings: {} }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Public order refresh", () => {
    it("checks quickly while the payment is confirming and stops once the server says paid", async () => {
        vi.useFakeTimers();
        let paid = false;
        const mock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("storefronts") ? { store: { id: "store-1" } } : { order: { status: paid ? "PAID" : "PENDING_PAYMENT", number: "JS-1", totalMinor: 1000, currency: "GBP" }, items: [], payment: { status: paid ? "PAID" : "PENDING" } }))));
        vi.stubGlobal("fetch", mock);
        render(<PublicOrderPage />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.getByRole("heading", { name: "We're confirming your payment" })).toBeVisible();
        paid = true;
        await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
        expect(screen.getByRole("heading", { name: "Thank you for your order" })).toBeVisible();
        const calls = mock.mock.calls.length;
        await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
        expect(mock).toHaveBeenCalledTimes(calls);
    });
    it("stays within the server's 30 lookups a minute while waiting", async () => {
        vi.useFakeTimers();
        const mock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ order: { status: "PENDING_PAYMENT", currency: "GBP" }, items: [], payment: { status: "PENDING" } }))));
        vi.stubGlobal("fetch", mock);
        render(<PublicOrderPage storeId="store-1" />);
        await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
        expect(mock.mock.calls.length).toBeLessThanOrEqual(12);
        expect(mock.mock.calls.every(([url]) => !String(url).includes("storefronts"))).toBe(true);
    });
    it("never shows the order as paid because of the address Stripe sent the shopper back to", async () => {
        window.history.replaceState(null, "", "/berry/order/secret?paid=1&redirect_status=succeeded");
        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ order: { status: "PENDING_PAYMENT", currency: "GBP" }, items: [], payment: { status: "PENDING" } })))));
        render(<PublicOrderPage storeId="store-1" />);
        expect(await screen.findByRole("heading", { name: "We're confirming your payment" })).toBeVisible();
        expect(screen.getByText("Confirming…")).toBeVisible();
        expect(screen.queryByText("Thank you for your order")).toBeNull();
        window.history.replaceState(null, "", "/");
    });
    it("shows a loading skeleton, then the order details with the delivery address", async () => {
        let answer: (value: Response) => void = () => {};
        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { answer = resolve; })));
        render(<PublicOrderPage storeId="store-1" />);
        expect(screen.getByRole("status")).toHaveTextContent("Loading your order…");
        await act(async () => { answer(new Response(JSON.stringify({ order: { status: "PAID", number: "JS-7", currency: "GBP", totalMinor: 9900, delivery: { name: "Ada Lovelace", line1: "1 High St", city: "Leeds", postalCode: "LS1 1AA", country: "GB" } }, items: [{ titleSnapshot: "Lamp", quantity: 1, unitPriceMinor: 9900, fulfillmentType: "PHYSICAL" }], payment: { status: "PAID" } }))); });
        expect(await screen.findByRole("heading", { name: "Thank you for your order" })).toBeVisible();
        expect(screen.getByText("Paid")).toBeVisible();
        expect(screen.getByText("1 High St")).toBeVisible();
        expect(screen.getByText("United Kingdom")).toBeVisible();
        expect(screen.getByText("We’ll email tracking details when it’s sent")).toBeVisible();
    });
    it("waits for the rate-limit cooldown even when focus changes", async () => {
        vi.useFakeTimers();
        let reads = 0;
        const mock = vi.fn(async (url: string) => {
            if (url.includes("storefronts")) return new Response(JSON.stringify({ store: { id: "store-1" } }));
            reads++;
            if (reads === 2) return new Response(JSON.stringify({ error: { message: "Too many requests" } }), { status: 429 });
            return new Response(JSON.stringify({ order: { status: reads > 2 ? "PAID" : "PENDING_PAYMENT", currency: "GBP" }, items: [], payment: null }));
        });
        vi.stubGlobal("fetch", mock);
        render(<PublicOrderPage />);
        await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
        expect(screen.getByRole("alert")).toBeVisible();
        const calls = mock.mock.calls.length;
        await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(59000); });
        expect(mock).toHaveBeenCalledTimes(calls);
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(screen.getByRole("heading", { name: "Thank you for your order" })).toBeVisible();
        expect(screen.queryByRole("alert")).toBeNull();
    });
    it("refreshes visible status when the window regains focus", async () => {
        vi.useFakeTimers();
        const mock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("storefronts") ? { store: { id: "store-1" } } : { order: { status: "PAID", currency: "GBP" }, items: [], payment: null }))));
        vi.stubGlobal("fetch", mock);
        render(<PublicOrderPage />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        const calls = mock.mock.calls.length;
        await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(0); });
        expect(mock).toHaveBeenCalledTimes(calls + 1);
    });
});
