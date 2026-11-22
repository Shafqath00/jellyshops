/**
 * The one place that turns a shop page into an address. Every link to a shop page goes through `storePath` (or
 * `storeUrl` from another host), so the address format changes here only (a test fails if a hand-built `/${slug}/…`
 * link comes back). Design: docs/plans/2026-11-22-subdomain-tenancy-plan.md.
 *
 * The format is a deployment-wide setting, never read from the request (store pages are cached and shared):
 *   NEXT_PUBLIC_STORE_LINKS = "path"      → jellyshop.io/<slug>/...      (default; today's addresses)
 *                             "subdomain" → <slug>.jellyshop.io/...
 *                             "preview"   → <preview host>/_shop/<slug>/... (Vercel previews: no wildcard there)
 *   NEXT_PUBLIC_ROOT_DOMAIN   = "jellyshop.io" (may carry a port in development, e.g. "localhost:3200")
 */

export type StoreLinkMode = "path" | "subdomain" | "preview";

export const DEFAULT_STORE_ROOT_DOMAIN = "jellyshop.io";

export type StoreLinkSettings = { mode: StoreLinkMode; rootDomain: string };

/** Read once per call so tests can change the environment. `process.env.NEXT_PUBLIC_*` is inlined by Next. */
export function storeLinkSettings(): StoreLinkSettings {
  let mode: string | undefined;
  let root: string | undefined;
  try {
    mode = process.env.NEXT_PUBLIC_STORE_LINKS;
    root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  } catch {
    // No `process` (a plain browser bundle): fall back to the defaults.
  }
  return {
    mode: mode === "subdomain" || mode === "preview" ? mode : "path",
    rootDomain: (root || DEFAULT_STORE_ROOT_DOMAIN).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, ""),
  };
}

/** The address prefix of a shop's pages on its own host: "/myshop", "/_shop/myshop", or "" on a shop subdomain. */
export function storeBase(storeSlug: string, settings: StoreLinkSettings = storeLinkSettings()): string {
  const slug = encodeURIComponent(storeSlug);
  if (settings.mode === "subdomain") return "";
  if (settings.mode === "preview") return `/_shop/${slug}`;
  return `/${slug}`;
}

/**
 * Address of a page in a shop, for links shown on that shop's own pages: `storePath("myshop")` is the home page,
 * `storePath("myshop", "/cart")` the bag. `path` starts with "/" (a query or hash may follow); "" and "/" both mean
 * the home page.
 */
export function storePath(storeSlug: string, path = "", settings: StoreLinkSettings = storeLinkSettings()): string {
  const base = storeBase(storeSlug, settings);
  if (!path || path === "/") return base || "/";
  if (path.startsWith("?") || path.startsWith("#")) return `${base || "/"}${path}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Address of a shop page for links from somewhere else (the admin, emails, canonical links): a full URL on
 * subdomains (`https://myshop.jellyshop.io/cart`), otherwise the same as `storePath`.
 */
export function storeUrl(storeSlug: string, path = "", settings: StoreLinkSettings = storeLinkSettings()): string {
  const local = storePath(storeSlug, path, settings);
  if (settings.mode !== "subdomain") return local;
  const scheme = /^(localhost|127\.0\.0\.1)(:|$)/.test(settings.rootDomain) || settings.rootDomain.endsWith(".localhost") ? "http" : "https";
  return `${scheme}://${encodeURIComponent(storeSlug)}.${settings.rootDomain}${local === "/" ? "" : local}`;
}

/** True when `href` already points inside this shop's own address space (so it must not be prefixed again). */
export function isInStore(storeSlug: string, href: string, settings: StoreLinkSettings = storeLinkSettings()): boolean {
  const base = storeBase(storeSlug, settings);
  return Boolean(base) && (href === base || href.startsWith(`${base}/`) || href.startsWith(`${base}?`) || href.startsWith(`${base}#`));
}

/**
 * The page's path inside the shop ("/products/bed"), from whatever the router reports: the rewritten route
 * (`/sites/<slug>/...`, seen while rendering on the server), the address with a shop prefix (`/<slug>/...`,
 * `/_shop/<slug>/...`) or a subdomain address (`/...`). The same answer on server and browser avoids hydration
 * mismatches.
 */
export function storePagePath(storeSlug: string, pathname: string): string {
  const slug = encodeURIComponent(storeSlug);
  for (const prefix of [`/sites/${slug}`, `/_shop/${slug}`, `/${slug}`]) {
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return pathname || "/";
}

/** The Jellyshop home page: the main address on subdomain deployments (shops live elsewhere), "/" otherwise. */
export function jellyshopHomeUrl(settings: StoreLinkSettings = storeLinkSettings()): string {
  if (settings.mode !== "subdomain") return "/";
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(settings.rootDomain);
  return `${local ? "http" : "https"}://${settings.rootDomain}`;
}
