import { z } from "zod";
import { safeRichTextHref } from "@jelly/storefront-schema";
import type { SectionDefinition } from "../types.js";

const allPages = ["home", "product", "collection", "cart", "search", "page", "blog", "article", "not-found", "checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success"] as const;
const empty = z.object({}).passthrough();
const safeImage = z.object({ id: z.string().optional(), url: z.string().refine((value) => safeRichTextHref(value) !== null && !value.startsWith("#")), alt: z.string().optional(), focalPoint: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(), fit: z.enum(["cover", "contain"]).optional() }).passthrough();
const headerSettings = z.object({
  storeName: z.string().max(120).optional(),
  logo: safeImage.optional(),
  logoWidth: z.number().int().min(64).max(240).optional(),
  logoPosition: z.enum(["left", "center"]).optional(),
  sticky: z.boolean().optional(),
  showSearch: z.boolean().optional(),
  showAccount: z.boolean().optional(),
  showWishlist: z.boolean().optional(),
  showCart: z.boolean().optional(),
}).passthrough();
const footerSettings = z.object({
  storeName: z.string().max(120).optional(),
  text: z.string().max(240).optional(),
  contactEmail: z.string().max(160).optional(),
  copyright: z.string().max(160).optional(),
}).passthrough();
const announcementSettings = z.object({ text: z.string().max(160).optional(), link: z.string().max(500).optional() }).passthrough();
const headerControls: SectionDefinition["controls"] = [
  { type: "text", key: "storeName", label: "Store name", group: "content", maxLength: 120 },
  { type: "image", key: "logo", label: "Logo", group: "content", dynamicTypes: ["image"] },
  { type: "range", key: "logoWidth", label: "Logo width", group: "style", min: 64, max: 240, step: 8, unit: "px" },
  { type: "segmented", key: "logoPosition", label: "Logo position", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }] },
  { type: "checkbox", key: "sticky", label: "Keep header visible when scrolling", group: "layout" },
  { type: "checkbox", key: "showSearch", label: "Show search", group: "content" },
  { type: "checkbox", key: "showAccount", label: "Show account", group: "content" },
  { type: "checkbox", key: "showWishlist", label: "Show wishlist", group: "content" },
  { type: "checkbox", key: "showCart", label: "Show bag", group: "content" },
];
const footerControls: SectionDefinition["controls"] = [
  { type: "text", key: "storeName", label: "Store name", group: "content", maxLength: 120 },
  { type: "textarea", key: "text", label: "About your store", group: "content", maxLength: 240 },
  { type: "text", key: "contactEmail", label: "Contact email", group: "content", maxLength: 160 },
  { type: "text", key: "copyright", label: "Copyright text", group: "content", maxLength: 160 },
];

export const layoutSections: SectionDefinition[] = [
  { type: "announcement-bar", category: "layout", supportedPages: [...allPages], settingsSchema: announcementSettings, controls: [{ type: "text", key: "text", label: "Message", group: "content", maxLength: 160 }, { type: "link", key: "link", label: "Link", group: "content" }], allowedBlockTypes: ["text"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "header", category: "layout", supportedPages: [...allPages], settingsSchema: headerSettings, controls: headerControls, allowedBlockTypes: ["menu"], defaultSettings: { storeName: "Storefront" }, defaultBlocks: [], responsiveFields: [] },
  { type: "spacer", category: "layout", supportedPages: [...allPages], settingsSchema: z.object({ size: z.string().optional() }).passthrough(), controls: [{ type: "select", key: "size", label: "Size", group: "layout", responsive: true, options: [{ label: "Small", value: "small" }, { label: "Standard", value: "standard" }, { label: "Large", value: "large" }] }], allowedBlockTypes: [], defaultSettings: { size: "standard" }, defaultBlocks: [], responsiveFields: ["size"] },
  { type: "divider", category: "layout", supportedPages: [...allPages], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "spacer-divider", category: "layout", supportedPages: [...allPages], settingsSchema: z.object({ size: z.string().optional() }).passthrough(), controls: [{ type: "range", key: "size", label: "Spacing", group: "layout", min: 0, max: 160, step: 4, unit: "px" }], allowedBlockTypes: [], defaultSettings: { size: 48 }, defaultBlocks: [], responsiveFields: [] },
  { type: "footer", category: "layout", supportedPages: [...allPages], settingsSchema: footerSettings, controls: footerControls, allowedBlockTypes: ["menu", "social-link", "contact-item"], defaultSettings: { text: "Made with Jelly Shop" }, defaultBlocks: [], responsiveFields: [] }
];
