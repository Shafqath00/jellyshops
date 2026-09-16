import { describe, expect, it, vi } from "vitest";
import { createMerchantCommerceApi } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("merchant commerce API client", () => {
  it("loads merchant orders with the merchant bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: [] }));
    const api = createMerchantCommerceApi({
      baseUrl: "http://localhost:3001",
      token: "jelly-demo-merchant",
      fetch: fetchMock,
    });

    await expect(api.listOrders("store-demo")).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/stores/store-demo/orders",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }) }),
    );
  });

  it("loads Stripe readiness and requests a hosted onboarding link as the merchant", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ connected: false, checkoutReady: false, closed: false }))
      .mockResolvedValueOnce(jsonResponse({ url: "https://connect.stripe.test/onboarding" }, 201));
    const api = createMerchantCommerceApi({ baseUrl: "http://localhost:3001", token: "jelly-demo-merchant", fetch: fetchMock });

    await expect(api.getStripeStatus("store-demo")).resolves.toMatchObject({ connected: false });
    await expect(api.createOnboardingLink("store-demo", {
      returnUrl: "http://localhost:3000/admin/payments",
      refreshUrl: "http://localhost:3000/admin/payments",
    })).resolves.toEqual({ url: "https://connect.stripe.test/onboarding" });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3001/api/stores/store-demo/stripe-connect/onboarding-link",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jelly-demo-merchant" }),
      }),
    );
  });
});
