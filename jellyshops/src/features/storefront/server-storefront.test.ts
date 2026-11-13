import { expect, it, vi, afterEach } from "vitest";
import { loadServerStorefront } from "./server-storefront";
afterEach(() => vi.unstubAllGlobals());
it("distinguishes an unavailable API from a missing store and never loads a draft", async () => {
  const fetcher = vi.fn(async () => new Response("{}", { status: 503 }));
  await expect(loadServerStorefront("shop", fetcher)).rejects.toThrow(/unavailable/i);
  const missing = vi.fn(async () => new Response("{}", { status: 404 }));
  expect(await loadServerStorefront("shop", missing)).toBeNull();
  expect(fetcher).not.toHaveBeenCalledWith(expect.stringContaining("draft"), expect.anything());
});

it("reuses a store's data for 30 seconds, tagged with the store, and fetches design, products and collections side by side", async () => {
  const calls: Array<{ url: string; init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } }> = [];
  let open = 0; let mostAtOnce = 0;
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init: init as never });
    open += 1; mostAtOnce = Math.max(mostAtOnce, open);
    await new Promise((resolve) => setTimeout(resolve, 5));
    open -= 1;
    if (url.includes("/storefronts/")) return json({ store: { id: "s1", name: "Shop", slug: "shop", country: "GB", currency: "GBP" } });
    if (url.includes("/storefront/public")) return json({ id: "pub", document: {} });
    return json({ nodes: [], nextCursor: null });
  });
  await loadServerStorefront("shop", fetcher as never).catch(() => undefined);
  expect(calls.length).toBeGreaterThanOrEqual(4);
  for (const { init } of calls) expect(init.next).toEqual({ revalidate: 30, tags: ["storefront:shop"] });
  expect(calls.every(({ init }) => init.cache !== "no-store")).toBe(true);
  expect(mostAtOnce).toBe(3);
});
