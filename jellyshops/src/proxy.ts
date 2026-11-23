import { NextResponse, type NextRequest } from "next/server";
import { storeLinkSettings, storeUrl } from "@jelly/storefront-schema";
import { decideStoreAccess } from "@/features/storefront-access/access-gate";
import { classifyHost, type HostRoute } from "@/lib/hosts";
import { contentSecurityPolicy, securityHeaderOptionsFromEnv, type PageKind } from "@/lib/security-headers";

/**
 * Runs before every page. Two jobs, each in its own module (Next allows one proxy file):
 *
 * 1. Where a request belongs (`lib/hosts.ts`): marketing site, a shop (`<slug>.jellyshop.io`, or `/<slug>` while
 *    NEXT_PUBLIC_STORE_LINKS is "path"), the merchant admin host, the platform host. Shops are rewritten to
 *    `/sites/<slug>/...`; nothing here looks the shop up, the store layout does that (cached).
 * 2. The storefront password (`features/storefront-access/access-gate.ts`) for shop pages only.
 *
 * Design: docs/plans/2026-11-22-subdomain-tenancy-plan.md §2.
 */
const NOT_FOUND_PAGE = "/shop-not-found";
const PAUSED_PAGE = "/shop-paused";

function protocolOf(request: NextRequest): "http" | "https" {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const value = forwarded || request.nextUrl.protocol.replace(":", "");
  return value === "http" ? "http" : "https";
}

function rewrite(request: NextRequest, pathname: string, init?: { status?: number }) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.rewrite(url, init);
}

export async function proxy(request: NextRequest) {
  const settings = storeLinkSettings();
  const route: HostRoute = classifyHost({
    host: request.headers.get("host"),
    path: request.nextUrl.pathname,
    search: request.nextUrl.search,
    protocol: protocolOf(request),
    rootDomain: settings.rootDomain.replace(/:\d+$/, ""),
    storeLinks: settings.mode,
  });

  const response = await routeResponse(request, route);
  if (route.kind !== "redirect") response.headers.set("Content-Security-Policy", contentSecurityPolicy(pageKind(route, request.nextUrl.pathname), securityHeaderOptionsFromEnv()));
  return response;
}

/** Which policy a page gets (lib/security-headers.ts). */
export function pageKind(route: HostRoute, pathname: string): PageKind {
  if (route.kind === "platform-admin") return "platform";
  if (route.kind === "merchant-admin" || pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (route.kind === "shop") return /^\/sites\/[^/]+\/(checkout|order)(\/|$)/.test(route.path) ? "checkout" : "shop";
  return "marketing";
}

async function routeResponse(request: NextRequest, route: HostRoute): Promise<NextResponse> {
  switch (route.kind) {
    case "marketing":
    case "pass":
      return NextResponse.next();
    case "redirect":
      return NextResponse.redirect(route.location, 308);
    case "merchant-admin":
    case "platform-admin":
      return rewrite(request, route.path);
    case "shop":
      return shopResponse(request, route.slug, route.path);
    case "shop-not-found":
    case "custom-domain":
    case "not-found": {
      const response = rewrite(request, NOT_FOUND_PAGE, { status: 404 });
      response.headers.set("X-Robots-Tag", "noindex");
      return response;
    }
  }
}

async function shopResponse(request: NextRequest, slug: string, pathname: string) {
  const origin = (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
  const decision = await decideStoreAccess(`/${slug}`, (name) => request.cookies.get(name)?.value, { origin });
  if (decision.kind === "moved") {
    // The shop changed its address: the same page at the new one, for good (old links, bookmarks, emails).
    const page = pathname.slice(`/sites/${slug}`.length) || "/";
    return NextResponse.redirect(new URL(storeUrl(decision.slug, page) + request.nextUrl.search, request.url), 308);
  }
  if (decision.kind === "paused") {
    // Billing paused the shop: every page shows "temporarily unavailable". 503 with Retry-After tells search engines
    // it is temporary, so the shop keeps its place in search results.
    const response = rewrite(request, PAUSED_PAGE, { status: 503 });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Retry-After", "3600");
    return response;
  }
  if (decision.kind === "password") {
    const response = rewrite(request, `/store-password/${decision.slug}`);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const response = rewrite(request, pathname);
  // An unlocked visit to a protected store must never be kept by a shared cache.
  if (decision.kind === "pass-private") response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Every page and route, but not Next's built files or image optimiser (those never belong to one host).
  matcher: ["/((?!_next/static|_next/image).*)"],
};
