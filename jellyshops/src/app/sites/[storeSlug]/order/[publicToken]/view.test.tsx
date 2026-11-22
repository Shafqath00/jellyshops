import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicOrderPage from "./view";
const mockTheme = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "berry", publicToken: "secret" }) }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ hydrated: true, repository: { getStoreBySlug: () => ({ name: "Berry", slug: "berry" }), getCartForStore: () => undefined } }) }));
vi.mock("@/features/storefront/components/storefront-shell", () => ({ useThemePresentation: () => ({ shell: { OrderPage: ({ children }: {
                children: React.ReactNode;
            }) => children }, settings: mockTheme.settings }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); mockTheme.settings = {}; sessionStorage.clear(); });
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
        expect(screen.getByRole("heading", { name: /^Thank you/ })).toBeVisible();
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
        expect(await screen.findByRole("heading", { name: /^Thank you/ })).toBeVisible();
        expect(screen.getByText("Paid")).toBeVisible();
        expect(screen.getByText("1 High St")).toBeVisible();
        expect(screen.getByText("United Kingdom")).toBeVisible();
        expect(screen.getByText("We’ll email tracking details when it’s sent")).toBeVisible();
        expect(screen.getByRole("heading", { name: "Thank you, Ada!" })).toBeVisible();
        expect(screen.getByText(/sent a confirmation email to the address you gave at checkout/)).toBeVisible();
        expect(screen.getByRole("link", { name: "Continue shopping" })).toHaveAttribute("href", "/berry/shop");
    });
    it("shows the email typed in this tab, the expected delivery date and what happens next", async () => {
        mockTheme.settings = { checkout: { deliveryDays: "3-5" } };
        sessionStorage.setItem("jelly-checkout-paid:berry", JSON.stringify({ publicToken: "secret", email: "ada@example.com", bagKey: "x", at: Date.now(), paid: false }));
        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ order: { status: "PAID", number: "JS-8", currency: "GBP", totalMinor: 9900, createdAt: "2026-11-20T10:00:00.000Z", delivery: { name: "Ada Lovelace", line1: "1 High St", city: "Leeds", postalCode: "LS1 1AA", country: "GB" } }, items: [{ titleSnapshot: "Lamp", quantity: 1, unitPriceMinor: 9900, fulfillmentType: "PHYSICAL" }], payment: { status: "PAID" }, shipments: [{ id: "s1", status: "SHIPPED", carrier: "Royal Mail", trackingNumber: "RM1", shippedAt: "2026-11-21T09:00:00.000Z", items: [] }] })))));
        render(<PublicOrderPage storeId="store-1" />);
        expect(await screen.findByRole("heading", { name: "Thank you, Ada!" })).toBeVisible();
        expect(screen.getByText("a•••@example.com")).toBeVisible();
        // Friday 20 Nov 2026 + 3 to 5 working days (weekend left out) = Wed 25 to Fri 27 Nov.
        expect(screen.getByText("Wed 25 – Fri 27 Nov")).toBeVisible();
        expect(screen.getByRole("heading", { name: "What happens next" })).toBeVisible();
        expect(screen.getByText("On its way").closest("li")).toHaveAttribute("data-state", "current");
        expect(screen.getByRole("link", { name: "Track order" })).toHaveAttribute("href", "#track-order");
        // The page marks the remembered order as paid, so checkout won't offer to take the same payment again.
        expect(JSON.parse(sessionStorage.getItem("jelly-checkout-paid:berry")!)).toMatchObject({ paid: true });
    });
    it("takes the payment words out of the address once the bag is emptied", async () => {
        window.history.replaceState(null, "", "/berry/order/secret?paid=1&payment_intent=pi_1&payment_intent_client_secret=pi_1_secret&redirect_status=succeeded");
        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ order: { status: "PAID", currency: "GBP", totalMinor: 100 }, items: [], payment: { status: "PAID" } })))));
        render(<PublicOrderPage storeId="store-1" />);
        expect(await screen.findByRole("heading", { name: /^Thank you/ })).toBeVisible();
        await vi.waitFor(() => expect(window.location.search).toBe(""));
        window.history.replaceState(null, "", "/");
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
        expect(screen.getByRole("heading", { name: /^Thank you/ })).toBeVisible();
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
