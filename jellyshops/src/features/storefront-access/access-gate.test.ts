import { beforeEach, expect, it, vi } from "vitest";
import { decideStoreAccess, resetAccessGate, storeSlugFromPath } from "./access-gate";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function backend(options: { protectedStore?: boolean; goodToken?: string; down?: boolean; paused?: boolean } = {}) {
  return vi.fn(async (url: string, headers?: Record<string, string>) => {
    if (options.down) throw new Error("offline");
    if (url.endsWith("/api/public/storefronts/shop")) return json({ store: { id: "store-1" } });
    if (url.endsWith("/api/public/storefronts/gone")) return json({}, 404);
    if (url.endsWith("/storefront/access/status")) {
      const token = headers?.["x-storefront-access"];
      return json({ paused: options.paused === true, protected: options.protectedStore === true, unlocked: !options.protectedStore || (token !== undefined && token === options.goodToken) });
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

it("sends a shop's old address to its new one", async () => {
  const lookup = vi.fn(async (url: string) => {
    if (url.endsWith("/api/public/storefronts/old-name")) return json({}, 404);
    if (url.endsWith("/api/public/slugs/old-name")) return json({ slug: "shop" });
    return json({}, 500);
  });
  expect(await decideStoreAccess("/old-name/cart", () => undefined, { origin: "http://api", lookup })).toEqual({ kind: "moved", slug: "shop" });
  // Remembered for a minute: no second round of lookups.
  expect(await decideStoreAccess("/old-name", () => undefined, { origin: "http://api", lookup })).toEqual({ kind: "moved", slug: "shop" });
  expect(lookup).toHaveBeenCalledTimes(2);
});

it("names the password cookie so only this exact site can set it in production", async () => {
  const { accessCookieName } = await import("./access-api");
  expect(accessCookieName("store-1", true)).toBe("__Host-jelly-access-store-1");
  expect(accessCookieName("store-1", false)).toBe("jelly-access-store-1");
});

it("closes a paused shop (billing) for everyone, even with a good password token", async () => {
  const lookup = backend({ paused: true, protectedStore: true, goodToken: "good" });
  expect(await decideStoreAccess("/shop", () => "good", { origin: "http://api", lookup })).toEqual({ kind: "paused" });
  expect(await decideStoreAccess("/shop/products/bed", () => undefined, { origin: "http://api", lookup })).toEqual({ kind: "paused" });
});
