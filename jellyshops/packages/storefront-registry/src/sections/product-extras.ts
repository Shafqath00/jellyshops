import { z } from "zod";
import type { SectionDefinition } from "../types.js";

/**
 * Product-page sections that go beyond the core purchase flow: merchant-written
 * information tabs (materials, shipping, returns) and a stock counter. Kept in
 * their own file so themes can offer them without touching the core product
 * sections.
 */
const productOnly = ["product"] as const;

const productTabsSettings = z.object({ firstOpen: z.boolean().optional() }).passthrough();
const stockCounterSettings = z.object({
  lowStockThreshold: z.number().int().min(1).max(50).optional(),
  showWhenPlentiful: z.boolean().optional(),
}).passthrough();

const specificationsSettings = z.object({
  heading: z.string().max(120).optional(),
  showProductSpecifications: z.boolean().optional(),
  layout: z.enum(["table", "expandable"]).optional(),
}).passthrough();

const infoTabBlocks = [
  { id: "preset-tab-care", type: "info-tab", enabled: true, settings: { title: "Materials & care", text: "Describe what the product is made from and how to look after it." } },
  { id: "preset-tab-shipping", type: "info-tab", enabled: true, settings: { title: "Shipping & returns", text: "Explain delivery times, costs and your returns policy." } },
];

export const productExtraSections: SectionDefinition[] = [
  {
    type: "product-tabs",
    category: "commerce",
    supportedPages: [...productOnly],
    settingsSchema: productTabsSettings,
    controls: [{ type: "checkbox", key: "firstOpen", label: "Open the first tab by default", group: "layout" }],
    allowedBlockTypes: ["info-tab"],
    maxBlocks: 8,
    defaultSettings: { firstOpen: false },
    defaultBlocks: infoTabBlocks,
    responsiveFields: [],
  },
  {
    // Each product's own specifications (entered on the product form) as a table, plus fixed rows that apply to every product using the template.
    type: "product-specifications",
    category: "commerce",
    supportedPages: [...productOnly],
    settingsSchema: specificationsSettings,
    controls: [
      { type: "text", key: "heading", label: "Heading", group: "content", maxLength: 120 },
      { type: "checkbox", key: "showProductSpecifications", label: "Show the specifications entered on each product", group: "content" },
      { type: "segmented", key: "layout", label: "Show as", group: "layout", options: [{ label: "Table", value: "table" }, { label: "Expandable panel", value: "expandable" }] },
    ],
    allowedBlockTypes: ["spec-row"],
    maxBlocks: 12,
    defaultSettings: { heading: "Specifications", showProductSpecifications: true, layout: "table" },
    defaultBlocks: [],
    responsiveFields: [],
  },
  {
    type: "product-stock-counter",
    category: "commerce",
    supportedPages: [...productOnly],
    settingsSchema: stockCounterSettings,
    controls: [
      { type: "range", key: "lowStockThreshold", label: "Say \"only a few left\" at or below", group: "content", min: 1, max: 50, step: 1 },
      { type: "checkbox", key: "showWhenPlentiful", label: "Show the count when stock is plentiful", group: "content" },
    ],
    allowedBlockTypes: [],
    defaultSettings: { lowStockThreshold: 5, showWhenPlentiful: true },
    defaultBlocks: [],
    responsiveFields: [],
  },
];
