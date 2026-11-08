import { describe, expect, it, vi } from "vitest";
import { requestBackInStock } from "./back-in-stock-api";

describe("back-in-stock request", () => {
  it("posts the variant and email, and passes on the shop's message", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Too many." } }), { status: 429 }));
    expect(await requestBackInStock("store a", "v1", "ana@example.test", undefined, fetcher as unknown as typeof fetch)).toEqual({ ok: false, message: "Too many." });
    expect(String(fetcher.mock.calls[0][0])).toContain("/api/public/stores/store%20a/back-in-stock");
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ variantId: "v1", email: "ana@example.test" });
  });
});
