import { z } from "zod";
import { settingValueSchema, type DynamicValueType } from "@jelly/storefront-schema";
import { withBlockStyle } from "./block-style.js";
import type { BlockDefinition, ControlDefinition } from "./types.js";

const dynamicString = z.union([z.string(), settingValueSchema(z.string())]);
const text = z.object({ text: dynamicString }).passthrough();
const stringTypes = ["string", "text"] satisfies DynamicValueType[];
const urlTypes = ["url"] satisfies DynamicValueType[];

const imageReference = z.object({ url: z.string(), alt: z.string().optional() }).passthrough();

/** Shapes for image and video blocks. */
export const MEDIA_RATIOS = ["square", "portrait", "landscape", "wide"] as const;
const ratioOptions = [{ label: "Square", value: "square" }, { label: "Portrait (4:5)", value: "portrait" }, { label: "Landscape (4:3)", value: "landscape" }, { label: "Wide (16:9)", value: "wide" }];
const hexColor = z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]).optional();
const choice = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.enum(values), z.literal("")]).optional();
const buttonOptionsSchema = {
  buttonStyle: choice(["primary", "secondary", "link"] as const),
  buttonSize: choice(["small", "medium", "large"] as const),
  buttonHover: choice(["darken", "lift", "underline", "none"] as const),
  buttonColor: hexColor,
  buttonTextColor: hexColor,
  openInNewTab: z.boolean().optional(),
};
const themeDefault = { label: "Theme default", value: "" };
/** Button options, grouped like Shopify's button block. Empty follows the theme's button settings. */
const buttonOptionControls: ControlDefinition[] = [
  { type: "checkbox", key: "openInNewTab", label: "Open link in a new tab", group: "content" },
  { type: "select", key: "buttonStyle", label: "Style", description: "Theme default: the first button is filled, the others are outlined.", group: "style", heading: "Button", options: [themeDefault, { label: "Filled", value: "primary" }, { label: "Outlined", value: "secondary" }, { label: "Text link", value: "link" }] },
  { type: "select", key: "buttonSize", label: "Size", group: "style", heading: "Button", options: [themeDefault, { label: "Small", value: "small" }, { label: "Medium", value: "medium" }, { label: "Large", value: "large" }] },
  { type: "select", key: "buttonHover", label: "Hover effect", group: "style", heading: "Button", options: [themeDefault, { label: "Darken", value: "darken" }, { label: "Lift with shadow", value: "lift" }, { label: "Underline", value: "underline" }, { label: "None", value: "none" }] },
  { type: "color", key: "buttonColor", label: "Button colour", group: "style", heading: "Appearance", allowAlpha: false },
  { type: "color", key: "buttonTextColor", label: "Button text colour", group: "style", heading: "Appearance", allowAlpha: false },
];

const linkSchema = z.union([z.string(), settingValueSchema(z.string())]).optional();

/** Blocks a group may hold. Groups do not hold groups (one level of nesting). */
export const GROUP_CHILD_TYPES = ["heading", "text", "button", "image", "video"];
/** A group lays its blocks out in a row or a column, like Shopify's group block. */
const groupBlock: BlockDefinition = {
  type: "group",
  settingsSchema: z.object({
    groupDirection: choice(["vertical", "horizontal"] as const),
    groupAlign: choice(["start", "center", "end", "between"] as const),
    groupVerticalAlign: choice(["start", "center", "end"] as const),
    groupGap: z.number().int().min(0).max(80).optional(),
    groupWrap: z.boolean().optional(),
  }).passthrough(),
  controls: [
    { type: "segmented", key: "groupDirection", mobile: true, label: "Direction", group: "layout", heading: "Layout", options: [{ label: "Vertical", value: "vertical" }, { label: "Horizontal", value: "horizontal" }] },
    { type: "select", key: "groupAlign", label: "Alignment", group: "layout", heading: "Layout", options: [{ label: "Follow section", value: "" }, { label: "Start", value: "start" }, { label: "Centre", value: "center" }, { label: "End", value: "end" }, { label: "Spread out", value: "between" }] },
    { type: "segmented", key: "groupVerticalAlign", label: "Line up", group: "layout", heading: "Layout", showWhen: { key: "groupDirection", equals: "horizontal" }, options: [{ label: "Top", value: "start" }, { label: "Middle", value: "center" }, { label: "Bottom", value: "end" }] },
    { type: "range", key: "groupGap", mobile: true, label: "Gap", group: "layout", heading: "Layout", min: 0, max: 80, step: 1, unit: "px" },
    { type: "checkbox", key: "groupWrap", label: "Stack on small screens", group: "layout", heading: "Layout", showWhen: { key: "groupDirection", equals: "horizontal" } },
  ],
  defaultSettings: { groupDirection: "horizontal", groupGap: 12, groupWrap: true },
  allowedBlockTypes: GROUP_CHILD_TYPES,
  maxBlocks: 8,
  defaultBlocks: [
    { id: "group-button-1", type: "button", enabled: true, settings: { label: "Shop now", href: "/shop" } },
    { id: "group-button-2", type: "button", enabled: true, settings: { label: "Learn more", href: "/pages/about" } },
  ],
};

const blocks: BlockDefinition[] = [
  { type: "slide", settingsSchema: z.object({ image: imageReference.optional(), eyebrow: z.string().max(80).optional(), heading: dynamicString.optional(), text: dynamicString.optional(), buttonLabel: z.string().max(40).optional(), buttonLink: linkSchema }).passthrough(), controls: [{ type: "image", key: "image", label: "Image", group: "content" }, { type: "text", key: "eyebrow", label: "Small text above heading", group: "content", maxLength: 80 }, { type: "text", key: "heading", label: "Heading", group: "content", maxLength: 120, dynamicTypes: stringTypes }, { type: "textarea", key: "text", label: "Text", group: "content", maxLength: 400, dynamicTypes: stringTypes }, { type: "text", key: "buttonLabel", label: "Button text", group: "content", maxLength: 40 }, { type: "link", key: "buttonLink", label: "Button link", group: "content", dynamicTypes: urlTypes }], defaultSettings: { heading: "A new season", text: "Introduce your latest collection.", buttonLabel: "Shop now", buttonLink: "/shop" } },
  { type: "product-tab", settingsSchema: z.object({ label: z.string().max(40), sort: z.string().max(40).optional(), collectionId: z.unknown().optional() }).passthrough(), controls: [{ type: "text", key: "label", label: "Tab name", group: "content", maxLength: 40 }, { type: "collection", key: "collectionId", label: "Show products from", group: "content", dynamicTypes: ["collection_reference"] }, { type: "select", key: "sort", label: "Order", group: "content", options: [{ label: "Featured", value: "" }, { label: "Newest first", value: "newest" }, { label: "Best selling", value: "best-selling" }, { label: "Price: low to high", value: "price-asc" }] }], defaultSettings: { label: "New in", sort: "newest" } },
  { type: "info-tab", settingsSchema: z.object({ title: z.string().max(80), text: z.string().max(2000).optional() }).passthrough(), controls: [{ type: "text", key: "title", label: "Tab title", group: "content", maxLength: 80 }, { type: "rich-text", key: "text", label: "Tab text", group: "content", maxLength: 2000 }], defaultSettings: { title: "Materials & care", text: "Add details customers need before they buy." } },
  { type: "link-heading", settingsSchema: z.object({ text: z.string().max(60) }).passthrough(), controls: [{ type: "text", key: "text", label: "Column heading", group: "content", maxLength: 60 }], defaultSettings: { text: "Help" } },
  { type: "link", settingsSchema: z.object({ label: z.string().max(60), link: linkSchema }).passthrough(), controls: [{ type: "text", key: "label", label: "Link text", group: "content", maxLength: 60 }, { type: "link", key: "link", label: "Link", group: "content", dynamicTypes: urlTypes }], defaultSettings: { label: "Contact us", link: "/contact" } },
  { type: "collection-card", settingsSchema: z.object({ label: z.string().max(80), image: imageReference.optional(), link: z.string().max(500).optional() }).passthrough(), controls: [{ type: "text", key: "label", label: "Title", group: "content", maxLength: 80 }, { type: "image", key: "image", label: "Image", group: "content" }, { type: "link", key: "link", label: "Link", group: "content", dynamicTypes: urlTypes }], defaultSettings: { label: "Collection", link: "/shop" } },
  { type: "column", settingsSchema: z.object({ heading: z.string().max(80), text: z.string().max(400).optional() }).passthrough(), controls: [{ type: "text", key: "heading", label: "Title", group: "content", maxLength: 80 }, { type: "rich-text", key: "text", label: "Text", group: "content", maxLength: 400 }], defaultSettings: { heading: "Free delivery", text: "Tell customers why they will love shopping with you." } },
  { type: "heading", settingsSchema: text, controls: [{ type: "rich-text", inline: true, key: "text", label: "Heading", group: "content", maxLength: 120, dynamicTypes: stringTypes }], defaultSettings: { text: "Heading" } },
  { type: "text", settingsSchema: text, controls: [{ type: "rich-text", key: "text", label: "Text", group: "content", maxLength: 1000, dynamicTypes: stringTypes }], defaultSettings: { text: "Add your text here." } },
  { type: "button", settingsSchema: z.object({ label: dynamicString, href: z.union([z.string(), settingValueSchema(z.string())]).optional(), ...buttonOptionsSchema }).passthrough(), controls: [{ type: "text", key: "label", label: "Button text", group: "content", maxLength: 40, dynamicTypes: stringTypes }, { type: "link", key: "href", label: "Link", group: "content", dynamicTypes: urlTypes }, ...buttonOptionControls], defaultSettings: { label: "Shop now", href: "/shop" } },
  { type: "image", settingsSchema: z.object({ image: imageReference.optional(), link: linkSchema, aspectRatio: z.union([z.enum(MEDIA_RATIOS), z.literal("")]).optional(), overlay: z.number().int().min(0).max(80).optional() }).passthrough(), controls: [{ type: "image", key: "image", label: "Image", group: "content" }, { type: "link", key: "link", label: "Link", description: "Optional. Where the image goes when tapped.", group: "content", dynamicTypes: urlTypes }, { type: "select", key: "aspectRatio", label: "Shape", group: "layout", heading: "Layout", options: [{ label: "Original", value: "" }, ...ratioOptions] }, { type: "range", key: "overlay", label: "Darken image", group: "style", heading: "Appearance", min: 0, max: 80, step: 5, unit: "%" }], defaultSettings: {} },
  { type: "video", settingsSchema: z.object({ url: z.string().max(500).optional(), poster: imageReference.optional(), aspectRatio: z.union([z.enum(MEDIA_RATIOS), z.literal("")]).optional(), autoplay: z.boolean().optional(), controls: z.boolean().optional() }).passthrough(), controls: [{ type: "text", key: "url", label: "Video link", description: "A YouTube or Vimeo link, or a link to an .mp4 file.", group: "content", maxLength: 500 }, { type: "image", key: "poster", label: "Cover image", description: "Shown before an .mp4 video plays.", group: "content" }, { type: "select", key: "aspectRatio", label: "Shape", group: "layout", heading: "Layout", options: [{ label: "Wide (16:9)", value: "" }, ...ratioOptions.filter(({ value }) => value !== "wide")] }, { type: "checkbox", key: "autoplay", label: "Play automatically (muted, on repeat)", group: "content" }, { type: "checkbox", key: "controls", label: "Show play controls", group: "content" }], defaultSettings: { controls: true } },
  { type: "testimonial", settingsSchema: z.object({ quote: dynamicString, author: z.string() }).passthrough(), controls: [{ type: "textarea", key: "quote", label: "Quote", group: "content", maxLength: 500, dynamicTypes: stringTypes }, { type: "text", key: "author", label: "Customer name", group: "content", maxLength: 80 }], defaultSettings: { quote: "A customer story.", author: "Customer" } },
  { type: "faq-item", settingsSchema: z.object({ question: dynamicString, answer: z.string() }).passthrough(), controls: [{ type: "text", key: "question", label: "Question", group: "content", maxLength: 160, dynamicTypes: stringTypes }, { type: "rich-text", key: "answer", label: "Answer", group: "content", maxLength: 1000 }], defaultSettings: { question: "Question", answer: "Answer" } },
  { type: "logo", settingsSchema: z.object({ image: imageReference.optional(), assetId: z.string().optional(), label: dynamicString.optional(), link: linkSchema }).passthrough(), controls: [{ type: "image", key: "image", label: "Logo", group: "content" }, { type: "text", key: "label", label: "Name", description: "Read aloud by screen readers, and shown when there is no logo image.", group: "content", maxLength: 80, dynamicTypes: stringTypes }, { type: "link", key: "link", label: "Link", description: "Optional.", group: "content", dynamicTypes: urlTypes }], defaultSettings: { label: "Brand name" } },
  { type: "menu", settingsSchema: z.object({ label: z.string().optional() }).passthrough(), controls: [{ type: "text", key: "label", label: "Column heading", group: "content", maxLength: 60 }], defaultSettings: {} },
  // Fixed rows for the Specifications section, e.g. "Warranty: 10 years". Values are typed, not bound, because bindings are not resolved on the live store yet.
  { type: "spec-row", settingsSchema: z.object({ label: z.string().max(60), value: z.string().max(240) }).passthrough(), controls: [{ type: "text", key: "label", label: "Name, e.g. Warranty", group: "content", maxLength: 60 }, { type: "text", key: "value", label: "Value, e.g. 10 years", group: "content", maxLength: 240 }], defaultSettings: { label: "Warranty", value: "10 years" } },
  { type: "contact-item", settingsSchema: z.object({ label: z.string(), value: dynamicString }).passthrough(), controls: [{ type: "text", key: "label", label: "Label", group: "content", maxLength: 40 }, { type: "text", key: "value", label: "Value", group: "content", maxLength: 160, dynamicTypes: stringTypes }], defaultSettings: { label: "Email", value: "hello@example.com" } },
  groupBlock,
  { type: "social-link", settingsSchema: z.object({ label: z.string(), href: z.union([z.string(), settingValueSchema(z.string())]) }).passthrough(), controls: [{ type: "link", key: "href", label: "Link", group: "content", dynamicTypes: urlTypes }], defaultSettings: { label: "Instagram", href: "https://example.com" } }
];

// Heading, text and button blocks get the shared style settings (layout, typography, colours, borders, padding).
export const blockDefinitions = new Map(blocks.map(withBlockStyle).map((definition) => [definition.type, definition]));
