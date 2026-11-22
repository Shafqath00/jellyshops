import { beforeEach, expect, it, vi } from "vitest";
import { decideStoreAccess, resetAccessGate, storeSlugFromPath } from "./access-gate";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function backend(options: { protectedStore?: boolean; goodToken?: string; down?: boolean } = {}) {
  return vi.fn(async (url: string, headers?: Record<string, string>) => {
    if (options.down) throw new Error("offline");
    if (url.endsWith("/api/public/storefronts/shop")) return json({ store: { id: "store-1" } });
    if (url.endsWith("/api/public/storefronts/gone")) return json({}, 404);
    if (url.endsWith("/storefront/access/status")) {
      const token = headers?.["x-storefront-access"];
      return json({ protected: options.protectedStore === true, unlocked: !options.protectedStore || (token !== undefined && token === options.goodToken) });
    }
    return json({}, 500);
  });
}

beforeEach(() => resetAccessGate());

it("finds the store in a path and leaves app pages and files alone", () => {
  expect(storeSlugFromPath("/shop/products/bed")).toBe("shop");
  expect(storeSlugFromPath("/shop")).toBe("shop");
  for (const path of ["/", "/admin/orders", "/api/revalidate", "/theme-preview/x", "/store-password/shop", "/favicon.ico", "/Shop"]) expect(storeSlugFromPath(path)).toBeNull();
});

it("lets everyone into an open store and asks the backend only once a minute", async () => {
  const lookup = backend();
  expect(await decideStoreAccess("/shop/products/bed", () => undefined, { origin: "http://api", lookup })).toEqual({ kind: "pass" });
  expect(await decideStoreAccess("/shop", () => undefined, { origin: "http://api", lookup })).toEqual({ kind: "pass" });
  expect(lookup).toHaveBeenCalledTimes(2);
});

it("shows the password page on a protected store until the shopper's token unlocks it", async () => {
  const lookup = backend({ protectedStore: true, goodToken: "good" });
  expect(await decideStoreAccess("/shop", () => undefined, { origin: "http://api", lookup })).toEqual({ kind: "password", slug: "shop" });
  expect(await decideStoreAccess("/shop", () => "wrong", { origin: "http://api", lookup })).toEqual({ kind: "password", slug: "shop" });
  const cookie = vi.fn(() => "good");
  expect(await decideStoreAccess("/shop/cart", cookie, { origin: "http://api", lookup })).toEqual({ kind: "pass-private" });
  expect(cookie).toHaveBeenCalledWith("jelly-access-store-1");
});

it("keeps the store open when the backend can't be reached, and lets missing stores reach their 404", async () => {
  expect(await decideStoreAccess("/shop", () => undefined, { origin: "http://api", lookup: backend({ down: true }) })).toEqual({ kind: "pass" });
  expect(await decideStoreAccess("/gone", () => undefined, { origin: "http://api", lookup: backend() })).toEqual({ kind: "pass" });
});
