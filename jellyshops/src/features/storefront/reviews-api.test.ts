import { describe, expect, it, vi } from "vitest";
import { fetchReviewSummaries, storefrontReviewAccess } from "./reviews-api";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("storefront reviews connection", () => {
  it("asks for ratings in groups of 100 and merges them", async () => {
    const ids = Array.from({ length: 150 }, (_, index) => `p${index}`);
    const fetcher = vi.fn(async (url: string) => json({ summaries: url.includes("p120") ? { p120: { average: 4, count: 2 } } : { p1: { average: 5, count: 1 } } }));
    const result = await fetchReviewSummaries("store a", ids, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).toContain("/api/public/stores/store%20a/reviews/summary?productIds=p0,p1,");
    expect(result).toEqual({ p1: { average: 5, count: 1 }, p120: { average: 4, count: 2 } });
  });

  it("reads a page of reviews and sends a review, passing on the shop's message when refused", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => init?.method === "POST" ? json({ error: { message: "Too many reviews." } }, 429) : json({ summary: { average: 5, count: 1, distribution: [1, 0, 0, 0, 0] }, reviews: [] }));
    const access = storefrontReviewAccess("s1", fetcher as unknown as typeof fetch);
    await access.list("p 1", { limit: 5, offset: 5 });
    expect(String(fetcher.mock.calls[0][0])).toContain("/reviews/products/p%201?limit=5&offset=5");
    expect(await access.submit("p1", { rating: 5, authorName: "Ana" })).toEqual({ ok: false, message: "Too many reviews." });
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ rating: 5, authorName: "Ana" });
  });
});
