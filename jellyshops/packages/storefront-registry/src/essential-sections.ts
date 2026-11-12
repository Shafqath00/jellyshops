import type { BlockNode, PageType, SectionNode } from "@jelly/storefront-schema";
import { sectionLabel } from "./labels.js";

/**
 * Every page needs the section that makes it work: a collection page its product grid, the bag its
 * bag section, a product page a way to buy. Like Shopify's main sections, these cannot be deleted
 * or hidden, so a merchant can never break a page by accident. Any one listed section is enough
 * (two product grids on a collection page: either can go).
 */
const ESSENTIAL: Partial<Record<PageType, { sections: string[]; what: string }>> = {
  product: { sections: ["main-product", "product-purchase"], what: "a way to add the product to the bag" },
  collection: { sections: ["collection-product-grid"], what: "its product grid" },
  search: { sections: ["search-results"], what: "its search results" },
  cart: { sections: ["cart-summary"], what: "its bag section" },
  page: { sections: ["page-content"], what: "its page content" },
  blog: { sections: ["article-list"], what: "its list of posts" },
  article: { sections: ["article-content"], what: "the post itself" },
};

const PURCHASE_PART = "part-product-purchase";

function hasPurchasePart(blocks: BlockNode[] | undefined): boolean {
  return (blocks ?? []).some((block) => block.enabled !== false && (block.type === PURCHASE_PART || hasPurchasePart(block.blocks)));
}

/** Whether this section keeps the page working (Main product only while it still has an Add to cart part). */
function isEssential(pageType: PageType, section: SectionNode): boolean {
  const rule = ESSENTIAL[pageType];
  if (!rule || section.enabled === false || !rule.sections.includes(section.type)) return false;
  return section.type === "main-product" ? hasPurchasePart(section.blocks) : true;
}

/** Why the page no longer works with these sections, or null when it does. Hidden sections do not count. */
export function essentialSectionsProblem(pageType: PageType, sections: SectionNode[]): string | null {
  const rule = ESSENTIAL[pageType];
  if (!rule || sections.some((section) => isEssential(pageType, section))) return null;
  return `This page needs ${rule.what} to work, so it can't be deleted or hidden.`;
}

/** True when the change takes a working page to a broken one (a page that was already missing it may still be edited). */
export function breaksEssentialSections(pageType: PageType, before: SectionNode[], after: SectionNode[]): string | null {
  if (essentialSectionsProblem(pageType, before)) return null;
  return essentialSectionsProblem(pageType, after);
}

/** The section types that keep a page working, for the editor to explain what it protects. */
export function essentialSectionLabels(pageType: PageType): string[] {
  return (ESSENTIAL[pageType]?.sections ?? []).map((type) => sectionLabel(type));
}
