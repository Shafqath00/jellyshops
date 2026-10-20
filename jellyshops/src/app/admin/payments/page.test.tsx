import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaymentsPage from "./page";

vi.mock("@/features/auth/auth-provider", () => {
  const activeStore = { id: "store-demo", currency: "INR", country: "IN" };
  const session = { access_token: "jelly-demo-merchant" };
  return { useAuth: () => ({ activeStore, session }) };
});

afterEach(() => vi.unstubAllGlobals());

describe("PaymentsPage", () => {
  it("shows the merchant Stripe readiness panel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      connected: true, checkoutReady: true, cardPaymentsStatus: "active", payoutsStatus: "active", closed: false,
    }), { headers: { "content-type": "application/json" } })));

    render(<PaymentsPage />);

    expect(screen.getByRole("heading", { name: /payments & payouts/i })).toBeVisible();
    expect(await screen.findByRole("heading", { name: /payment readiness/i })).toBeVisible();
  });
});
