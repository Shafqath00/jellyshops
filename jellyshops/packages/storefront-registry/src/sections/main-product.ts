import { z } from "zod";
import type { BlockDefinition, SectionDefinition } from "../types.js";

/**
 * Main product: one section that owns the product page's two columns, like Shopify's main product
 * section. The photos are the section's own (the Product images settings); the buying column is a list
 * of blocks, one per product part. Moving, hiding or restyling a part cannot break the layout, because
 * the columns are the section's markup, not CSS guessing which sections sit next to each other.
 */

import { PRODUCT_PART_SECTIONS, partBlockType, type ProductPartSection } from "../parts.js";

export { PART_BLOCK_PREFIX, PRODUCT_PART_SECTIONS, partBlockType, partSectionType, type ProductPartSection } from "../parts.js";

/** A part block has the same settings (and child blocks) as the section it stands for, without the section-wide styling. */
export function productPartBlocks(sections: SectionDefinition[]): BlockDefinition[] {
  return PRODUCT_PART_SECTIONS.flatMap((type) => {
    const section = sections.find((candidate) => candidate.type === type);
    if (!section) return [];
    return [{
      type: partBlockType(type),
      // Parts need the product being shown: only Main product's buying column takes "@product" blocks.
      sets: ["@product"],
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
    // One buying area per product page.
    limit: 1,
    settingsSchema: z.intersection(gallery.settingsSchema, layoutSchema),
    controls: [
      { type: "segmented", key: "mediaPosition", label: "Photos", group: "layout", options: [{ label: "On the left", value: "left" }, { label: "On the right", value: "right" }] },
      { type: "segmented", key: "mediaWidth", label: "Photo column", group: "layout", description: "How much of the width the photos take on large screens.", options: [{ label: "Narrow", value: "narrow" }, { label: "Half", value: "medium" }, { label: "Wide", value: "wide" }] },
      { type: "select", key: "stickyColumn", label: "Keep in view while scrolling", group: "layout", options: [{ label: "Photos", value: "media" }, { label: "Buying details", value: "details" }, { label: "Neither", value: "none" }] },
      // The page arrangement is this section's own job, so the older page layout picker is left out.
      ...gallery.controls.filter((control) => control.key !== "pageLayout"),
    ],
    // The buying column takes every product block (parts, breadcrumbs, delivery estimate…) and the whole shared
    // content library (text, accordion, icons, share links…), so any layout of the buying details can be built.
    allowedBlockTypes: ["@product", "@content", "@app"],
    maxBlocks: 30,
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
