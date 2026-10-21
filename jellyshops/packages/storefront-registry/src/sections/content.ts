import { z } from "zod";
import { isRichTextDocument, safeRichTextHref, type DynamicValueType, type RichTextDocument } from "@jelly/storefront-schema";
import type { SectionDefinition } from "../types.js";

const home = ["home"] as const;
const reusableContentPages = ["home", "product", "collection", "page", "blog", "article", "checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success"] as const;
const empty = z.object({}).passthrough();
const richTextSettings = z.object({ document: z.custom<RichTextDocument>(isRichTextDocument).optional() }).passthrough();
const imageReference = z.object({
  id: z.string().optional(),
  url: z.string().refine((value) => safeRichTextHref(value) !== null && !value.startsWith("#"), "Image URL must use a safe relative, HTTP, or HTTPS URL"),
  alt: z.string().optional(),
  focalPoint: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
  fit: z.enum(["cover", "contain"]).optional(),
}).passthrough();
const imageWithTextSettings = z.object({
  image: imageReference.optional(),
  contentAlignment: z.enum(["left", "center", "right"]).optional(),
  imagePosition: z.enum(["left", "right"]).optional(),
  colorScheme: z.enum(["page", "soft", "dark"]).optional(),
}).passthrough();
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

// Plain-language controls shared by the merchandising sections below.
const colorScheme = { type: "segmented" as const, key: "colorScheme", label: "Background", group: "style" as const, options: [{ label: "Page", value: "page" }, { label: "Soft", value: "soft" }, { label: "Dark", value: "dark" }] };
const sectionHeading = { type: "text" as const, key: "heading", label: "Heading", group: "content" as const, maxLength: 120, dynamicTypes: stringTypes };
const sectionText = { type: "textarea" as const, key: "text", label: "Text", group: "content" as const, maxLength: 400, dynamicTypes: stringTypes };
const imageControl = { type: "image" as const, key: "image", label: "Image", group: "content" as const, dynamicTypes: imageTypes };
const eyebrowControl = { type: "text" as const, key: "eyebrow", label: "Small text above heading", group: "content" as const, maxLength: 80, dynamicTypes: stringTypes };
const leftOrCenter = { type: "segmented" as const, key: "contentAlignment", label: "Text alignment", group: "layout" as const, options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }] };
const heightControl = { type: "segmented" as const, key: "height", label: "Height", group: "layout" as const, options: [{ label: "Medium", value: "medium" }, { label: "Large", value: "large" }] };
const columnsControl = (max: number) => ({ type: "range" as const, key: "columns", label: "Columns on desktop", group: "layout" as const, min: 2, max, step: 1 });
const darknessControl = (label: string) => ({ type: "range" as const, key: "overlay", label, group: "style" as const, min: 0, max: 80, step: 5, unit: "%" });
const schemeSchema = z.enum(["page", "soft", "dark"]).optional();
const alignmentSchema = z.enum(["left", "center", "right"]).optional();
const heroControls = [
  eyebrowControl,
  imageControl,
  { type: "segmented" as const, key: "layout", label: "Layout", group: "layout" as const, options: [{ label: "Image beside text", value: "split" }, { label: "Text over image", value: "overlay" }, { label: "Text only", value: "text" }] },
  heightControl,
  leftOrCenter,
  colorScheme,
  darknessControl("Image darkness (text over image)"),
];
const heroSettings = z.object({
  contentAlignment: alignmentSchema,
  layout: z.enum(["split", "overlay", "text"]).optional(),
  height: z.enum(["medium", "large"]).optional(),
  colorScheme: schemeSchema,
  overlay: z.number().min(0).max(100).optional(),
}).passthrough();

const slideshowSettings = z.object({
  height: z.enum(["medium", "large"]).optional(),
  contentAlignment: alignmentSchema,
  overlay: z.number().min(0).max(100).optional(),
  autoplay: z.boolean().optional(),
  interval: z.number().int().min(3).max(12).optional(),
}).passthrough();
const slideshowControls = [
  heightControl,
  leftOrCenter,
  darknessControl("Image darkness"),
  { type: "checkbox" as const, key: "autoplay", label: "Change slides automatically", group: "layout" as const },
  { type: "range" as const, key: "interval", label: "Seconds per slide", group: "layout" as const, min: 3, max: 12, step: 1, unit: "s" },
];
const slideshowBlocks = [
  { id: "preset-slide-1", type: "slide", enabled: true, settings: { heading: "A new season", text: "Introduce your latest collection.", buttonLabel: "Shop now", buttonLink: "/shop" } },
  { id: "preset-slide-2", type: "slide", enabled: true, settings: { heading: "Made to last", text: "Tell customers what makes your products special.", buttonLabel: "Our story", buttonLink: "/about" } },
];
const heroBlocks = [
  { id: "preset-heading", type: "heading", enabled: true, settings: { text: "Welcome" } },
  { id: "preset-text", type: "text", enabled: true, settings: { text: "Discover our collection." } },
  { id: "preset-button", type: "button", enabled: true, settings: { label: "Shop now", href: "/shop" } },
];

export const contentSections: SectionDefinition[] = [
  { type: "page-content", category: "content", supportedPages: ["page"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "blog-header", category: "content", supportedPages: ["blog"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "article-list", category: "content", supportedPages: ["blog"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "article-header", category: "content", supportedPages: ["article"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "article-content", category: "content", supportedPages: ["article"], settingsSchema: empty, controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "hero", category: "content", supportedPages: [...home], settingsSchema: heroSettings, controls: heroControls, allowedBlockTypes: ["heading", "text", "button"], maxBlocks: 4, defaultSettings: { contentAlignment: "left" }, defaultBlocks: heroBlocks, responsiveFields: ["contentAlignment"], presets: [{ id: "hero", label: "Hero", category: "banners" }] },
  { type: "slideshow", category: "content", supportedPages: [...home], settingsSchema: slideshowSettings, controls: slideshowControls, allowedBlockTypes: ["slide"], minBlocks: 1, maxBlocks: 6, defaultSettings: { height: "large", contentAlignment: "center", overlay: 30, autoplay: true, interval: 6 }, defaultBlocks: slideshowBlocks, responsiveFields: [], presets: [{ id: "slideshow", label: "Slideshow", category: "banners" }] },
  { type: "category-grid", category: "content", supportedPages: [...home], settingsSchema: z.object({ heading: z.string().max(120).optional(), text: z.string().max(400).optional(), columns: z.number().int().min(2).max(4).optional(), imageRatio: z.enum(["portrait", "square"]).optional(), colorScheme: schemeSchema }).passthrough(), controls: [sectionHeading, sectionText, columnsControl(4), { type: "segmented", key: "imageRatio", label: "Image shape", group: "style", options: [{ label: "Portrait", value: "portrait" }, { label: "Square", value: "square" }] }, colorScheme], allowedBlockTypes: ["collection-card"], maxBlocks: 8, defaultSettings: { heading: "Shop by collection", columns: 4 }, defaultBlocks: [], responsiveFields: [], presets: [{ id: "category-grid", label: "Collection list", category: "products" }] },
  { type: "image-text", category: "content", supportedPages: [...home], settingsSchema: empty, controls: contentAlignment, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] },
  { type: "image-with-text", category: "content", supportedPages: [...home], settingsSchema: imageWithTextSettings, controls: [eyebrowControl, imageControl, { type: "segmented", key: "imagePosition", label: "Image position", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Right", value: "right" }] }, colorScheme], allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"], presets: [{ id: "image-with-text", label: "Image with text", category: "content" }] },
  { type: "image-banner", category: "content", supportedPages: [...home], settingsSchema: z.object({ image: imageReference.optional(), height: z.enum(["medium", "large"]).optional(), overlay: z.number().min(0).max(100).optional(), contentAlignment: alignmentSchema }).passthrough(), controls: [imageControl, heightControl, leftOrCenter, darknessControl("Image darkness")], allowedBlockTypes: ["heading", "text", "button"], maxBlocks: 4, defaultSettings: { height: "medium", overlay: 30, contentAlignment: "center" }, defaultBlocks: heroBlocks, responsiveFields: [], presets: [{ id: "image-banner", label: "Image banner", category: "banners" }] },
  { type: "rich-text", category: "content", supportedPages: [...reusableContentPages], settingsSchema: richTextSettings, controls: [], allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], presets: [{ id: "rich-text", label: "Rich text", category: "content" }] },
  { type: "testimonials", category: "content", supportedPages: [...home], settingsSchema: z.object({ heading: z.string().max(120).optional(), colorScheme: schemeSchema }).passthrough(), controls: [sectionHeading, colorScheme], allowedBlockTypes: ["testimonial"], maxBlocks: 6, defaultSettings: { heading: "What customers say" }, defaultBlocks: [], responsiveFields: [], presets: [{ id: "testimonials", label: "Testimonials", category: "content" }] },
  { type: "faq", category: "content", supportedPages: [...home], settingsSchema: z.object({ heading: z.string().max(120).optional(), text: z.string().max(400).optional(), colorScheme: schemeSchema }).passthrough(), controls: [sectionHeading, sectionText, colorScheme], allowedBlockTypes: ["faq-item"], maxBlocks: 12, defaultSettings: { heading: "Frequently asked questions" }, defaultBlocks: [], responsiveFields: [], presets: [{ id: "faq", label: "FAQ", category: "content" }] },
  { type: "newsletter", category: "content", supportedPages: [...home], settingsSchema: z.object({ buttonLabel: z.string().max(40).optional(), contentAlignment: alignmentSchema, colorScheme: schemeSchema }).passthrough(), controls: [{ type: "text", key: "buttonLabel", label: "Button label", group: "content", maxLength: 40 }, leftOrCenter, colorScheme], allowedBlockTypes: ["heading", "text"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], presets: [{ id: "newsletter", label: "Newsletter", category: "marketing" }] },
  { type: "multicolumn", category: "content", supportedPages: [...home], settingsSchema: z.object({ heading: z.string().max(120).optional(), columns: z.number().int().min(2).max(4).optional(), contentAlignment: alignmentSchema, colorScheme: schemeSchema }).passthrough(), controls: [sectionHeading, columnsControl(4), leftOrCenter, colorScheme], allowedBlockTypes: ["column", "heading", "text", "button"], maxBlocks: 8, defaultSettings: { heading: "Why shop with us", columns: 3 }, defaultBlocks: [], responsiveFields: [], presets: [{ id: "multicolumn", label: "Feature columns", category: "content" }] },
  { type: "contact-store-info", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: ["contact-item"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] },
  { type: "logo-list", category: "content", supportedPages: [...home], settingsSchema: empty, controls: [], allowedBlockTypes: ["logo"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] }
  ,{ type: "journal-teaser", category: "content", supportedPages: [...home], settingsSchema: empty, controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
  ,{ type: "trust-strip", category: "content", supportedPages: [...home, "product", "cart"], settingsSchema: z.object({ colorScheme: schemeSchema }).passthrough(), controls: [colorScheme], allowedBlockTypes: ["heading", "text"], defaultSettings: { contentAlignment: "center" }, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
  ,{ type: "image-mosaic", category: "content", supportedPages: [...home], settingsSchema: empty, controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
  ,{ type: "not-found-message", category: "content", supportedPages: ["not-found"], settingsSchema: empty, controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
];
