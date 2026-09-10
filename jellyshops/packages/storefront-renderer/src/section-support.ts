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
  "spacer-divider",
  "spacer",
  "divider",
]);

export function isRenderableHomeSection(type: string): boolean {
  return renderableHomeSectionTypes.has(type);
}
