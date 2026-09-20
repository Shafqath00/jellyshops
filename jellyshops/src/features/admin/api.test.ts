import { describe, expect, it, vi } from "vitest";
import { createAdminApi } from "./api";

describe("createAdminApi", () => {
  it("sends the bearer token when loading a store summary", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ revenueMinor: 0, orderCount: 0, publishedProductCount: 0, actionableOrders: [], lowStock: [] }), { status: 200 }));
    await createAdminApi({ baseUrl: "https://api.test", token: "merchant-token", fetch: fetcher }).getSummary("store-a");
    expect(fetcher).toHaveBeenCalledWith("https://api.test/api/stores/store-a/admin-summary", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer merchant-token" }) }));
  });
});
