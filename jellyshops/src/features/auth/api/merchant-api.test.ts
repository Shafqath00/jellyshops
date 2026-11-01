import { afterEach, describe, expect, it, vi } from "vitest";
import { loadMerchant } from "./merchant-api";

describe("loadMerchant", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the store list from the merchant API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ stores: [] }), { status: 200 })));

    await expect(loadMerchant("http://api.local", { access_token: "token" } as never)).resolves.toEqual([]);
  });

  it("shows the API message when the merchant service is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "MERCHANT_DATA_UNAVAILABLE", message: "Merchant data is temporarily unavailable" },
    }), { status: 503, headers: { "content-type": "application/json" } })));

    await expect(loadMerchant("http://api.local", { access_token: "token" } as never))
      .rejects.toThrow("Merchant data is temporarily unavailable");
  });

  it("uses a safe fallback for non-JSON errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 })));

    await expect(loadMerchant("http://api.local", { access_token: "token" } as never))
      .rejects.toThrow("Could not load your stores. Check your connection and retry.");
  });
});
