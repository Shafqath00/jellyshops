import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderDetailView } from "./page";

vi.mock("@/features/commerce/merchant-session", () => ({
  getMerchantSession: () => ({ storeId: "store-demo", token: "jelly-demo-merchant" }),
}));

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}

const order = {
  id: "order-1", number: "JS-1001", storeId: "store-demo", status: "PAID", customerSnapshot: {
    name: "Asha Rao", email: "asha@example.com", phone: "+91 99999 99999", address: { line1: "12 Market Road", city: "Mumbai", region: "MH", postalCode: "400001", country: "IN" },
  }, totalMinor: 129900, currency: "INR", createdAt: "2026-09-16T12:00:00.000Z", subtotalMinor: 119900, shippingMinor: 10000, fulfilmentStartedAt: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("OrderDetailView", () => {
  it("loads the merchant order and sends its fulfilment transition to the server", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ order, items: [{ variantId: "variant-1", titleSnapshot: "Berry cake", skuSnapshot: "CAKE-1", imageSnapshot: null, unitPriceMinor: 119900, quantity: 1 }], payment: { id: "payment-1", status: "PAID", amountMinor: 129900, currency: "INR", paymentIntentId: "pi_123", chargeId: "ch_123" }, refunds: [], disputes: [{ stripeDisputeId: "dp_123", status: "needs_response" }] }))
      .mockResolvedValueOnce(jsonResponse({ ...order, status: "CONFIRMED" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<OrderDetailView orderId="order-1" />);

    expect(await screen.findByText("JS-1001")).toBeVisible();
    expect(screen.getByText(/payment dispute: needs response/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /confirm order/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3001/api/stores/store-demo/orders/order-1/fulfilment",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ status: "CONFIRMED" }) }),
    ));
    expect(await screen.findByText("confirmed")).toBeVisible();
  });
});
