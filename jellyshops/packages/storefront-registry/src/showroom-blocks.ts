import { z } from "zod";
import { COLOR_SETTING_PATTERN, STORE_ICON_LABELS, STORE_ICON_NAMES, settingValueSchema, type DynamicValueType } from "@jelly/storefront-schema";
import type { BlockDefinition } from "./types.js";

/**
 * Showroom blocks (docs/components/showroom.md): pieces made for large-ticket stores such as beds and furniture,
 * usable by every theme. The code chip is a general "@content" block; the others only go inside their section
 * (floating card in the hero, size option in Shop by size, step in Steps, swatch in Fabric swatches).
 */

const urlTypes = ["url"] satisfies DynamicValueType[];
const linkSchema = z.union([z.string(), settingValueSchema(z.string())]).optional();
const imageReference = z.object({ url: z.string(), alt: z.string().optional() }).passthrough();
const colorSchema = z.union([z.string().regex(COLOR_SETTING_PATTERN), z.literal("")]).optional();
const iconOptions = STORE_ICON_NAMES.map((value) => ({ label: STORE_ICON_LABELS[value], value }));

/** A discount code with a Copy button: "Use code SLEEP20". */
const codeChip: BlockDefinition = {
  type: "code-chip", sets: ["@content"],
  settingsSchema: z.object({ code: z.string().min(1).max(40), label: z.string().max(40).optional() }).passthrough(),
  controls: [
    { type: "text", key: "code", label: "Discount code", description: "Shoppers copy it with one tap and type it at checkout.", group: "content", maxLength: 40 },
    { type: "text", key: "label", label: "Text before the code", group: "content", maxLength: 40 },
  ],
  defaultSettings: { code: "WELCOME10", label: "Use code" },
};

/** A small card pinned over the hero photo: one product (photo, name, price, stars) or a note of your own. */
const floatingCard: BlockDefinition = {
  type: "floating-card",
  settingsSchema: z.object({
    productId: z.string().max(120).optional(), eyebrow: z.string().max(40).optional(), title: z.string().max(80).optional(),
    text: z.string().max(120).optional(), image: imageReference.optional(), link: linkSchema,
    position: z.union([z.enum(["bottom-right", "bottom-left", "top-right"]), z.literal("")]).optional(),
  }).passthrough(),
  controls: [
    { type: "product", key: "productId", label: "Product", description: "Shows its photo, name, price and stars. Leave empty and fill in the fields below for a note of your own, or for your first product.", group: "content" },
    { type: "text", key: "eyebrow", label: "Small text on top", group: "content", maxLength: 40 },
    { type: "text", key: "title", label: "Title", description: "Used when no product is chosen.", group: "content", maxLength: 80 },
    { type: "text", key: "text", label: "Text", group: "content", maxLength: 120 },
    { type: "image", key: "image", label: "Photo", group: "content" },
    { type: "link", key: "link", label: "Link", group: "content", dynamicTypes: urlTypes },
    { type: "segmented", key: "position", label: "Position", group: "layout", options: [{ label: "Bottom right", value: "bottom-right" }, { label: "Bottom left", value: "bottom-left" }, { label: "Top right", value: "top-right" }] },
  ],
  defaultSettings: { eyebrow: "Shop the look", position: "bottom-right" },
};

/** One size in Shop by size, drawn to scale from its width and length. */
const sizeOption: BlockDefinition = {
  type: "size-option",
  settingsSchema: z.object({
    label: z.string().min(1).max(40), width: z.number().min(40).max(300), length: z.number().min(100).max(300).optional(),
    note: z.string().max(60).optional(), link: linkSchema,
  }).passthrough(),
  controls: [
    { type: "text", key: "label", label: "Size name", group: "content", maxLength: 40 },
    { type: "number", key: "width", label: "Width (cm)", group: "content", min: 40, max: 300, step: 1 },
    { type: "number", key: "length", label: "Length (cm)", group: "content", min: 100, max: 300, step: 1 },
    { type: "text", key: "note", label: "Note", description: "Optional, for example: Most popular.", group: "content", maxLength: 60 },
    { type: "link", key: "link", label: "Link", description: "For example your beds collection filtered by this size.", group: "content", dynamicTypes: urlTypes },
  ],
  defaultSettings: { label: "Double", width: 135, length: 190 },
};

/** One step in Steps: a title, a line of text and, when the section shows dates, how many working days from today. */
const step: BlockDefinition = {
  type: "step",
  settingsSchema: z.object({ title: z.string().min(1).max(80), text: z.string().max(240).optional(), icon: z.enum(STORE_ICON_NAMES).optional(), days: z.number().int().min(0).max(30).optional() }).passthrough(),
  controls: [
    { type: "text", key: "title", label: "Title", group: "content", maxLength: 80 },
    { type: "textarea", key: "text", label: "Text", group: "content", maxLength: 240 },
    { type: "select", key: "icon", label: "Icon", group: "content", options: iconOptions },
    { type: "range", key: "days", label: "Working days from today", description: "Used when the section shows dates. 0 is today.", group: "content", min: 0, max: 30, step: 1 },
  ],
  defaultSettings: { title: "Order today", text: "Choose your size and add any extras.", icon: "card", days: 0 },
};

/** One fabric or colour in Fabric swatches. */
const swatch: BlockDefinition = {
  type: "swatch",
  settingsSchema: z.object({ name: z.string().min(1).max(40), color: colorSchema, image: imageReference.optional(), photo: imageReference.optional(), note: z.string().max(80).optional(), link: linkSchema }).passthrough(),
  controls: [
    { type: "text", key: "name", label: "Name", group: "content", maxLength: 40 },
    { type: "color", key: "color", label: "Colour", description: "Used when there is no close-up photo.", group: "content", allowAlpha: false },
    { type: "image", key: "image", label: "Close-up of the fabric", group: "content" },
    { type: "image", key: "photo", label: "Room photo", description: "Optional. Shown large when a shopper picks this swatch.", group: "content" },
    { type: "text", key: "note", label: "Note", description: "Optional, for example: Soft sheen, easy to clean.", group: "content", maxLength: 80 },
    { type: "link", key: "link", label: "Link", group: "content", dynamicTypes: urlTypes },
  ],
  defaultSettings: { name: "Velvet", color: "#2348E0" },
};

export const SHOWROOM_BLOCKS: BlockDefinition[] = [codeChip, floatingCard, sizeOption, step, swatch];
