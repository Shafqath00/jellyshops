import type { SectionGroupName } from "./types.js";

/**
 * Section types a merchant may add to the header and footer groups (theme plan T6), on top of the header,
 * announcement and footer themselves. Sections that need a page's own data (a product, a collection's products, a
 * search) stay out: a group is drawn on every page. Types that are not registered are ignored.
 */
export const GROUP_SECTION_TYPES: Readonly<Record<"header" | "footer", readonly string[]>> = {
  header: ["announcement-bar", "custom-content", "rich-text", "trust-strip", "logo-list"],
  footer: [
    "custom-content", "rich-text", "newsletter", "multicolumn", "image-with-text", "image-banner", "logo-list", "trust-strip",
    "testimonials", "faq", "contact-store-info", "product-grid", "featured-collection", "recently-viewed", "collection-list", "category-grid",
  ],
};

/** The groups a section type joins because it is listed above. */
export function extraGroupsFor(type: string): SectionGroupName[] {
  return (Object.keys(GROUP_SECTION_TYPES) as Array<"header" | "footer">).filter((group) => GROUP_SECTION_TYPES[group].includes(type));
}
