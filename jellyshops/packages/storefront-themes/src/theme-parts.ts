/**
 * Named parts: the renderer class names a theme's CSS may style. The renderer promises to keep each one (a test
 * fails if one disappears from the markup), so a theme built on parts and `--j-*` tokens survives renderer changes.
 * Anything else a theme styles is an internal class: allowed only where the theme already used it
 * (`theme-css-internals.baseline.json`), never in new themes. Prefer tokens and section settings; add a class here
 * only when themes genuinely need it, and keep it in the markup from then on. Data hooks are parts too:
 * `[data-part]` (Main product parts), `[data-card-part]` (product card parts), `[data-section-type]`, `[data-layout]`,
 * `[data-scheme]`, `[data-section-frame]`.
 */
export const THEME_PART_GROUPS: ReadonlyArray<{ group: string; parts: readonly string[] }> = [
  { group: "Section roots and shared pieces", parts: [
    "jelly-section-header", "jelly-icon", "jelly-image-block", "jelly-main-product",
    "jelly-product-part", "jelly-product-grid", "jelly-product-reviews", "jelly-product-dimensions",
    "jelly-rating-summary", "jelly-cart-summary", "jelly-order-confirmation",
  ] },
  { group: "Page and section frame", parts: [
    "jelly-block-group", "jelly-breadcrumb", "jelly-button", "jelly-button--link",
    "jelly-button--secondary", "jelly-container", "jelly-custom-content-inner", "jelly-empty-state",
    "jelly-eyebrow", "jelly-not-found", "jelly-page-content", "jelly-prose",
    "jelly-section", "jelly-section-actions", "jelly-section-intro",
  ] },
  { group: "Announcement, header and menus", parts: [
    "jelly-announcement", "jelly-header", "jelly-header-brand", "jelly-header-search",
    "jelly-header-tool-label", "jelly-header-tools", "jelly-menu", "jelly-mobile-navigation",
    "jelly-mobile-navigation-panel",
  ] },
  { group: "Footer and newsletter", parts: [
    "jelly-footer", "jelly-footer-brand", "jelly-footer-column", "jelly-footer-contact",
    "jelly-footer-credit", "jelly-footer-inner", "jelly-footer-links", "jelly-newsletter",
    "jelly-newsletter-note",
  ] },
  { group: "Hero, slideshow, banners and stories", parts: [
    "jelly-hero", "jelly-hero-actions", "jelly-hero-content", "jelly-hero-media",
    "jelly-hero-overlay", "jelly-image-banner", "jelly-image-text", "jelly-image-text-content",
    "jelly-image-text-layout", "jelly-image-text-media", "jelly-slideshow",
  ] },
  { group: "Content sections", parts: [
    "jelly-category-card", "jelly-category-card-media", "jelly-category-grid", "jelly-category-grid-items",
    "jelly-faq", "jelly-faq-list", "jelly-multicolumn", "jelly-multicolumn-grid",
    "jelly-testimonial-grid", "jelly-trust-strip",
  ] },
  { group: "Product cards and product lists", parts: [
    "jelly-collection-count", "jelly-collection-header", "jelly-collection-header-copy", "jelly-collection-header-image",
    "jelly-collection-product-grid", "jelly-list-browser", "jelly-list-check", "jelly-list-count",
    "jelly-list-filter-toggle", "jelly-list-filters", "jelly-list-price", "jelly-list-sort",
    "jelly-list-toolbar", "jelly-product-card", "jelly-product-card-badge", "jelly-product-card-body",
    "jelly-product-card-media", "jelly-product-card-price", "jelly-product-card-swatches", "jelly-product-grid-items",
    "jelly-related-products", "jelly-search-results", "jelly-search-shell", "jelly-search-status",
  ] },
  { group: "Product page", parts: [
    "jelly-product-description", "jelly-product-details", "jelly-product-gallery", "jelly-product-gallery-item",
    "jelly-product-information", "jelly-product-option-values", "jelly-product-options", "jelly-product-price",
    "jelly-product-purchase", "jelly-product-shipping", "jelly-product-sku", "jelly-product-tabs-section",
    "jelly-purchase-actions", "jelly-quantity", "jelly-quantity-stepper", "jelly-specifications",
    "jelly-specifications-list", "jelly-sticky-purchase",
  ] },
  { group: "Bag and order", parts: [
    "jelly-cart-header", "jelly-cart-layout", "jelly-cart-line", "jelly-cart-line-controls",
    "jelly-cart-line-details", "jelly-cart-line-media", "jelly-cart-line-total", "jelly-cart-totals",
    "jelly-order-confirmation-summary",
  ] },
];

/** Every named part class, for checks. */
export const THEME_PARTS: ReadonlySet<string> = new Set(THEME_PART_GROUPS.flatMap((entry) => entry.parts));

/** The renderer classes (`.jelly-…`) a stylesheet uses. */
export function themeCssClasses(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...new Set(withoutComments.match(/\.jelly-[a-z0-9-]+/g) ?? [])].map((name) => name.slice(1)).sort();
}

/** The classes a stylesheet uses that are not named parts (renderer internals). */
export function themeCssInternals(css: string): string[] {
  return themeCssClasses(css).filter((name) => !THEME_PARTS.has(name));
}
