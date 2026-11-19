/** Main product parts (`part-<section type>` blocks), without zod: store pages use these. */
/** Product sections that can sit in the buying column, as blocks named `part-<section type>`. */
export const PRODUCT_PART_SECTIONS = [
  "rating-summary",
  "product-information",
  "product-options",
  "product-purchase",
  "product-stock-counter",
  "trust-strip",
  "product-description",
  "product-tabs",
  "product-specifications",
  "product-dimensions",
  "product-reviews",
] as const;

export type ProductPartSection = typeof PRODUCT_PART_SECTIONS[number];
export const PART_BLOCK_PREFIX = "part-";
export const partBlockType = (sectionType: ProductPartSection | string) => `${PART_BLOCK_PREFIX}${sectionType}`;
/** The product section a part block draws, or undefined for other blocks. */
export function partSectionType(blockType: string): ProductPartSection | undefined {
  if (!blockType.startsWith(PART_BLOCK_PREFIX)) return undefined;
  const type = blockType.slice(PART_BLOCK_PREFIX.length);
  return (PRODUCT_PART_SECTIONS as readonly string[]).includes(type) ? type as ProductPartSection : undefined;
}
