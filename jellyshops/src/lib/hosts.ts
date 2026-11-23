/**
 * Works out what a request is for from its host name and path. Pure: no network, no environment reads, so the proxy
 * can call it on every request and tests can cover every case. Design: docs/plans/2026-11-22-subdomain-tenancy-plan.md
 * (§2, with the owner decisions at the top: the merchant admin is on its own host, the super-admin on `platform.`).
 *
 * Used by `src/proxy.ts`. `storeLinks` follows NEXT_PUBLIC_STORE_LINKS (see storefront-schema `store-links.ts`):
 * "path" keeps today's jellyshop.io/<slug>/... addresses, "subdomain" moves shops to <slug>.<root>, "preview" uses
 * /_shop/<slug>/... on any host.
 */

import { isSystemStoreAddress } from "@jelly/storefront-schema";

export const DEFAULT_ROOT_DOMAIN = "jellyshop.io";
/** Merchant admin for every shop: `admin.<root>`. */
export const MERCHANT_ADMIN_LABEL = "admin";
/** Platform super-admin: `platform.<root>`. */
export const PLATFORM_ADMIN_LABEL = "platform";
/** Local development root: `myshop.localhost:3000`. */
export const DEV_ROOT_DOMAIN = "localhost";
/** Preview deployments use path mode: `<preview>.vercel.app/_shop/<slug>/...`. */
export const PREVIEW_SHOP_PREFIX = "_shop";

/**
 * Subdomains that never belong to a shop: the platform's own names from the shared address rules. Brand and offensive
 * names are only refused when a shop is created or renamed, so an existing shop is never cut off by a list change.
 */
const SYSTEM_SUBDOMAINS = { has: isSystemStoreAddress };

/**
 * First path segments on the marketing site that are the app's own pages or public files, not old `/<slug>` store
 * links. A test keeps this in step with `src/app` and `public`.
 */
export const APEX_PATH_SEGMENTS: ReadonlySet<string> = new Set([
  // src/app
  "_home", "admin", "api", "auth", "changelog", "home-fonts", "login", "onboarding", "signup", "store-password",
  "theme-preview", "themes",
  // public
  "assets", "brand", "images", "logos", "templates",
  // Next and platform
  "_next", "sites", "platform-admin", "shop-not-found", "shop-paused", PREVIEW_SHOP_PREFIX,
]);

/** Folders that may only be reached through a rewrite from this module, never by typing the path. */
const INTERNAL_SEGMENTS = new Set(["sites", "platform-admin", "shop-not-found", "shop-paused"]);

/** Paths every host serves as they are: Next's files, the API routes, shared theme files. */
const SHARED_SEGMENTS = new Set(["_next", "api", "themes"]);

/** Paths the merchant admin host serves as they are (sign-in lives there). */
const ADMIN_HOST_SEGMENTS = new Set(["admin", "login", "signup", "auth", "onboarding"]);

const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type HostRoute =
  /** Marketing site; serve the path as it is. */
  | { kind: "marketing" }
  /** Serve the path as it is (Next files, API, shared assets). */
  | { kind: "pass" }
  /** Permanent redirect (308) to `location`, a full URL. */
  | { kind: "redirect"; location: string }
  /** Rewrite to `path` (merchant admin pages). */
  | { kind: "merchant-admin"; path: string }
  /** Rewrite to `path` (platform super-admin pages). */
  | { kind: "platform-admin"; path: string }
  /** Rewrite to `path` = `/sites/<slug>/...`. */
  | { kind: "shop"; slug: string; path: string; mode: "subdomain" | "path" }
  /** Unknown, reserved or malformed shop address: the friendly 404 page. */
  | { kind: "shop-not-found" }
  /** A host that is not ours (a merchant's own domain, later). */
  | { kind: "custom-domain"; hostname: string }
  /** A request straight to an internal folder: plain 404. */
  | { kind: "not-found" };

export type HostRequest = {
  /** The `Host` header as sent (any case, may carry a port or a trailing dot). */
  host: string | null | undefined;
  /** URL path, starting with `/`. */
  path: string;
  /** Query string including the leading `?`, or empty. Kept on redirects. */
  search?: string;
  /** `http` or `https`; used for redirects. Defaults to `https`. */
  protocol?: "http" | "https";
  rootDomain?: string;
  /** How shop links are built on this deployment. Defaults to "subdomain" (the target layout). */
  storeLinks?: "path" | "subdomain" | "preview";
};

export type ParsedHost = { hostname: string; port: string };

/** Lower-cases, trims, removes a trailing dot and splits off the port. IPv6 stays in brackets. */
export function parseHost(host: string | null | undefined): ParsedHost {
  const value = (host ?? "").trim().toLowerCase();
  if (!value) return { hostname: "", port: "" };
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    const hostname = end === -1 ? value : value.slice(0, end + 1);
    const rest = end === -1 ? "" : value.slice(end + 1);
    return { hostname, port: rest.startsWith(":") ? rest.slice(1) : "" };
  }
  const colon = value.lastIndexOf(":");
  const hostname = colon === -1 ? value : value.slice(0, colon);
  const port = colon === -1 ? "" : value.slice(colon + 1);
  return { hostname: hostname.replace(/\.+$/, ""), port };
}

/** True for a label shaped like a shop address (3 to 63 characters, lowercase letters, digits, single hyphens). */
export function isShopLabel(label: string): boolean {
  return label.length >= 3 && label.length <= 63 && SLUG_SHAPE.test(label) && !label.startsWith("xn--");
}

function isIpAddress(hostname: string): boolean {
  return hostname.startsWith("[") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function firstSegment(path: string): string {
  return path.split("/")[1] ?? "";
}

/** The path after the first segment, always starting with `/`. */
function afterFirstSegment(path: string): string {
  const rest = path.slice(1 + firstSegment(path).length);
  return rest.startsWith("/") ? rest : `/${rest}`;
}

function hasFileExtension(path: string): boolean {
  const last = path.split("/").pop() ?? "";
  return /\.[a-z0-9]+$/i.test(last);
}

function shopPath(slug: string, path: string): string {
  return path === "/" || path === "" ? `/sites/${slug}` : `/sites/${slug}${path}`;
}

/** Decides what to do with a request. See the tree in §2 of the tenancy plan. */
export function classifyHost(request: HostRequest): HostRoute {
  const root = (request.rootDomain ?? DEFAULT_ROOT_DOMAIN).toLowerCase();
  const path = request.path.startsWith("/") ? request.path : `/${request.path}`;
  const search = request.search ?? "";
  const scheme = request.protocol ?? "https";
  const { hostname, port } = parseHost(request.host);
  const portPart = port ? `:${port}` : "";
  const segment = firstSegment(path);

  if (INTERNAL_SEGMENTS.has(segment)) return { kind: "not-found" };
  if (!hostname || isIpAddress(hostname)) return { kind: "marketing" };

  let base: string | null = null;
  if (hostname === root || hostname.endsWith(`.${root}`)) base = root;
  else if (hostname === DEV_ROOT_DOMAIN || hostname.endsWith(`.${DEV_ROOT_DOMAIN}`)) base = DEV_ROOT_DOMAIN;

  if (base === null) {
    if (hostname.endsWith(".vercel.app")) return classifyPreview(path) ?? { kind: "marketing" };
    return { kind: "custom-domain", hostname };
  }

  const label = hostname === base ? "" : hostname.slice(0, -(base.length + 1));
  const origin = (sub: string) => `${scheme}://${sub ? `${sub}.` : ""}${base}${portPart}`;

  if (label === "") return classifyApex(path, search, segment, origin, request.storeLinks ?? "subdomain");
  if (label === "www") return { kind: "redirect", location: `${origin("")}${path}${search}` };
  if (label.includes(".")) return { kind: "shop-not-found" };

  if (label === MERCHANT_ADMIN_LABEL) {
    if (SHARED_SEGMENTS.has(segment) || ADMIN_HOST_SEGMENTS.has(segment) || hasFileExtension(path)) return { kind: "pass" };
    return { kind: "merchant-admin", path: path === "/" ? "/admin" : `/admin${path}` };
  }
  if (label === PLATFORM_ADMIN_LABEL) {
    if (SHARED_SEGMENTS.has(segment) || hasFileExtension(path)) return { kind: "pass" };
    return { kind: "platform-admin", path: path === "/" ? "/platform-admin" : `/platform-admin${path}` };
  }
  if (SYSTEM_SUBDOMAINS.has(label) || !isShopLabel(label)) return { kind: "shop-not-found" };

  if (SHARED_SEGMENTS.has(segment) || hasFileExtension(path)) return { kind: "pass" };
  // Old-style links that still carry the shop's own address: /<slug>/x on <slug>.<root> → /x.
  if (segment === label) return { kind: "redirect", location: `${origin(label)}${afterFirstSegment(path)}${search}` };
  return { kind: "shop", slug: label, path: shopPath(label, path), mode: "subdomain" };
}

function classifyApex(path: string, search: string, segment: string, origin: (sub: string) => string, links: "path" | "subdomain" | "preview"): HostRoute {
  const preview = classifyPreview(path);
  if (preview) return preview;
  if (links !== "subdomain") {
    // Shops still live under the main address: serve them there (path) or send old links to /_shop (preview).
    if (segment === "" || APEX_PATH_SEGMENTS.has(segment) || hasFileExtension(path) || !isShopLabel(segment) || SYSTEM_SUBDOMAINS.has(segment)) return { kind: "marketing" };
    const rest = afterFirstSegment(path);
    if (links === "preview") return { kind: "redirect", location: `${origin("")}/${PREVIEW_SHOP_PREFIX}/${segment}${rest === "/" ? "" : rest}${search}` };
    if (SHARED_SEGMENTS.has(firstSegment(rest))) return { kind: "pass" };
    return { kind: "shop", slug: segment, path: shopPath(segment, rest), mode: "path" };
  }
  if (segment === "admin") {
    return { kind: "redirect", location: `${origin(MERCHANT_ADMIN_LABEL)}${afterFirstSegment(path)}${search}` };
  }
  if (segment === "" || APEX_PATH_SEGMENTS.has(segment) || hasFileExtension(path)) return { kind: "marketing" };
  // Today's store links are jellyshop.io/<slug>/...: send them to the shop's own address.
  if (isShopLabel(segment) && !SYSTEM_SUBDOMAINS.has(segment)) {
    return { kind: "redirect", location: `${origin(segment)}${afterFirstSegment(path)}${search}` };
  }
  return { kind: "marketing" };
}

/** `/_shop/<slug>/...` (preview addresses); null when the path is not one. */
function classifyPreview(path: string): HostRoute | null {
  const segment = firstSegment(path);
  if (segment !== PREVIEW_SHOP_PREFIX) return null;
  const rest = afterFirstSegment(path);
  const slug = firstSegment(rest);
  if (!isShopLabel(slug) || SYSTEM_SUBDOMAINS.has(slug)) return { kind: "shop-not-found" };
  const inner = afterFirstSegment(rest);
  if (SHARED_SEGMENTS.has(firstSegment(inner))) return { kind: "pass" };
  return { kind: "shop", slug, path: shopPath(slug, inner), mode: "path" };
}
