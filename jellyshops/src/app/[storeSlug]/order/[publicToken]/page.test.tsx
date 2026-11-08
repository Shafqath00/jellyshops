import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicOrderPage from "./page";
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "berry", publicToken: "secret" }) }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: { getStoreBySlug: () => ({ name: "Berry", slug: "berry" }) } }) }));
vi.mock("@/features/storefront/components/storefront-shell", () => ({ useThemePresentation: () => ({ shell: { OrderPage: ({ children }: {
                children: React.ReactNode;
            }) => children }, settings: {} }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Public order refresh", () => {
    it("keeps pending-order polling within the five-per-minute limit and stops after confirmation", async () => {
        vi.useFakeTimers();
        let paid = false;
        const mock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("storefronts") ? { store: { id: "store-1" } } : { order: { status: paid ? "PAID" : "PENDING_PAYMENT", number: "JS-1", totalMinor: 1000, currency: "GBP" }, items: [], payment: { status: paid ? "PAID" : "PENDING" } }))));
        vi.stubGlobal("fetch", mock);
        render(<PublicOrderPage />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.getByRole("heading", { name: "Payment pending" })).toBeVisible();
        paid = true;
        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(screen.getByRole("heading", { name: "Payment pending" })).toBeVisible();
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(screen.getByRole("heading", { name: "Thank you for your order" })).toBeVisible();
        const calls = mock.mock.calls.length;
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(mock).toHaveBeenCalledTimes(calls);
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
        await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
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
