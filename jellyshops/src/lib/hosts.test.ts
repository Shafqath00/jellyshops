import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APEX_PATH_SEGMENTS, classifyHost, isShopLabel, parseHost, type HostRequest } from "./hosts";

const route = (host: string, path = "/", extra: Partial<HostRequest> = {}) => classifyHost({ host, path, ...extra });

describe("parseHost", () => {
  it("lower-cases, strips the port and a trailing dot", () => {
    expect(parseHost("MyShop.JellyShop.io:443")).toEqual({ hostname: "myshop.jellyshop.io", port: "443" });
    expect(parseHost("jellyshop.io.")).toEqual({ hostname: "jellyshop.io", port: "" });
    expect(parseHost(" localhost:3000 ")).toEqual({ hostname: "localhost", port: "3000" });
  });

  it("keeps IPv6 hosts in brackets", () => {
    expect(parseHost("[::1]:3000")).toEqual({ hostname: "[::1]", port: "3000" });
  });

  it("treats a missing host as empty", () => {
    expect(parseHost(undefined)).toEqual({ hostname: "", port: "" });
  });
});

describe("isShopLabel", () => {
  it.each(["new", "my-shop", "shop123", "a".repeat(63)])("accepts %s", (label) => expect(isShopLabel(label)).toBe(true));
  it.each(["ab", "-shop", "shop-", "my--shop", "My-Shop", "my_shop", "xn--bcher-kva", "a".repeat(64)])(
    "refuses %s",
    (label) => expect(isShopLabel(label)).toBe(false),
  );
});

describe("classifyHost: marketing site (apex)", () => {
  it("serves the home page and app pages", () => {
    for (const path of ["/", "/login", "/signup", "/onboarding", "/changelog", "/auth/callback", "/theme-preview/jelly-minimal"]) {
      expect(route("jellyshop.io", path)).toEqual({ kind: "marketing" });
    }
  });

  it("serves public files and API routes", () => {
    expect(route("jellyshop.io", "/favicon.ico")).toEqual({ kind: "marketing" });
    expect(route("jellyshop.io", "/logos/stripe.svg")).toEqual({ kind: "marketing" });
    expect(route("jellyshop.io", "/api/revalidate")).toEqual({ kind: "marketing" });
    expect(route("jellyshop.io", "/_next/static/chunk.js")).toEqual({ kind: "marketing" });
  });

  it("sends /admin to the merchant admin host, keeping the rest of the path and the query", () => {
    expect(route("jellyshop.io", "/admin")).toEqual({ kind: "redirect", location: "https://admin.jellyshop.io/" });
    expect(route("jellyshop.io", "/admin/orders", { search: "?tab=open" })).toEqual({
      kind: "redirect",
      location: "https://admin.jellyshop.io/orders?tab=open",
    });
  });

  it("sends old /<slug>/... store links to the shop's own address", () => {
    expect(route("jellyshop.io", "/express-bed/products/harbour", { search: "?variant=1" })).toEqual({
      kind: "redirect",
      location: "https://express-bed.jellyshop.io/products/harbour?variant=1",
    });
    expect(route("jellyshop.io", "/new")).toEqual({ kind: "redirect", location: "https://new.jellyshop.io/" });
  });

  it("does not redirect paths that cannot be shops", () => {
    expect(route("jellyshop.io", "/www/x")).toEqual({ kind: "marketing" });
    expect(route("jellyshop.io", "/Not_A_Slug")).toEqual({ kind: "marketing" });
  });

  it("redirects www to the apex", () => {
    expect(route("www.jellyshop.io", "/pricing", { search: "?a=1" })).toEqual({
      kind: "redirect",
      location: "https://jellyshop.io/pricing?a=1",
    });
  });

  it("matches the host in any case and with a port or trailing dot", () => {
    expect(route("JELLYSHOP.IO:443", "/")).toEqual({ kind: "marketing" });
    expect(route("jellyshop.io.", "/")).toEqual({ kind: "marketing" });
  });

  it("sends IP hosts and a missing host to the marketing site", () => {
    expect(route("127.0.0.1:3000", "/")).toEqual({ kind: "marketing" });
    expect(route("[::1]:3000", "/")).toEqual({ kind: "marketing" });
    expect(classifyHost({ host: null, path: "/" })).toEqual({ kind: "marketing" });
  });
});

describe("classifyHost: shops", () => {
  it("rewrites a shop subdomain to /sites/<slug>", () => {
    expect(route("myshop.jellyshop.io", "/")).toEqual({ kind: "shop", slug: "myshop", path: "/sites/myshop", mode: "subdomain" });
    expect(route("myshop.jellyshop.io", "/products/bed")).toEqual({
      kind: "shop",
      slug: "myshop",
      path: "/sites/myshop/products/bed",
      mode: "subdomain",
    });
  });

  it("leaves Next files, API routes, theme files and public files alone", () => {
    for (const path of ["/_next/static/a.js", "/api/storefront-access", "/themes/jelly-resthaven/hero.webp", "/favicon.ico"]) {
      expect(route("myshop.jellyshop.io", path)).toEqual({ kind: "pass" });
    }
  });

  it("strips a leftover /<own-slug> prefix from old links", () => {
    expect(route("myshop.jellyshop.io", "/myshop/cart", { search: "?x=1" })).toEqual({
      kind: "redirect",
      location: "https://myshop.jellyshop.io/cart?x=1",
    });
  });

  it("sends /admin on a shop's address to that shop's admin, keeping the page and the query", () => {
    expect(route("myshop.jellyshop.io", "/admin")).toEqual({ kind: "redirect", location: "https://admin.jellyshop.io/s/myshop" });
    expect(route("myshop.jellyshop.io", "/admin/orders/42", { search: "?tab=open" })).toEqual({
      kind: "redirect",
      location: "https://admin.jellyshop.io/s/myshop/orders/42?tab=open",
    });
    expect(route("myshop.localhost:3000", "/admin", { protocol: "http" })).toEqual({ kind: "redirect", location: "http://admin.localhost:3000/s/myshop" });
    // Only the first segment counts: a shop page that merely contains "admin" stays a shop page.
    expect(route("myshop.jellyshop.io", "/pages/admin")).toEqual({ kind: "shop", slug: "myshop", path: "/sites/myshop/pages/admin", mode: "subdomain" });
  });

  it("shows the shop-not-found page for reserved, malformed, punycode and nested labels", () => {
    for (const host of ["api.jellyshop.io", "mail.jellyshop.io", "ab.jellyshop.io", "my--shop.jellyshop.io", "xn--bcher-kva.jellyshop.io", "x.myshop.jellyshop.io"]) {
      expect(route(host, "/")).toEqual({ kind: "shop-not-found" });
    }
  });

  it("works on *.localhost in development, keeping the port and http", () => {
    expect(route("myshop.localhost:3000", "/cart")).toEqual({ kind: "shop", slug: "myshop", path: "/sites/myshop/cart", mode: "subdomain" });
    expect(route("localhost:3000", "/myshop/cart", { protocol: "http" })).toEqual({
      kind: "redirect",
      location: "http://myshop.localhost:3000/cart",
    });
  });

  it("honours another root domain", () => {
    expect(route("myshop.example.test", "/", { rootDomain: "example.test" })).toEqual({
      kind: "shop",
      slug: "myshop",
      path: "/sites/myshop",
      mode: "subdomain",
    });
  });
});

describe("classifyHost: admin hosts", () => {
  it("rewrites the merchant admin host to /admin", () => {
    expect(route("admin.jellyshop.io", "/")).toEqual({ kind: "merchant-admin", path: "/admin" });
    expect(route("admin.jellyshop.io", "/orders/42")).toEqual({ kind: "merchant-admin", path: "/admin/orders/42" });
  });

  it("serves sign-in and already-prefixed admin paths as they are on the merchant admin host", () => {
    for (const path of ["/admin/orders", "/login", "/signup", "/auth/continue", "/onboarding", "/_next/a.js", "/api/x"]) {
      expect(route("admin.jellyshop.io", path)).toEqual({ kind: "pass" });
    }
  });

  it("rewrites the platform host to /platform-admin", () => {
    expect(route("platform.jellyshop.io", "/")).toEqual({ kind: "platform-admin", path: "/platform-admin" });
    expect(route("platform.jellyshop.io", "/stores")).toEqual({ kind: "platform-admin", path: "/platform-admin/stores" });
    expect(route("platform.localhost:3000", "/stores")).toEqual({ kind: "platform-admin", path: "/platform-admin/stores" });
  });
});

describe("classifyHost: internal folders", () => {
  it("refuses direct requests to rewrite targets on every host", () => {
    for (const host of ["jellyshop.io", "myshop.jellyshop.io", "admin.jellyshop.io", "x.vercel.app", "shop.example.com"]) {
      expect(route(host, "/sites/other/cart")).toEqual({ kind: "not-found" });
      expect(route(host, "/platform-admin")).toEqual({ kind: "not-found" });
      expect(route(host, "/shop-not-found")).toEqual({ kind: "not-found" });
    }
  });
});

describe("classifyHost: previews and other hosts", () => {
  it("uses path mode on *.vercel.app", () => {
    expect(route("jellyshops-git-x.vercel.app", "/")).toEqual({ kind: "marketing" });
    expect(route("jellyshops-git-x.vercel.app", "/_shop/myshop/products/bed")).toEqual({
      kind: "shop",
      slug: "myshop",
      path: "/sites/myshop/products/bed",
      mode: "path",
    });
    expect(route("jellyshops-git-x.vercel.app", "/_shop/myshop")).toEqual({ kind: "shop", slug: "myshop", path: "/sites/myshop", mode: "path" });
    expect(route("jellyshops-git-x.vercel.app", "/_shop/api")).toEqual({ kind: "shop-not-found" });
  });

  it("treats any other host as a possible custom domain", () => {
    expect(route("Shop.Example.com", "/")).toEqual({ kind: "custom-domain", hostname: "shop.example.com" });
  });
});

describe("classifyHost: today's /<slug> addresses (storeLinks: path)", () => {
  const path = (host: string, p: string, extra: Partial<HostRequest> = {}) => route(host, p, { storeLinks: "path", ...extra });

  it("serves shops under the main address", () => {
    expect(path("jellyshop.io", "/myshop")).toEqual({ kind: "shop", slug: "myshop", path: "/sites/myshop", mode: "path" });
    expect(path("localhost:3000", "/myshop/products/bed")).toEqual({ kind: "shop", slug: "myshop", path: "/sites/myshop/products/bed", mode: "path" });
  });

  it("keeps the admin and app pages where they are", () => {
    expect(path("jellyshop.io", "/admin/orders")).toEqual({ kind: "marketing" });
    expect(path("jellyshop.io", "/login")).toEqual({ kind: "marketing" });
    expect(path("jellyshop.io", "/")).toEqual({ kind: "marketing" });
    expect(path("jellyshop.io", "/www")).toEqual({ kind: "marketing" });
  });

  it("still refuses internal folders", () => {
    expect(path("jellyshop.io", "/sites/myshop")).toEqual({ kind: "not-found" });
  });

  it("sends /<shop>/admin to that shop's admin", () => {
    expect(path("jellyshop.io", "/myshop/admin")).toEqual({ kind: "redirect", location: "https://jellyshop.io/admin/s/myshop" });
    expect(path("jellyshop.io", "/myshop/admin/orders", { search: "?a=1" })).toEqual({ kind: "redirect", location: "https://jellyshop.io/admin/s/myshop/orders?a=1" });
  });
});

describe("classifyHost: preview addresses (storeLinks: preview)", () => {
  it("serves /_shop/<slug> and sends old /<slug> links there", () => {
    expect(route("localhost:3000", "/_shop/myshop/cart", { storeLinks: "preview" })).toEqual({ kind: "shop", slug: "myshop", path: "/sites/myshop/cart", mode: "path" });
    expect(route("localhost:3000", "/myshop/cart", { storeLinks: "preview", protocol: "http", search: "?a=1" })).toEqual({
      kind: "redirect",
      location: "http://localhost:3000/_shop/myshop/cart?a=1",
    });
  });
});

describe("APEX_PATH_SEGMENTS", () => {
  it("lists every top-level app folder and public entry, so they are never taken for old store links", () => {
    const appDir = join(process.cwd(), "src", "app");
    const publicDir = join(process.cwd(), "public");
    const appFolders = readdirSync(appDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("(") && !entry.name.startsWith("["))
      .map((entry) => entry.name);
    const publicFolders = readdirSync(publicDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const missing = [...appFolders, ...publicFolders].filter((name) => !APEX_PATH_SEGMENTS.has(name));
    expect(missing).toEqual([]);
  });
});
