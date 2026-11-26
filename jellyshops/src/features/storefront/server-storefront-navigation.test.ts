import { expect, it, vi } from "vitest";

// A design that passes as published, so the test is only about what else comes with the page.
vi.mock("@jelly/storefront-schema", () => ({
  runtimeStorefrontSnapshotV4Schema: { safeParse: () => ({ success: true, data: { storeId: "s1" } }) },
  migrateStorefrontDocument: () => ({ storeId: "s1" }),
  readStorePreferences: () => ({}),
}));

import { loadServerStorefront } from "./server-storefront";

it("sends the store's menu destinations with the page, so menus need no browser request", async () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const resources = [{ kind: "page", id: "p1", handle: "about", blogHandle: null }];
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes("/storefronts/")) return json({ store: { id: "s1", name: "Shop", slug: "shop", country: "GB", currency: "GBP" } });
    if (url.includes("/storefront/public")) return json({ id: "pub", document: {} });
    if (url.includes("/context/navigation")) return json({ resources });
    return json({ nodes: [], nextCursor: null });
  });
  const data = await loadServerStorefront("shop", fetcher as never);
  expect(data?.navigation).toEqual(resources);
});

it("still renders the page when menu destinations can't be read", async () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes("/storefronts/")) return json({ store: { id: "s1", name: "Shop", slug: "shop", country: "GB", currency: "GBP" } });
    if (url.includes("/storefront/public")) return json({ id: "pub", document: {} });
    if (url.includes("/context/navigation")) return json({}, 500);
    return json({ nodes: [], nextCursor: null });
  });
  const data = await loadServerStorefront("shop", fetcher as never);
  expect(data?.navigation).toBeNull();
  expect(data?.store.id).toBe("s1");
});
