import { z } from "zod";
import { safeRichTextHref, STORE_ICON_LABELS, STORE_ICON_NAMES } from "@jelly/storefront-schema";
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
  transparent: z.boolean().optional(),
  overlayLogo: safeImage.optional(),
  showSearch: z.boolean().optional(),
  showAccount: z.boolean().optional(),
  showWishlist: z.boolean().optional(),
  showCart: z.boolean().optional(),
  layout: z.enum(["classic", "search-bar", "split", "minimal", "category-bar", "search-first"]).optional(),
  deliveryNote: z.string().max(60).optional(),
  menuStyle: z.enum(["dropdown", "mega"]).optional(),
  megaPhotoShape: z.enum(["landscape", "square", "portrait"]).optional(),
  showToolLabels: z.boolean().optional(),
  extraLinkLabel: z.string().max(40).optional(),
  extraLink: z.string().max(500).optional(),
  extraLinkIcon: z.enum(STORE_ICON_NAMES).optional(),
}).passthrough();
const footerSettings = z.object({
  storeName: z.string().max(120).optional(),
  text: z.string().max(240).optional(),
  contactEmail: z.string().max(160).optional(),
  copyright: z.string().max(160).optional(),
  showNewsletter: z.boolean().optional(),
  newsletterHeading: z.string().max(120).optional(),
  newsletterText: z.string().max(240).optional(),
  paymentMethods: z.string().max(200).optional(),
  wordmark: z.boolean().optional(),
}).passthrough();
const announcementSettings = z.object({ text: z.string().max(160).optional(), link: z.string().max(500).optional(), rotateSeconds: z.number().int().min(3).max(12).optional(), style: z.enum(["rotate", "marquee"]).optional() }).passthrough();
const headerControls: SectionDefinition["controls"] = [
  { type: "text", key: "storeName", label: "Store name", group: "content", maxLength: 120 },
  { type: "image", key: "logo", label: "Logo", group: "content", dynamicTypes: ["image"] },
  { type: "range", key: "logoWidth", label: "Logo width", group: "style", min: 64, max: 240, step: 8, unit: "px" },
  { type: "segmented", key: "logoPosition", label: "Logo position", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }] },
  { type: "checkbox", key: "sticky", label: "Keep header visible when scrolling", group: "layout" },
  { type: "checkbox", key: "transparent", label: "Show header over the first image on the home page", group: "layout" },
  { type: "image", key: "overlayLogo", label: "Logo over images (optional, use a light version)", group: "content", dynamicTypes: ["image"] },
  { type: "checkbox", key: "showSearch", label: "Show search", group: "content" },
  { type: "checkbox", key: "showAccount", label: "Show account", group: "content" },
  { type: "checkbox", key: "showWishlist", label: "Show wishlist", group: "content" },
  { type: "checkbox", key: "showCart", label: "Show bag", group: "content" },
  { type: "select", key: "layout", label: "Header layout", group: "layout", options: [
    { label: "Menu beside logo", value: "classic" },
    { label: "Search bar, logo in the middle", value: "search-bar" },
    { label: "Logo in the middle, menu on both sides", value: "split" },
    { label: "Minimal: menu button opens a full-screen menu", value: "minimal" },
    { label: "Two rows: search, then a category bar", value: "category-bar" },
    { label: "Search first, with a delivery note", value: "search-first" },
  ], description: "How the logo, menu and search are arranged. Phones always show the logo, the menu button and the bag." },
  { type: "text", key: "deliveryNote", label: "Delivery note", description: "A short note beside the search box, for example Delivery today from 6pm.", group: "content", maxLength: 60, showWhen: { key: "layout", equals: "search-first" }, visibleWhenSaved: true },
  { type: "segmented", key: "menuStyle", label: "Menu style", group: "layout", options: [
    { label: "Dropdown lists", value: "dropdown" },
    { label: "Large menu", value: "mega" },
  ], description: "Large menu opens a full-width panel: links with links inside become columns, and links with a photo become picture tiles (add photos in Content > Menus)." },
  { type: "segmented", key: "megaPhotoShape", label: "Photo shape in the large menu", group: "layout", options: [
    { label: "Wide", value: "landscape" },
    { label: "Square", value: "square" },
    { label: "Tall", value: "portrait" },
  ], showWhen: { key: "menuStyle", equals: "mega" } },
  { type: "checkbox", key: "showToolLabels", label: "Show words next to the icons", group: "style" },
  { type: "text", key: "extraLinkLabel", label: "Extra link text", description: "Shown beside the bag, for example Free swatches. Leave empty for none.", group: "content", maxLength: 40 },
  { type: "link", key: "extraLink", label: "Extra link", group: "content" },
  { type: "select", key: "extraLinkIcon", label: "Extra link icon", group: "content", options: STORE_ICON_NAMES.map((value) => ({ label: STORE_ICON_LABELS[value], value })) },
];
const footerControls: SectionDefinition["controls"] = [
  { type: "text", key: "storeName", label: "Store name", group: "content", maxLength: 120 },
  { type: "rich-text", key: "text", label: "About your store", group: "content", maxLength: 240 },
  { type: "text", key: "contactEmail", label: "Contact email", group: "content", maxLength: 160 },
  { type: "text", key: "copyright", label: "Copyright text", group: "content", maxLength: 160 },
  { type: "checkbox", key: "showNewsletter", label: "Show newsletter sign-up", group: "content" },
  { type: "text", key: "newsletterHeading", label: "Newsletter heading", group: "content", maxLength: 120 },
  { type: "rich-text", key: "newsletterText", label: "Newsletter text", group: "content", maxLength: 240 },
  { type: "checkbox", key: "wordmark", label: "Show the store name very large at the foot", group: "style" },
  { type: "text", key: "paymentMethods", label: "Payment methods", description: "Shown at the foot of the page, separated by commas, for example: Visa, Mastercard, PayPal.", group: "content", maxLength: 200 },
];

export const layoutSections: SectionDefinition[] = [
  { type: "announcement-bar", category: "layout", supportedPages: [...allPages], settingsSchema: announcementSettings, controls: [{ type: "text", key: "text", label: "Message", group: "content", maxLength: 160 }, { type: "link", key: "link", label: "Link", group: "content" }, { type: "segmented", key: "style", label: "With more than one message", group: "layout", options: [{ label: "Take turns", value: "rotate" }, { label: "Scroll sideways", value: "marquee" }], description: "Scroll sideways shows every message in a slow moving line. It stops when pointed at, and stays still for shoppers whose device asks for less motion." }, { type: "range", key: "rotateSeconds", label: "Seconds per message", description: "Used when you add more than one message block.", group: "layout", min: 3, max: 12, step: 1 }], allowedBlockTypes: ["text", "announcement-message"], maxBlocks: 6, defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "header", category: "layout", supportedPages: [...allPages], settingsSchema: headerSettings, controls: headerControls, allowedBlockTypes: ["menu", "trust-point"], defaultSettings: { storeName: "Storefront" }, defaultBlocks: [], responsiveFields: [] },
  { type: "spacer", category: "layout", supportedPages: [...allPages], settingsSchema: z.object({ size: z.string().optional() }).passthrough(), controls: [{ type: "select", key: "size", label: "Size", group: "layout", responsive: true, options: [{ label: "Small", value: "small" }, { label: "Standard", value: "standard" }, { label: "Large", value: "large" }] }], allowedBlockTypes: [], defaultSettings: { size: "standard" }, defaultBlocks: [], responsiveFields: ["size"] },
  { type: "divider", category: "layout", supportedPages: [...allPages], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "spacer-divider", category: "layout", supportedPages: [...allPages], settingsSchema: z.object({ size: z.union([z.number().min(0).max(160), z.string()]).optional() }).passthrough(), controls: [{ type: "range", key: "size", label: "Spacing", group: "layout", min: 0, max: 160, step: 4, unit: "px" }], allowedBlockTypes: [], defaultSettings: { size: 48 }, defaultBlocks: [], responsiveFields: [] },
  { type: "footer", category: "layout", supportedPages: [...allPages], settingsSchema: footerSettings, controls: footerControls, allowedBlockTypes: ["menu", "link-heading", "link", "social-link", "contact-item"], defaultSettings: { text: "Made with Jellyshop" }, defaultBlocks: [], responsiveFields: [] }
];
