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
    it("refreshes pending payment after five seconds and stops after confirmation", async () => {
        vi.useFakeTimers();
        let paid = false;
        const mock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("storefronts") ? { store: { id: "store-1" } } : { order: { status: paid ? "PAID" : "PENDING_PAYMENT", number: "JS-1", totalMinor: 1000, currency: "GBP" }, items: [], payment: { status: paid ? "PAID" : "PENDING" } }))));
        vi.stubGlobal("fetch", mock);
        render(<PublicOrderPage />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.getByRole("heading", { name: "Payment pending" })).toBeVisible();
        paid = true;
        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(screen.getByRole("heading", { name: "Thank you for your order" })).toBeVisible();
        const calls = mock.mock.calls.length;
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(mock).toHaveBeenCalledTimes(calls);
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
