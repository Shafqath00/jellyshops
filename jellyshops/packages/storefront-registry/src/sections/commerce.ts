import { z } from "zod";
import type { SectionDefinition } from "../types.js";

const empty = z.object({}).passthrough();

export const commerceSections: SectionDefinition[] = [
  { type: "featured-collection", category: "commerce", supportedPages: ["home"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], presets: [{ id: "featured-collection", label: "Featured collection", category: "products" }] },
  { type: "product-grid", category: "commerce", supportedPages: ["home"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], presets: [{ id: "product-grid", label: "Product grid", category: "products" }] },
  { type: "product-information", category: "commerce", supportedPages: ["product"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "product-description", category: "commerce", supportedPages: ["product"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "related-products", category: "commerce", supportedPages: ["product"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "collection-header", category: "commerce", supportedPages: ["collection"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "collection-product-grid", category: "commerce", supportedPages: ["collection"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "cart-summary", category: "commerce", supportedPages: ["cart"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "search-results", category: "commerce", supportedPages: ["search"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] }
];
