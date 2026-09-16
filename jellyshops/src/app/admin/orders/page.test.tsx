import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "./page";

vi.mock("@/features/commerce/merchant-session", () => ({
  getMerchantSession: () => ({ storeId: "store-demo", token: "jelly-demo-merchant" }),
}));

afterEach(() => vi.unstubAllGlobals());

describe("OrdersPage", () => {
  it("lists server-authoritative merchant orders", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ orders: [{
      id: "order-1", number: "JS-1001", storeId: "store-demo", status: "PAID", customerSnapshot: { name: "Asha Rao" },
      totalMinor: 129900, currency: "INR", createdAt: "2026-09-16T12:00:00.000Z", subtotalMinor: 119900, shippingMinor: 10000,
      fulfilmentStartedAt: null, paymentStatus: "PAID",
    }] }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<OrdersPage />);

    expect(await screen.findByText("JS-1001")).toBeVisible();
    expect(screen.getByText("Asha Rao")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/orders",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) }),
    );
  });
});
