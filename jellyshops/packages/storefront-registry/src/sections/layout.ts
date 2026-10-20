import { z } from "zod";
import { safeRichTextHref } from "@jelly/storefront-schema";
import type { SectionDefinition } from "../types.js";

const allPages = ["home", "product", "collection", "cart", "search", "page", "blog", "article", "not-found", "checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success"] as const;
const empty = z.object({}).passthrough();
const safeImage = z.object({ id: z.string().optional(), url: z.string().refine((value) => safeRichTextHref(value) !== null && !value.startsWith("#")), alt: z.string().optional(), focalPoint: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(), fit: z.enum(["cover", "contain"]).optional() }).passthrough();
const headerSettings = z.object({ storeName: z.string().max(120).optional(), logo: safeImage.optional() }).passthrough();
const footerSettings = z.object({ text: z.string().max(240).optional() }).passthrough();

export const layoutSections: SectionDefinition[] = [
  { type: "announcement-bar", category: "layout", supportedPages: [...allPages], settingsSchema: empty, controls: [], allowedBlockTypes: ["text"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "header", category: "layout", supportedPages: [...allPages], settingsSchema: headerSettings, controls: [{ type: "text", key: "storeName", label: "Store name", group: "content", maxLength: 120 }, { type: "image", key: "logo", label: "Logo", group: "content", dynamicTypes: ["image"] }], allowedBlockTypes: ["menu"], defaultSettings: { storeName: "Storefront" }, defaultBlocks: [], responsiveFields: [] },
  { type: "spacer", category: "layout", supportedPages: [...allPages], settingsSchema: z.object({ size: z.string().optional() }).passthrough(), controls: [{ type: "select", key: "size", label: "Size", group: "layout", responsive: true, options: [{ label: "Small", value: "small" }, { label: "Standard", value: "standard" }, { label: "Large", value: "large" }] }], allowedBlockTypes: [], defaultSettings: { size: "standard" }, defaultBlocks: [], responsiveFields: ["size"] },
  { type: "divider", category: "layout", supportedPages: [...allPages], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "spacer-divider", category: "layout", supportedPages: [...allPages], settingsSchema: z.object({ size: z.string().optional() }).passthrough(), controls: [{ type: "range", key: "size", label: "Spacing", group: "layout", min: 0, max: 160, step: 4, unit: "px" }], allowedBlockTypes: [], defaultSettings: { size: 48 }, defaultBlocks: [], responsiveFields: [] },
  { type: "footer", category: "layout", supportedPages: [...allPages], settingsSchema: footerSettings, controls: [{ type: "text", key: "text", label: "Footer text", group: "content", maxLength: 240 }], allowedBlockTypes: ["menu", "social-link", "contact-item"], defaultSettings: { text: "Made with Jelly Shop" }, defaultBlocks: [], responsiveFields: [] }
];
