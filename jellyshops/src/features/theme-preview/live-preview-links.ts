/**
 * The home page's live template previews draw a whole sample store in one page (live-store-preview.tsx).
 * A click on a store link opens the matching sample page instead of leaving the preview.
 */
export const LIVE_PAGES = ["home", "collection", "product", "cart", "checkout", "search", "page"] as const;
export type LivePage = (typeof LIVE_PAGES)[number];

export const LIVE_PAGE_LABELS: Record<LivePage, string> = {
  home: "Home", collection: "Shop", product: "Product", cart: "Bag", checkout: "Checkout", search: "Search", page: "About",
};

export function isLivePage(value: unknown): value is LivePage {
  return typeof value === "string" && (LIVE_PAGES as readonly string[]).includes(value);
}

/** The message the preview and the page around it exchange (same origin only). */
export const LIVE_PREVIEW_MESSAGE = "jelly-live-preview";
export type LivePreviewMessage =
  | { type: typeof LIVE_PREVIEW_MESSAGE; kind: "at"; page: LivePage }
  | { type: typeof LIVE_PREVIEW_MESSAGE; kind: "go"; page: LivePage };

/**
 * Which sample page a link opens. `href` is the link's own attribute; `inProductCard` says the link is a product card
 * (sample cards link to "#"). Returns null for links that should do nothing (other sites, "#" on its own).
 */
export function pageForLink(href: string | null, inProductCard: boolean, storeSlug = "preview"): LivePage | null {
  if (inProductCard) return "product";
  if (!href) return null;
  if (/^(mailto|tel|javascript):/i.test(href)) return null;
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      if (typeof window === "undefined" || url.origin !== window.location.origin) return null;
      href = url.pathname + url.hash;
    } catch { return null; }
  }
  const hash = href.startsWith("#") ? href.slice(1).toLowerCase() : "";
  if (hash) {
    if (hash === "checkout") return "checkout";
    if (hash === "shop" || hash === "compare") return "collection";
    if (hash === "search") return "search";
    if (hash === "cart" || hash === "bag") return "cart";
    return null;
  }
  if (href === "#") return null;
  const path = href.split(/[?#]/)[0].replace(/\/+$/, "");
  const rest = path.replace(new RegExp(`^/(?:sites/|_shop/)?${storeSlug}(?=/|$)`), "") || "/";
  if (rest === "/" || rest === "") return "home";
  const first = rest.split("/")[1];
  if (first === "products") return "product";
  if (first === "collections" || first === "shop" || first === "compare") return "collection";
  if (first === "cart" || first === "bag") return "cart";
  if (first === "checkout") return "checkout";
  if (first === "search") return "search";
  return "page";
}
