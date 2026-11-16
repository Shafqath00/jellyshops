import { z } from "zod";
import { settingValueSchema, type DynamicValueType } from "@jelly/storefront-schema";
import type { BlockDefinition, ControlDefinition } from "./types.js";

/**
 * The shared content block library, wave 2 (theme plan T4, docs/template-analysis.md section 6.4): media, cards
 * and forms. Every block joins "@content", so Custom section, groups and grids take them. Product blocks read the
 * store's products; forms only send on the live store.
 */

const CONTENT: BlockDefinition["sets"] = ["@content"];
const stringTypes = ["string", "text"] satisfies DynamicValueType[];
const urlTypes = ["url"] satisfies DynamicValueType[];
const dynamicString = z.union([z.string(), settingValueSchema(z.string())]);
const linkSchema = z.union([z.string(), settingValueSchema(z.string())]).optional();
const imageReference = z.object({ url: z.string(), alt: z.string().optional() }).passthrough();
const choice = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.enum(values), z.literal("")]).optional();
const options = (...pairs: Array<[string, string]>) => pairs.map(([value, label]) => ({ label, value }));
const ratioOptions = options(["landscape", "Landscape (4:3)"], ["square", "Square"], ["portrait", "Portrait (4:5)"], ["wide", "Wide (16:9)"]);
const ratio = choice(["square", "portrait", "landscape", "wide"] as const);

const text = (key: string, label: string, maxLength: number, extra: Partial<ControlDefinition> = {}): ControlDefinition =>
  ({ type: "text", key, label, group: "content", maxLength, dynamicTypes: stringTypes, ...extra }) as ControlDefinition;
const plain = (key: string, label: string, maxLength: number, description?: string): ControlDefinition =>
  ({ type: "text", key, label, group: "content", maxLength, ...(description ? { description } : {}) });
const image = (key: string, label: string): ControlDefinition => ({ type: "image", key, label, group: "content" });
const link = (key: string, label: string): ControlDefinition => ({ type: "link", key, label, group: "content", dynamicTypes: urlTypes });

/** A photo with text over it or under it, linking somewhere. */
const imageCard: BlockDefinition = {
  type: "image-card", sets: CONTENT,
  settingsSchema: z.object({ image: imageReference.optional(), heading: dynamicString.optional(), text: z.string().max(400).optional(), buttonLabel: z.string().max(40).optional(), link: linkSchema, textPosition: choice(["over", "below"] as const), overlay: z.number().int().min(0).max(80).optional(), imageRatio: ratio }).passthrough(),
  controls: [
    image("image", "Image"), text("heading", "Heading", 120), { type: "textarea", key: "text", label: "Text", group: "content", maxLength: 400, dynamicTypes: stringTypes },
    plain("buttonLabel", "Button text", 40), link("link", "Link"),
    { type: "segmented", key: "textPosition", label: "Text", group: "layout", options: options(["over", "Over the photo"], ["below", "Below the photo"]) },
    { type: "select", key: "imageRatio", label: "Image shape", group: "layout", options: ratioOptions },
    { type: "range", key: "overlay", label: "Darken photo", description: "Keeps text over the photo readable.", group: "style", min: 0, max: 80, step: 5, unit: "%", visibleIf: { key: "textPosition", notEquals: "below" } },
  ],
  defaultSettings: { heading: "New season", text: "Fresh colours for warmer days.", buttonLabel: "Shop now", link: "/shop", textPosition: "over", overlay: 35, imageRatio: "portrait" },
};

const imagesStack: BlockDefinition = {
  type: "images-stack", sets: CONTENT,
  settingsSchema: z.object({ image1: imageReference.optional(), image2: imageReference.optional(), image3: imageReference.optional(), stackLayout: choice(["cascade", "fan"] as const) }).passthrough(),
  controls: [image("image1", "Back photo"), image("image2", "Middle photo"), image("image3", "Front photo"), { type: "segmented", key: "stackLayout", label: "Arrangement", group: "layout", options: options(["cascade", "Cascade"], ["fan", "Fan"]) }],
  defaultSettings: { stackLayout: "cascade" },
};

const imageComparison: BlockDefinition = {
  type: "image-comparison", sets: CONTENT,
  settingsSchema: z.object({ before: imageReference.optional(), after: imageReference.optional(), beforeLabel: z.string().max(30).optional(), afterLabel: z.string().max(30).optional(), start: z.number().int().min(5).max(95).optional(), imageRatio: ratio }).passthrough(),
  controls: [
    image("before", "Before photo"), image("after", "After photo"), plain("beforeLabel", "Before label", 30), plain("afterLabel", "After label", 30),
    { type: "range", key: "start", label: "Divider starts at", group: "layout", min: 5, max: 95, step: 5, unit: "%" },
    { type: "select", key: "imageRatio", label: "Image shape", group: "layout", options: ratioOptions },
  ],
  defaultSettings: { beforeLabel: "Before", afterLabel: "After", start: 50, imageRatio: "landscape" },
};

const videoCard: BlockDefinition = {
  type: "video-card", sets: CONTENT,
  settingsSchema: z.object({ url: z.string().max(500).optional(), poster: imageReference.optional(), heading: dynamicString.optional(), text: z.string().max(300).optional() }).passthrough(),
  controls: [
    plain("url", "Video link", 500, "A YouTube or Vimeo link, or a link to an .mp4 file."), image("poster", "Cover image"),
    text("heading", "Heading", 120), { type: "textarea", key: "text", label: "Text", group: "content", maxLength: 300, dynamicTypes: stringTypes },
  ],
  defaultSettings: { heading: "See how it is made", text: "Two minutes in our studio." },
};

/** A product card for one product the merchant picks (empty = the store's first product). */
const productCard: BlockDefinition = {
  type: "product-card", sets: CONTENT,
  settingsSchema: z.object({ productId: z.string().max(120).optional() }).passthrough(),
  controls: [{ type: "product", key: "productId", label: "Product", description: "Leave empty to show your first product.", group: "content" }],
  defaultSettings: {},
};

/** A large photo with a small product card laid over it ("Shop" button), like a lookbook. */
const productOverlayCard: BlockDefinition = {
  type: "product-overlay-card", sets: CONTENT,
  settingsSchema: z.object({ productId: z.string().max(120).optional(), image: imageReference.optional(), cardPosition: choice(["bottom-left", "bottom-right", "top-left", "top-right"] as const), imageRatio: ratio }).passthrough(),
  controls: [
    { type: "product", key: "productId", label: "Product", description: "Leave empty to show your first product.", group: "content" },
    { ...image("image", "Photo"), description: "A lifestyle photo. Leave empty to use the product photo." } as ControlDefinition,
    { type: "select", key: "cardPosition", label: "Card position", group: "layout", options: options(["bottom-left", "Bottom left"], ["bottom-right", "Bottom right"], ["top-left", "Top left"], ["top-right", "Top right"]) },
    { type: "select", key: "imageRatio", label: "Image shape", group: "layout", options: ratioOptions },
  ],
  defaultSettings: { cardPosition: "bottom-left", imageRatio: "portrait" },
};

const press: BlockDefinition = {
  type: "press", sets: CONTENT,
  settingsSchema: z.object({ quote: dynamicString, source: z.string().max(80).optional(), logo: imageReference.optional() }).passthrough(),
  controls: [{ type: "textarea", key: "quote", label: "Quote", group: "content", maxLength: 300, dynamicTypes: stringTypes }, plain("source", "Publication", 80), image("logo", "Publication logo")],
  defaultSettings: { quote: "The softest knit we tried this winter.", source: "The Weekend Paper" },
};

/** Forms: an email sign-up and a contact form. They send only on the live store. */
const newsletterForm: BlockDefinition = {
  type: "newsletter-form", sets: CONTENT,
  settingsSchema: z.object({ buttonLabel: z.string().max(40).optional() }).passthrough(),
  controls: [plain("buttonLabel", "Button text", 40)],
  defaultSettings: { buttonLabel: "Subscribe" },
};

const contactForm: BlockDefinition = {
  type: "contact-form", sets: CONTENT,
  settingsSchema: z.object({ buttonLabel: z.string().max(40).optional(), successText: z.string().max(160).optional() }).passthrough(),
  controls: [plain("buttonLabel", "Button text", 40), plain("successText", "Message after sending", 160)],
  defaultSettings: { buttonLabel: "Send message", successText: "Thanks, we will reply soon." },
};

const share: BlockDefinition = {
  type: "share", sets: CONTENT,
  settingsSchema: z.object({ label: z.string().max(40).optional(), showX: z.boolean().optional(), showFacebook: z.boolean().optional(), showWhatsapp: z.boolean().optional(), showPinterest: z.boolean().optional(), showCopy: z.boolean().optional() }).passthrough(),
  controls: [
    plain("label", "Label", 40),
    { type: "checkbox", key: "showCopy", label: "Copy link", group: "content", defaultValue: true },
    { type: "checkbox", key: "showWhatsapp", label: "WhatsApp", group: "content", defaultValue: true },
    { type: "checkbox", key: "showFacebook", label: "Facebook", group: "content", defaultValue: true },
    { type: "checkbox", key: "showX", label: "X", group: "content", defaultValue: true },
    { type: "checkbox", key: "showPinterest", label: "Pinterest", group: "content", defaultValue: true },
  ],
  defaultSettings: { label: "Share" },
};

const countdown: BlockDefinition = {
  type: "countdown", sets: CONTENT,
  settingsSchema: z.object({ countdownTo: z.string().max(16).optional(), endText: z.string().max(120).optional(), label: z.string().max(80).optional() }).passthrough(),
  controls: [
    plain("label", "Text above", 80),
    plain("countdownTo", "Count down to", 16, "Date and time in UK time, written YYYY-MM-DD HH:MM, for example 2026-12-24 18:00."),
    plain("endText", "Text when it ends", 120),
  ],
  defaultSettings: { label: "Sale ends in", endText: "The sale has ended." },
};

const storeLocator: BlockDefinition = {
  type: "store-locator", sets: CONTENT,
  settingsSchema: z.object({ name: z.string().max(80).optional(), address: z.string().max(300).optional(), hours: z.string().max(400).optional(), phone: z.string().max(40).optional(), mapLink: z.string().max(500).optional() }).passthrough(),
  controls: [
    plain("name", "Shop name", 80),
    { type: "textarea", key: "address", label: "Address", group: "content", maxLength: 300 },
    { type: "textarea", key: "hours", label: "Opening hours", description: "One line per day, for example Mon–Fri: 10am–6pm.", group: "content", maxLength: 400 },
    plain("phone", "Phone number", 40),
    { type: "text", key: "mapLink", label: "Map link", description: "Leave empty to search the address on Google Maps.", group: "content", maxLength: 500, translatable: false },
  ],
  defaultSettings: { name: "Our shop", address: "12 High Street\nBath BA1 1AA", hours: "Mon–Sat: 10am–6pm\nSun: 11am–4pm" },
};

export const MEDIA_BLOCKS: BlockDefinition[] = [imageCard, imagesStack, imageComparison, videoCard, productCard, productOverlayCard, press, newsletterForm, contactForm, share, countdown, storeLocator];
export const MEDIA_BLOCK_TYPES = MEDIA_BLOCKS.map((definition) => definition.type);
