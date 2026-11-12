import { z } from "zod";
import type { BlockDefinition, SectionDefinition } from "../types.js";

/**
 * Main product: one section that owns the product page's two columns, like Shopify's main product
 * section. The photos are the section's own (the Product images settings); the buying column is a list
 * of blocks, one per product part. Moving, hiding or restyling a part cannot break the layout, because
 * the columns are the section's markup, not CSS guessing which sections sit next to each other.
 */

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

/** A part block has the same settings (and child blocks) as the section it stands for, without the section-wide styling. */
export function productPartBlocks(sections: SectionDefinition[]): BlockDefinition[] {
  return PRODUCT_PART_SECTIONS.flatMap((type) => {
    const section = sections.find((candidate) => candidate.type === type);
    if (!section) return [];
    return [{
      type: partBlockType(type),
      settingsSchema: section.settingsSchema,
      controls: section.controls,
      defaultSettings: structuredClone(section.defaultSettings),
      ...(section.allowedBlockTypes.length ? { allowedBlockTypes: [...section.allowedBlockTypes], defaultBlocks: structuredClone(section.defaultBlocks) } : {}),
      ...(section.maxBlocks !== undefined ? { maxBlocks: section.maxBlocks } : {}),
    }];
  });
}

const layoutSchema = z.object({
  mediaPosition: z.enum(["left", "right"]).optional(),
  mediaWidth: z.enum(["narrow", "medium", "wide"]).optional(),
  stickyColumn: z.enum(["media", "details", "none"]).optional(),
});

/** Main product from the Product images section: its photo settings plus the column layout. */
export function mainProductSection(sections: SectionDefinition[]): SectionDefinition {
  const gallery = sections.find((candidate) => candidate.type === "product-gallery");
  if (!gallery) throw new Error("Main product needs the Product images section.");
  return {
    type: "main-product",
    category: "commerce",
    supportedPages: ["product"],
    settingsSchema: z.intersection(gallery.settingsSchema, layoutSchema),
    controls: [
      { type: "segmented", key: "mediaPosition", label: "Photos", group: "layout", options: [{ label: "On the left", value: "left" }, { label: "On the right", value: "right" }] },
      { type: "segmented", key: "mediaWidth", label: "Photo column", group: "layout", description: "How much of the width the photos take on large screens.", options: [{ label: "Narrow", value: "narrow" }, { label: "Half", value: "medium" }, { label: "Wide", value: "wide" }] },
      { type: "select", key: "stickyColumn", label: "Keep in view while scrolling", group: "layout", options: [{ label: "Photos", value: "media" }, { label: "Buying details", value: "details" }, { label: "Neither", value: "none" }] },
      // The page arrangement is this section's own job, so the older page layout picker is left out.
      ...gallery.controls.filter((control) => control.key !== "pageLayout"),
    ],
    allowedBlockTypes: PRODUCT_PART_SECTIONS.filter((type) => sections.some((candidate) => candidate.type === type)).map(partBlockType),
    maxBlocks: 16,
    defaultSettings: { ...structuredClone(gallery.defaultSettings), mediaPosition: "left", mediaWidth: "medium", stickyColumn: "media" },
    defaultBlocks: [
      { id: "main-product-information", type: partBlockType("product-information"), enabled: true, settings: {} },
      { id: "main-product-options", type: partBlockType("product-options"), enabled: true, settings: {} },
      { id: "main-product-purchase", type: partBlockType("product-purchase"), enabled: true, settings: {} },
      { id: "main-product-description", type: partBlockType("product-description"), enabled: true, settings: { layout: "expandable", startOpen: true } },
    ],
    responsiveFields: [],
  };
}
