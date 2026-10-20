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
