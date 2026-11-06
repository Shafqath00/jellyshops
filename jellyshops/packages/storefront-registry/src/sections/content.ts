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
/** The older Background choice: an alias of a theme colour scheme, shown only on sections that still use it ("Colour scheme" replaces it). */
const colorScheme = { type: "segmented" as const, key: "colorScheme", label: "Background (older choice)", description: "Picking a colour scheme replaces this.", legacy: true, group: "style" as const, options: [{ label: "Page", value: "page" }, { label: "Soft", value: "soft" }, { label: "Dark", value: "dark" }] };
const sectionHeading = { type: "text" as const, key: "heading", label: "Heading", group: "content" as const, maxLength: 120, dynamicTypes: stringTypes };
const sectionText = { type: "rich-text" as const, key: "text", label: "Text", group: "content" as const, maxLength: 400, dynamicTypes: stringTypes };
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
  {
    type: "blog-header", category: "content", supportedPages: ["blog"],
    settingsSchema: z.object({ text: z.string().max(400).optional(), contentAlignment: alignmentSchema }).passthrough(),
    controls: [{ ...sectionText, label: "Text under the blog title" }, leftOrCenter],
    allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [],
  },
  {
    type: "article-list", category: "content", supportedPages: ["blog"],
    settingsSchema: z.object({
      layout: z.enum(["list", "grid"]).optional(), columns: z.number().int().min(2).max(3).optional(),
      showExcerpt: z.boolean().optional(), showDate: z.boolean().optional(),
      readMoreLabel: z.string().max(40).optional(), emptyMessage: z.string().max(200).optional(),
    }).passthrough(),
    controls: [
      { type: "segmented", key: "layout", label: "Layout", group: "layout", options: [{ label: "List", value: "list" }, { label: "Grid", value: "grid" }] },
      { ...columnsControl(3), showWhen: { key: "layout", equals: "grid" } },
      { type: "checkbox", key: "showExcerpt", label: "Show each article's summary", group: "content" },
      { type: "checkbox", key: "showDate", label: "Show the publish date", group: "content" },
      { type: "text", key: "readMoreLabel", label: "Read more link", description: "Leave empty to hide it.", group: "content", maxLength: 40 },
      { type: "text", key: "emptyMessage", label: "Message when there are no articles", group: "content", maxLength: 200 },
    ],
    allowedBlockTypes: [], defaultSettings: { layout: "list", columns: 3, showExcerpt: true, showDate: true }, defaultBlocks: [], responsiveFields: [],
  },
  {
    type: "article-header", category: "content", supportedPages: ["article"],
    settingsSchema: z.object({ showDate: z.boolean().optional(), showExcerpt: z.boolean().optional(), contentAlignment: alignmentSchema }).passthrough(),
    controls: [
      { type: "checkbox", key: "showDate", label: "Show the publish date", group: "content" },
      { type: "checkbox", key: "showExcerpt", label: "Show the summary under the title", group: "content" },
      leftOrCenter,
    ],
    allowedBlockTypes: [], defaultSettings: { showDate: true, showExcerpt: true }, defaultBlocks: [], responsiveFields: [],
  },
  {
    type: "article-content", category: "content", supportedPages: ["article"],
    settingsSchema: z.object({ textWidth: z.enum(["narrow", "medium", "wide"]).optional() }).passthrough(),
    controls: [{ type: "segmented", key: "textWidth", label: "Text width", group: "layout", options: [{ label: "Narrow", value: "narrow" }, { label: "Medium", value: "medium" }, { label: "Wide", value: "wide" }] }],
    allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [],
  },
  { type: "hero", category: "content", supportedPages: [...home], settingsSchema: heroSettings, controls: heroControls, allowedBlockTypes: ["heading", "text", "button"], maxBlocks: 4, defaultSettings: { contentAlignment: "left" }, defaultBlocks: heroBlocks, responsiveFields: ["contentAlignment"], presets: [{ id: "hero", label: "Hero", category: "banners" }] },
  { type: "slideshow", category: "content", supportedPages: [...home], settingsSchema: slideshowSettings, controls: slideshowControls, allowedBlockTypes: ["slide"], minBlocks: 1, maxBlocks: 6, defaultSettings: { height: "large", contentAlignment: "center", overlay: 30, autoplay: true, interval: 6 }, defaultBlocks: slideshowBlocks, responsiveFields: [], presets: [{ id: "slideshow", label: "Slideshow", category: "banners" }] },
  { type: "category-grid", category: "content", supportedPages: [...home], settingsSchema: z.object({ heading: z.string().max(120).optional(), text: z.string().max(400).optional(), columns: z.number().int().min(2).max(4).optional(), imageRatio: z.enum(["portrait", "square"]).optional(), colorScheme: schemeSchema }).passthrough(), controls: [sectionHeading, sectionText, columnsControl(4), { type: "segmented", key: "imageRatio", label: "Image shape", group: "style", options: [{ label: "Portrait", value: "portrait" }, { label: "Square", value: "square" }] }, colorScheme], allowedBlockTypes: ["collection-card"], maxBlocks: 8, defaultSettings: { heading: "Shop by collection", columns: 4 }, defaultBlocks: [], responsiveFields: [], presets: [{ id: "category-grid", label: "Collection list", category: "products" }] },
  { type: "image-text", category: "content", supportedPages: [...home], settingsSchema: empty, controls: contentAlignment, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] },
  { type: "image-with-text", category: "content", supportedPages: [...home], settingsSchema: imageWithTextSettings, controls: [eyebrowControl, imageControl, { type: "segmented", key: "imagePosition", label: "Image position", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Right", value: "right" }] }, colorScheme], allowedBlockTypes: ["heading", "text", "button", "group"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"], presets: [{ id: "image-with-text", label: "Image with text", category: "content" }] },
  { type: "image-banner", category: "content", supportedPages: [...home], settingsSchema: z.object({ image: imageReference.optional(), height: z.enum(["medium", "large"]).optional(), overlay: z.number().min(0).max(100).optional(), contentAlignment: alignmentSchema }).passthrough(), controls: [imageControl, heightControl, leftOrCenter, darknessControl("Image darkness")], allowedBlockTypes: ["heading", "text", "button", "group"], maxBlocks: 4, defaultSettings: { height: "medium", overlay: 30, contentAlignment: "center" }, defaultBlocks: heroBlocks, responsiveFields: [], presets: [{ id: "image-banner", label: "Image banner", category: "banners" }] },
  {
    // Shopify-style free section: any mix of heading, text, button, image and video blocks, in order.
    type: "custom-content", category: "content", supportedPages: [...reusableContentPages],
    settingsSchema: z.object({ direction: z.enum(["vertical", "horizontal"]).optional(), contentAlignment: alignmentSchema, gap: z.number().int().min(0).max(80).optional(), contentWidth: z.enum(["narrow", "normal", "wide", "full"]).optional() }).passthrough(),
    controls: [
      { type: "segmented", key: "direction", mobile: true, label: "Direction", group: "layout", options: [{ label: "Vertical", value: "vertical" }, { label: "Horizontal", value: "horizontal" }] },
      { type: "segmented", key: "contentAlignment", label: "Alignment", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Centre", value: "center" }, { label: "Right", value: "right" }] },
      { type: "range", key: "gap", mobile: true, label: "Gap", group: "layout", min: 0, max: 80, step: 4, unit: "px" },
      { type: "select", key: "contentWidth", label: "Content width", group: "layout", options: [{ label: "Narrow", value: "narrow" }, { label: "Normal", value: "normal" }, { label: "Wide", value: "wide" }, { label: "Full page", value: "full" }] },
    ],
    allowedBlockTypes: ["heading", "text", "button", "image", "video", "app", "group"], maxBlocks: 12,
    defaultSettings: { direction: "vertical", contentAlignment: "center", gap: 16, contentWidth: "normal" },
    defaultBlocks: [
      { id: "custom-heading", type: "heading", enabled: true, settings: { text: "Tell your story" } },
      { id: "custom-text", type: "text", enabled: true, settings: { text: "Share what makes your shop special." } },
      { id: "custom-button", type: "button", enabled: true, settings: { label: "Shop now", href: "/shop" } },
    ],
    responsiveFields: [], presets: [{ id: "custom-content", label: "Custom content", category: "content" }],
  },
  { type: "rich-text", category: "content", supportedPages: [...reusableContentPages], settingsSchema: richTextSettings, controls: [], allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], presets: [{ id: "rich-text", label: "Rich text", category: "content" }] },
  { type: "testimonials", category: "content", supportedPages: [...home], settingsSchema: z.object({ heading: z.string().max(120).optional(), colorScheme: schemeSchema }).passthrough(), controls: [sectionHeading, colorScheme], allowedBlockTypes: ["testimonial"], maxBlocks: 6, defaultSettings: { heading: "What customers say" }, defaultBlocks: [], responsiveFields: [], presets: [{ id: "testimonials", label: "Testimonials", category: "content" }] },
  { type: "faq", category: "content", supportedPages: [...home], settingsSchema: z.object({ heading: z.string().max(120).optional(), text: z.string().max(400).optional(), colorScheme: schemeSchema }).passthrough(), controls: [sectionHeading, sectionText, colorScheme], allowedBlockTypes: ["faq-item"], maxBlocks: 12, defaultSettings: { heading: "Frequently asked questions" }, defaultBlocks: [], responsiveFields: [], presets: [{ id: "faq", label: "FAQ", category: "content" }] },
  { type: "newsletter", category: "content", supportedPages: [...home], settingsSchema: z.object({ buttonLabel: z.string().max(40).optional(), contentAlignment: alignmentSchema, colorScheme: schemeSchema }).passthrough(), controls: [{ type: "text", key: "buttonLabel", label: "Button label", group: "content", maxLength: 40 }, leftOrCenter, colorScheme], allowedBlockTypes: ["heading", "text"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], presets: [{ id: "newsletter", label: "Newsletter", category: "marketing" }] },
  { type: "multicolumn", category: "content", supportedPages: [...home], settingsSchema: z.object({ heading: z.string().max(120).optional(), columns: z.number().int().min(2).max(4).optional(), contentAlignment: alignmentSchema, colorScheme: schemeSchema }).passthrough(), controls: [sectionHeading, columnsControl(4), leftOrCenter, colorScheme], allowedBlockTypes: ["column", "heading", "text", "button"], maxBlocks: 8, defaultSettings: { heading: "Why shop with us", columns: 3 }, defaultBlocks: [], responsiveFields: [], presets: [{ id: "multicolumn", label: "Feature columns", category: "content" }] },
  {
    // Showroom or shop visit: address, opening hours and one-tap contact buttons. Plain text only; bindings are not resolved on the live store yet.
    type: "contact-store-info", category: "content", supportedPages: ["home", "page"],
    settingsSchema: z.object({
      heading: z.string().max(120).optional(), text: z.string().max(400).optional(), image: imageReference.optional(),
      address: z.string().max(300).optional(), hours: z.string().max(400).optional(), phone: z.string().max(40).optional(),
      whatsapp: z.string().max(40).optional(), email: z.string().max(120).optional(), mapLink: z.string().max(500).optional(),
      colorScheme: schemeSchema,
    }).passthrough(),
    controls: [
      { type: "text", key: "heading", label: "Heading", group: "content", maxLength: 120 },
      { type: "rich-text", key: "text", label: "Text", group: "content", maxLength: 400 },
      { type: "textarea", key: "address", label: "Address", group: "content", maxLength: 300 },
      { type: "textarea", key: "hours", label: "Opening hours (one line per day, e.g. Mon–Fri: 10am–7pm)", group: "content", maxLength: 400 },
      { type: "text", key: "phone", label: "Phone number", group: "content", maxLength: 40 },
      { type: "text", key: "whatsapp", label: "WhatsApp number, with country code", group: "content", maxLength: 40 },
      { type: "text", key: "email", label: "Email address", group: "content", maxLength: 120 },
      { type: "text", key: "mapLink", label: "Map link (leave empty to search the address on Google Maps)", group: "content", maxLength: 500 },
      { type: "image", key: "image", label: "Photo of your shop (optional)", group: "content" },
      colorScheme,
    ],
    allowedBlockTypes: ["contact-item"], maxBlocks: 6,
    defaultSettings: { heading: "Visit our showroom", text: "Come and try our products in person. Our team is happy to help.", address: "", hours: "Mon–Sat: 10am–7pm\nSun: 11am–5pm", styleScheme: "scheme2" },
    defaultBlocks: [], responsiveFields: [],
  },
  {
    // Brand, press or partner logos in a row. Logos without an image show their name as text.
    type: "logo-list", category: "content", supportedPages: [...home, "page"],
    settingsSchema: z.object({ heading: z.string().max(120).optional(), logoHeight: z.number().int().min(24).max(120).optional(), grayscale: z.boolean().optional(), colorScheme: schemeSchema }).passthrough(),
    controls: [
      sectionHeading,
      { type: "range", key: "logoHeight", label: "Logo height", group: "layout", min: 24, max: 120, step: 4, unit: "px" },
      { type: "checkbox", key: "grayscale", label: "Show logos in grey (colour when pointed at)", group: "style" },
      colorScheme,
    ],
    allowedBlockTypes: ["logo"], maxBlocks: 12,
    defaultSettings: { heading: "As featured in", logoHeight: 48 },
    defaultBlocks: [], responsiveFields: [], presets: [{ id: "logo-list", label: "Logo list", category: "content" }],
  }
  ,{
    // Entries of one metaobject (Content > Metaobjects) as cards, each linking to its own page.
    type: "metaobject-list", category: "content", supportedPages: [...home, "page"],
    settingsSchema: z.object({
      heading: z.string().max(120).optional(),
      metaobject: z.string().max(64).regex(/^([a-z][a-z0-9_]*)?$/, "Use the metaobject's handle, for example designers").optional(),
      layout: z.enum(["grid", "list"]).optional(),
      columns: z.number().int().min(1).max(4).optional(),
      limit: z.number().int().min(1).max(48).optional(),
      showFields: z.boolean().optional(),
      linkToPages: z.boolean().optional(),
      colorScheme: schemeSchema,
    }).passthrough(),
    controls: [
      sectionHeading,
      { type: "text", key: "metaobject", label: "Metaobject handle", group: "content", maxLength: 64, description: "The handle shown in Content > Metaobjects, for example designers. Only metaobjects visible on the storefront are listed." },
      { type: "segmented", key: "layout", label: "Layout", group: "layout", options: [{ label: "Grid", value: "grid" }, { label: "List", value: "list" }] },
      { type: "range", key: "columns", label: "Columns", group: "layout", min: 1, max: 4, step: 1 },
      { type: "range", key: "limit", label: "Entries to show", group: "content", min: 1, max: 48, step: 1 },
      { type: "checkbox", key: "showFields", label: "Show each entry's details", group: "content" },
      { type: "checkbox", key: "linkToPages", label: "Link each entry to its own page", group: "content" },
      colorScheme,
    ],
    allowedBlockTypes: [],
    defaultSettings: { heading: "Meet the makers", metaobject: "", layout: "grid", columns: 3, limit: 12, showFields: true, linkToPages: true },
    defaultBlocks: [], responsiveFields: [], presets: [{ id: "metaobject-list", label: "Metaobject entries", category: "content" }],
  }
  ,{
    // Shopify-style "Apps" section: app blocks only (maps, booking, forms, players).
    type: "apps", category: "content", supportedPages: [...reusableContentPages],
    settingsSchema: z.object({ contentWidth: z.enum(["narrow", "normal", "wide", "full"]).optional(), gap: z.number().int().min(0).max(80).optional() }).passthrough(),
    controls: [
      { type: "select", key: "contentWidth", label: "Content width", group: "layout", options: [{ label: "Narrow", value: "narrow" }, { label: "Normal", value: "normal" }, { label: "Wide", value: "wide" }, { label: "Full page", value: "full" }] },
      { type: "range", key: "gap", label: "Gap", group: "layout", min: 0, max: 80, step: 4, unit: "px" },
    ],
    allowedBlockTypes: ["app"], maxBlocks: 6,
    defaultSettings: { direction: "vertical", contentAlignment: "center", gap: 24, contentWidth: "normal" },
    defaultBlocks: [{ id: "app-1", type: "app", enabled: true, settings: { provider: "", url: "" } }],
    responsiveFields: [], presets: [{ id: "apps", label: "Apps", category: "content" }],
  }
  ,{ type: "journal-teaser", category: "content", supportedPages: [...home], settingsSchema: empty, controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
  ,{
    // Short trust points ("Free delivery", "5-year warranty") in a row, or as a strip that scrolls sideways.
    // Older strips hold text blocks; trust-point blocks add an icon and a link.
    type: "trust-strip", category: "content", supportedPages: [...home, "product", "collection", "cart", "page"],
    settingsSchema: z.object({ colorScheme: schemeSchema, layout: z.enum(["row", "scroll"]).optional(), speed: z.enum(["slow", "normal", "fast"]).optional(), showIcons: z.boolean().optional() }).passthrough(),
    controls: [
      { type: "segmented", key: "layout", label: "Layout", group: "layout", options: [{ label: "In a row", value: "row" }, { label: "Scrolling", value: "scroll" }] },
      { type: "segmented", key: "speed", label: "Scrolling speed", description: "Shoppers who ask for less motion see the points without movement.", group: "layout", options: [{ label: "Slow", value: "slow" }, { label: "Normal", value: "normal" }, { label: "Fast", value: "fast" }], showWhen: { key: "layout", equals: "scroll" } },
      { type: "checkbox", key: "showIcons", label: "Show icons", group: "style" },
      colorScheme,
    ],
    allowedBlockTypes: ["trust-point", "heading", "text"], maxBlocks: 10,
    defaultSettings: { contentAlignment: "center", layout: "row", speed: "normal", showIcons: true }, defaultBlocks: [], responsiveFields: ["contentAlignment"],
    presets: [{ id: "trust-strip", label: "Trust badges", category: "content" }],
  }
  ,{
    // A star rating line: "4.8 out of 5 from 1,240 reviews". The merchant types the numbers from their review service.
    type: "rating-summary", category: "content", supportedPages: [...home, "product", "collection", "page"],
    settingsSchema: z.object({
      heading: z.string().max(120).optional(), rating: z.number().min(0).max(5).optional(), reviewCount: z.number().int().min(0).max(10_000_000).optional(),
      text: z.string().max(160).optional(), link: z.string().max(500).optional(), linkLabel: z.string().max(40).optional(),
      contentAlignment: z.enum(["left", "center"]).optional(), colorScheme: schemeSchema,
    }).passthrough(),
    controls: [
      sectionHeading,
      { type: "number", key: "rating", label: "Average rating (0 to 5)", group: "content", min: 0, max: 5, step: 0.1 },
      { type: "number", key: "reviewCount", label: "Number of reviews", description: "Leave at 0 to hide the count.", group: "content", min: 0, max: 10_000_000, step: 1 },
      { type: "text", key: "text", label: "Text after the rating", description: "Use {count} for the number of reviews, for example: from {count} reviews.", group: "content", maxLength: 160 },
      { type: "link", key: "link", label: "Link to your reviews", description: "Optional.", group: "content", dynamicTypes: urlTypes },
      { type: "text", key: "linkLabel", label: "Link text", group: "content", maxLength: 40 },
      { type: "segmented", key: "contentAlignment", label: "Alignment", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }] },
      colorScheme,
    ],
    allowedBlockTypes: [], defaultSettings: { rating: 4.8, reviewCount: 0, text: "from {count} reviews", linkLabel: "Read reviews", contentAlignment: "center" }, defaultBlocks: [], responsiveFields: [],
    presets: [{ id: "rating-summary", label: "Rating", category: "content" }],
  }
  ,{
    // Photos in a grid or a sideways-scrolling row, e.g. "Loved in homes like yours".
    type: "image-gallery", category: "content", supportedPages: [...home, "product", "collection", "page"],
    settingsSchema: z.object({
      heading: z.string().max(120).optional(), text: z.string().max(400).optional(), layout: z.enum(["grid", "scroll"]).optional(),
      columns: z.number().int().min(2).max(6).optional(), ratio: z.enum(["square", "portrait", "landscape"]).optional(), colorScheme: schemeSchema,
    }).passthrough(),
    controls: [
      sectionHeading,
      { type: "textarea", key: "text", label: "Text", group: "content", maxLength: 400 },
      { type: "segmented", key: "layout", label: "Layout", group: "layout", options: [{ label: "Grid", value: "grid" }, { label: "Scrolling row", value: "scroll" }] },
      { type: "range", key: "columns", label: "Photos per row", group: "layout", min: 2, max: 6, step: 1 },
      { type: "segmented", key: "ratio", label: "Photo shape", group: "style", options: [{ label: "Square", value: "square" }, { label: "Portrait", value: "portrait" }, { label: "Landscape", value: "landscape" }] },
      colorScheme,
    ],
    allowedBlockTypes: ["gallery-image"], maxBlocks: 24,
    defaultSettings: { heading: "Loved in homes like yours", layout: "grid", columns: 4, ratio: "square" }, defaultBlocks: [], responsiveFields: [],
    presets: [{ id: "image-gallery", label: "Photo gallery", category: "content" }],
  }
  ,{ type: "image-mosaic", category: "content", supportedPages: [...home], settingsSchema: empty, controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
  ,{ type: "not-found-message", category: "content", supportedPages: ["not-found"], settingsSchema: empty, controls: comprehensiveControls, allowedBlockTypes: ["heading", "text", "button"], defaultSettings: {}, defaultBlocks: [], responsiveFields: ["contentAlignment"] }
];
