import { describe, expect, it, vi } from "vitest";
import { createCommerceApi, createMerchantCommerceApi } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("public catalog API client", () => {
  it("loads public store details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ store: { id: "store-demo", name: "Sweet Bakes", slug: "sweet-bakes", currency: "INR", country: "IN" } }));
    const api = createCommerceApi({ baseUrl: "http://localhost:3001", fetch: fetchMock });
    await expect(api.getPublicStore("store-demo")).resolves.toMatchObject({ store: { name: "Sweet Bakes", currency: "INR" } });
  });

  it("maps canonical backend products and variants", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      nodes: [{ id: "p1", storeId: "store-demo", handle: "cake", title: "Cake", description: "Fresh", productType: "Cakes", tags: [], media: [{ id: "m1", url: "/cake.jpg", altText: "Cake", position: 0 }], variants: [{ id: "v1", title: "1 kg", sku: "CAKE-1", priceMinor: 1200, quantity: 4, available: true }], available: true }],
      nextCursor: null,
    }));
    const api = createCommerceApi({ baseUrl: "http://localhost:3001", fetch: fetchMock });
    await expect(api.getPublicCatalog("store-demo")).resolves.toEqual([
      expect.objectContaining({ id: "p1", name: "Cake", variants: [expect.objectContaining({ id: "v1", name: "1 kg", priceMinor: 1200, stock: 4 })] }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/public/stores/store-demo/catalog/products?limit=100", expect.anything());
  });
});

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
