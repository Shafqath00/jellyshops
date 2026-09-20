import { z } from "zod";
import type { SectionDefinition } from "../types.js";

const allPages = ["home", "product", "collection", "cart", "search", "not-found"] as const;
const empty = z.object({}).passthrough();

export const layoutSections: SectionDefinition[] = [
  { type: "announcement-bar", category: "layout", supportedPages: [...allPages], settingsSchema: empty, controls: [], allowedBlockTypes: ["text"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "header", category: "layout", supportedPages: [...allPages], settingsSchema: empty, controls: [], allowedBlockTypes: ["menu"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "spacer", category: "layout", supportedPages: [...allPages], settingsSchema: z.object({ size: z.string().optional() }).passthrough(), controls: [{ type: "select", key: "size", label: "Size", group: "layout", responsive: true, options: [{ label: "Small", value: "small" }, { label: "Standard", value: "standard" }, { label: "Large", value: "large" }] }], allowedBlockTypes: [], defaultSettings: { size: "standard" }, defaultBlocks: [], responsiveFields: ["size"] },
  { type: "divider", category: "layout", supportedPages: [...allPages], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "spacer-divider", category: "layout", supportedPages: [...allPages], settingsSchema: z.object({ size: z.string().optional() }).passthrough(), controls: [{ type: "range", key: "size", label: "Spacing", group: "layout", min: 0, max: 160, step: 4, unit: "px" }], allowedBlockTypes: [], defaultSettings: { size: 48 }, defaultBlocks: [], responsiveFields: [] },
  { type: "footer", category: "layout", supportedPages: [...allPages], settingsSchema: empty, controls: [], allowedBlockTypes: ["menu", "social-link", "contact-item"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] }
];
