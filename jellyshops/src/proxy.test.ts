// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetAccessGate } from "@/features/storefront-access/access-gate";
import { proxy } from "./proxy";

/** The backend answers "open store" for every shop. */
function openBackend() {
  return vi.fn(async (url: string) => {
    if (url.includes("/api/public/storefronts/")) return Response.json({ store: { id: "store-1" } });
    return Response.json({ protected: false });
  });
}

const request = (url: string, host?: string) =>
  new NextRequest(url, { headers: { host: host ?? new URL(url).host } });

const rewriteOf = (response: Response) => {
  const target = response.headers.get("x-middleware-rewrite");
  return target ? new URL(target).pathname : null;
};

beforeEach(() => {
  resetAccessGate();
  vi.stubGlobal("fetch", openBackend());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("proxy with today's addresses (NEXT_PUBLIC_STORE_LINKS unset)", () => {
  it("serves /<slug>/... from the moved store pages", async () => {
    const response = await proxy(request("http://localhost:3000/myshop/products/bed"));
    expect(rewriteOf(response!)).toBe("/sites/myshop/products/bed");
  });

  it("leaves the admin and the marketing site alone", async () => {
    for (const path of ["/", "/admin/orders", "/login"]) {
      const response = await proxy(request(`http://localhost:3000${path}`));
      expect(rewriteOf(response!)).toBeNull();
      expect(response!.headers.get("location")).toBeNull();
    }
  });

  it("refuses the internal folder when typed", async () => {
    const response = await proxy(request("http://localhost:3000/sites/myshop"));
    expect(rewriteOf(response!)).toBe("/shop-not-found");
    expect(response!.status).toBe(404);
  });
});

describe("proxy with shop subdomains", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_STORE_LINKS", "subdomain");
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "jellyshop.io");
  });

  it("rewrites a shop subdomain to its pages", async () => {
    const response = await proxy(request("https://myshop.jellyshop.io/cart"));
    expect(rewriteOf(response!)).toBe("/sites/myshop/cart");
  });

  it("redirects old /<slug> links and /admin on the main address", async () => {
    const old = await proxy(request("https://jellyshop.io/myshop/products/bed?variant=2"));
    expect(old!.status).toBe(308);
    expect(old!.headers.get("location")).toBe("https://myshop.jellyshop.io/products/bed?variant=2");
    const admin = await proxy(request("https://jellyshop.io/admin/orders"));
    expect(admin!.headers.get("location")).toBe("https://admin.jellyshop.io/orders");
  });

  it("serves the merchant admin on its own host", async () => {
    const response = await proxy(request("https://admin.jellyshop.io/orders"));
    expect(rewriteOf(response!)).toBe("/admin/orders");
  });

  it("shows the not-found page for reserved and unknown hosts", async () => {
    for (const url of ["https://api.jellyshop.io/", "https://shop.example.com/"]) {
      const response = await proxy(request(url));
      expect(rewriteOf(response!)).toBe("/shop-not-found");
      expect(response!.status).toBe(404);
      expect(response!.headers.get("x-robots-tag")).toBe("noindex");
    }
  });

  it("redirects a shop's old address to the same page at its new one", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/api/public/storefronts/old-name")) return new Response("{}", { status: 404 });
      if (url.includes("/api/public/slugs/old-name")) return Response.json({ slug: "new-name" });
      return Response.json({ store: { id: "store-1" } });
    }));
    const response = await proxy(request("https://old-name.jellyshop.io/products/bed?variant=2"));
    expect(response!.status).toBe(308);
    expect(response!.headers.get("location")).toBe("https://new-name.jellyshop.io/products/bed?variant=2");
  });

  it("gives each kind of page its own Content Security Policy", async () => {
    const csp = async (url: string) => (await proxy(request(url)))!.headers.get("content-security-policy") ?? "";
    expect(await csp("https://myshop.jellyshop.io/")).toContain("https://www.youtube-nocookie.com");
    expect(await csp("https://myshop.jellyshop.io/")).not.toContain("js.stripe.com");
    expect(await csp("https://myshop.jellyshop.io/checkout")).toContain("https://js.stripe.com");
    expect(await csp("https://myshop.jellyshop.io/order/abc")).toContain("https://js.stripe.com");
    expect(await csp("https://admin.jellyshop.io/orders")).toContain("frame-src 'self'");
    expect(await csp("https://platform.jellyshop.io/")).toContain("frame-ancestors 'none'");
    expect(await csp("https://jellyshop.io/")).toContain("default-src 'self'");
  });

  it("shows the password page for a protected shop", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/api/public/storefronts/")) return Response.json({ store: { id: "store-1" } });
      return Response.json({ protected: true, unlocked: false });
    }));
    const response = await proxy(request("https://myshop.jellyshop.io/"));
    expect(rewriteOf(response!)).toBe("/store-password/myshop");
    expect(response!.headers.get("cache-control")).toBe("private, no-store");
  });

  it("shows 'temporarily unavailable' (503) on every page of a shop billing has paused, before any password", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/api/public/storefronts/")) return Response.json({ store: { id: "store-1" } });
      return Response.json({ protected: true, unlocked: false, paused: true });
    }));
    const response = await proxy(request("https://myshop.jellyshop.io/products/bed"));
    expect(rewriteOf(response!)).toBe("/shop-paused");
    expect(response!.status).toBe(503);
    expect(response!.headers.get("retry-after")).toBe("3600");
    expect(response!.headers.get("cache-control")).toBe("private, no-store");
  });
});
