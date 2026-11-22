/**
 * The one place that turns a shop page into an address. Every link to a shop page goes through `storePath`, so the
 * address format can change in one place (a test fails if a hand-built `/${slug}/…` link comes back).
 *
 * Today shops live at `/<slug>/...`. Step 4 of docs/plans/2026-11-22-subdomain-tenancy-plan.md moves them to
 * `<slug>.jellyshop.io/...` (base "") and `/_shop/<slug>/...` on previews; that switch belongs in `storeBase` only.
 */

/** The address prefix of a shop's pages ("/myshop" today). Never ends with "/". */
export function storeBase(storeSlug: string): string {
  return `/${encodeURIComponent(storeSlug)}`;
}

/**
 * Address of a page in a shop: `storePath("myshop")` is the home page, `storePath("myshop", "/cart")` the bag.
 * `path` starts with "/" (a query or hash may follow); "" and "/" both mean the home page.
 */
export function storePath(storeSlug: string, path = ""): string {
  const base = storeBase(storeSlug);
  if (!path || path === "/") return base || "/";
  if (path.startsWith("?") || path.startsWith("#")) return `${base || "/"}${path}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** True when `href` already points inside this shop's own address space (so it must not be prefixed again). */
export function isInStore(storeSlug: string, href: string): boolean {
  const base = storeBase(storeSlug);
  return Boolean(base) && (href === base || href.startsWith(`${base}/`) || href.startsWith(`${base}?`) || href.startsWith(`${base}#`));
}
