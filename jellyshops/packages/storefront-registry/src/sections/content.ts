import { z } from "zod";
import type { DynamicValueType } from "@jelly/storefront-schema";
import type { SectionDefinition } from "../types";

const home = ["home"] as const;
const empty = z.object({}).passthrough();
const stringTypes = ["string", "text"] satisfies DynamicValueType[];
const richTextTypes = ["rich_text", "string", "text"] satisfies DynamicValueType[];
const imageTypes = ["image"] satisfies DynamicValueType[];
const productTypes = ["product_reference"] satisfies DynamicValueType[];
const collectionTypes = ["collection_reference"] satisfies DynamicValueType[];
const urlTypes = ["url"] satisfies DynamicValueType[];
const contentAlignment = [{ type: "segmented" as const, key: "contentAlignment", label: "Content alignment", group: "layout" as const, responsive: true, options: ["left", "center", "right"].map((value) => ({ label: value, value })) }];
const comprehensiveControls = [
  { type: "text" as const, key: "eyebrow", label: "Eyebrow", group: "content" as const, maxLength: 80, dynamicTypes: stringTypes },
  { type: "textarea" as const, key: "summary", label: "Summary", group: "content" as const, maxLength: 500, dynamicTypes: stringTypes },
  { type: "rich-text" as const, key: "body", label: "Body", group: "content" as const, maxLength: 4000, dynamicTypes: richTextTypes },
  { type: "number" as const, key: "columns", label: "Columns", group: "layout" as const, min: 1, max: 6, step: 1 },
  { type: "range" as const, key: "overlay", label: "Overlay", group: "style" as const, min: 0, max: 100, step: 5, unit: "%" },
  { type: "select" as const, key: "layout", label: "Layout", group: "layout" as const, options: [{ label: "Full", value: "full" }] },
  ...contentAlignment,
  { type: "checkbox" as const, key: "fullBleed", label: "Full bleed", group: "layout" as const },
  { type: "color" as const, key: "background", label: "Background", group: "style" as const, allowAlpha: true },
  { type: "font" as const, key: "headingFont", label: "Heading font", group: "style" as const, role: "heading" as const },
  { type: "spacing" as const, key: "paddingTop", label: "Top spacing", group: "layout" as const, min: 0, max: 160 },
  { type: "link" as const, key: "link", label: "Link", group: "advanced" as const, dynamicTypes: urlTypes },
  { type: "image" as const, key: "image", label: "Image", group: "content" as const, dynamicTypes: imageTypes },
  { type: "product" as const, key: "productId", label: "Product", group: "content" as const, dynamicTypes: productTypes },
  { type: "collection" as const, key: "collectionId", label: "Collection", group: "content" as const, dynamicTypes: collectionTypes },
];

const heroBlocks = [
  { id: "preset-heading", type: "heading", enabled: true, settings: { text: "Welcome" } },
  { id: "preset-text", type: "text", enabled: true, settings: { text: "Discover our collection." } },
  { id: "preset-button", type: "button", enabled: true, settings: { label: "Shop now", href: "/shop" } },
];

export const contentSections: SectionDefinition[] = [
  { type: "hero", category: "content", supportedPages: [...home], settingsSchema: z.object({ contentAlignment: z.enum(["left", "center", "right"]).optional() }).passthrough(), controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: { contentAlignment: "left" }, defaultBlocks: heroBlocks, responsiveFields: ["contentAlignment"], presets: [{ id: "hero", label: "Hero", category: "banners" }] },
  { type: "category-grid", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "image-text", category: "content", supportedPages: [...home], settingsSchema: empty, controls: contentAlignment, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] },
  { type: "image-with-text", category: "content", supportedPages: [...home], settingsSchema: empty, controls: contentAlignment, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"], presets: [{ id: "image-with-text", label: "Image with text", category: "content" }] },
  { type: "image-banner", category: "content", supportedPages: [...home], settingsSchema: empty, controls: contentAlignment, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] },
  { type: "rich-text", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], presets: [{ id: "rich-text", label: "Rich text", category: "content" }] },
  { type: "testimonials", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: ["testimonial"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "faq", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: ["faq-item"], maxBlocks: 12, defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "newsletter", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: ["heading", "text"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], presets: [{ id: "newsletter", label: "Newsletter", category: "marketing" }] },
  { type: "multicolumn", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: ["heading", "text", "button"], maxBlocks: 6, defaultSettings: {}, defaultBlocks: [], responsiveFields: [], presets: [{ id: "multicolumn", label: "Multicolumn", category: "content" }] },
  { type: "contact-store-info", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: ["contact-item"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "logo-list", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: ["logo"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] }
  ,{ type: "journal-teaser", category: "content", supportedPages: [...home], settingsSchema: empty, controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
  ,{ type: "trust-strip", category: "content", supportedPages: [...home, "product", "cart"], settingsSchema: empty, controls: contentAlignment, allowedBlockTypes: ["heading", "text"], defaultSettings: { contentAlignment: "center" }, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
  ,{ type: "image-mosaic", category: "content", supportedPages: [...home], settingsSchema: empty, controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
  ,{ type: "not-found-message", category: "content", supportedPages: ["not-found"], settingsSchema: empty, controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
];
