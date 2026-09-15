export const renderableHomeSectionTypes: ReadonlySet<string> = new Set([
  "announcement-bar",
  "header",
  "footer",
  "hero",
  "rich-text",
  "product-grid",
  "featured-collection",
  "image-with-text",
  "image-text",
  "multicolumn",
  "newsletter",
  "category-grid",
  "testimonials",
  "trust-strip",
  "image-mosaic",
  "journal-teaser",
  "cart-summary",
  "search-results",
  "not-found-message",
  "spacer-divider",
  "spacer",
  "divider",
]);

export function isRenderableHomeSection(type: string): boolean {
  return renderableHomeSectionTypes.has(type);
}
