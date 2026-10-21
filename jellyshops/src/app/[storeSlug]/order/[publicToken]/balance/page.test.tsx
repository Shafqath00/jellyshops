import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrderBalancePage from "./page";
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "berry", publicToken: "secret" }) }));
vi.mock("@/features/commerce/components/payment-element-checkout", () => ({ PaymentElementCheckout: ({ onPaid }: {
        onPaid: () => void;
    }) => <button onClick={onPaid}>Pay balance</button> }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("Balance payment", () => {
    it("waits for server verification after Stripe submission", async () => { vi.useFakeTimers(); let applied = false; vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("storefronts") ? { store: { id: "store-1" } } : { revisionId: "r2", amountMinor: 500, currency: "GBP", status: applied ? "APPLIED" : "PENDING", clientSecret: "secret", connectedAccountId: "acct1", expiresAt: null }))))); render(<OrderBalancePage />); await act(async () => { await vi.advanceTimersByTimeAsync(0); }); fireEvent.click(screen.getByRole("button", { name: "Pay balance" })); await act(async () => { await vi.advanceTimersByTimeAsync(0); }); expect(screen.getByRole("status")).toHaveTextContent("Waiting for the shop to verify"); expect(screen.queryByRole("heading", { name: "Balance payment confirmed" })).toBeNull(); applied = true; await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(screen.getByRole("heading", { name: "Balance payment confirmed" })).toBeVisible(); });
    it("does not show a payment form for expired changes", async () => { vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("storefronts") ? { store: { id: "store-1" } } : { status: "EXPIRED", amountMinor: 500, currency: "GBP", clientSecret: "secret", connectedAccountId: "acct1" }))))); render(<OrderBalancePage />); await act(async () => { await vi.advanceTimersByTimeAsync(0); }); expect(screen.getByRole("alert")).toHaveTextContent("no longer available"); expect(screen.queryByRole("button", { name: "Pay balance" })).toBeNull(); });
});
