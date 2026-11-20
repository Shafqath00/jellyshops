import { z } from "zod";
import { safeRichTextHref, type DynamicValueType } from "@jelly/storefront-schema";
import type { ControlDefinition, SectionDefinition } from "../types.js";
import { anyTemplatePage } from "./content.js";

/**
 * Showroom sections (docs/components/showroom.md): an offer panel with a code to copy, Shop by size drawn to scale,
 * Steps with real dates, and Fabric swatches. Built for bed and furniture stores; every theme can use them.
 */

const stringTypes = ["string", "text"] satisfies DynamicValueType[];
const urlTypes = ["url"] satisfies DynamicValueType[];
const imageReference = z.object({
  id: z.string().optional(),
  url: z.string().refine((value) => safeRichTextHref(value) !== null && !value.startsWith("#"), "Image URL must use a safe relative, HTTP, or HTTPS URL"),
  alt: z.string().optional(),
}).passthrough();
const link = z.string().max(500).optional();
const COUNTDOWN = /^$|^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/;

const eyebrow: ControlDefinition = { type: "text", key: "eyebrow", label: "Small text above the heading", group: "content", maxLength: 80 };
const heading: ControlDefinition = { type: "rich-text", inline: true, key: "heading", label: "Heading", description: "Make a word italic to make it stand out.", group: "content", maxLength: 120, dynamicTypes: stringTypes };
const text: ControlDefinition = { type: "rich-text", key: "text", label: "Text", group: "content", maxLength: 400, dynamicTypes: stringTypes };
const buttonLabel: ControlDefinition = { type: "text", key: "buttonLabel", label: "Button text", group: "content", maxLength: 40 };
const buttonLink: ControlDefinition = { type: "link", key: "buttonLink", label: "Button link", group: "content", dynamicTypes: urlTypes };
const alignment: ControlDefinition = { type: "segmented", key: "contentAlignment", label: "Heading alignment", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }] };

export const showroomSections: SectionDefinition[] = [
  {
    // A bold offer: a big number, a code to copy, an optional countdown and a photo with a floating label.
    type: "offer-panel", category: "content", supportedPages: [...anyTemplatePage],
    settingsSchema: z.object({
      eyebrow: z.string().max(80).optional(), heading: z.string().max(120).optional(), text: z.string().max(400).optional(),
      bigText: z.string().max(24).optional(), code: z.string().max(40).optional(), codeLabel: z.string().max(40).optional(),
      countdownTo: z.string().regex(COUNTDOWN).optional(), countdownEndText: z.string().max(80).optional(),
      image: imageReference.optional(), imageLabel: z.string().max(60).optional(), imagePosition: z.enum(["left", "right"]).optional(),
      buttonLabel: z.string().max(40).optional(), buttonLink: link,
    }).passthrough(),
    controls: [
      eyebrow,
      { type: "text", key: "bigText", label: "Big text", description: "Short and bold, for example: 30% off.", group: "content", maxLength: 24 },
      heading, text,
      { type: "text", key: "code", label: "Discount code", description: "Optional. Shoppers copy it with one tap.", group: "content", maxLength: 40 },
      { type: "text", key: "codeLabel", label: "Text before the code", group: "content", maxLength: 40 },
      { type: "text", key: "countdownTo", label: "Count down to", description: "Optional. Year-month-day and time in UK time, for example 2026-11-30 23:59.", group: "content", maxLength: 16 },
      { type: "text", key: "countdownEndText", label: "When the countdown ends", group: "content", maxLength: 80 },
      { type: "image", key: "image", label: "Photo", group: "content" },
      { type: "text", key: "imageLabel", label: "Label on the photo", description: "Optional, for example: Fabric: Cobalt velvet.", group: "content", maxLength: 60 },
      buttonLabel, buttonLink,
      { type: "segmented", key: "imagePosition", label: "Photo position", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Right", value: "right" }] },
    ],
    allowedBlockTypes: [],
    defaultSettings: { eyebrow: "Limited time", bigText: "20% off", heading: "Every bed, every size", text: "Add the code at checkout. Ends Sunday at midnight.", code: "SLEEP20", codeLabel: "Use code", buttonLabel: "Shop the offer", buttonLink: "/shop", imagePosition: "right", styleScheme: "scheme3" },
    defaultBlocks: [], responsiveFields: [],
    presets: [{ id: "offer-panel", label: "Offer panel", category: "marketing", description: "A bold offer with a big number, a code shoppers can copy and an optional countdown." }],
  },
  {
    // Sizes drawn to scale (a single next to a super king), each linking to the collection filtered by that size.
    type: "size-picker", category: "content", supportedPages: [...anyTemplatePage],
    settingsSchema: z.object({ eyebrow: z.string().max(80).optional(), heading: z.string().max(120).optional(), text: z.string().max(400).optional(), unit: z.enum(["cm", "ft"]).optional(), contentAlignment: z.enum(["left", "center"]).optional() }).passthrough(),
    controls: [
      eyebrow, heading, text,
      { type: "segmented", key: "unit", label: "Show sizes in", group: "content", options: [{ label: "Centimetres", value: "cm" }, { label: "Feet and inches", value: "ft" }] },
      alignment,
    ],
    allowedBlockTypes: ["size-option"], minBlocks: 1, maxBlocks: 8,
    defaultSettings: { eyebrow: "Shop by size", heading: "Find your fit", text: "Every size drawn to scale. Tap one to see the beds that come in it.", unit: "cm", contentAlignment: "left" },
    defaultBlocks: [
      { id: "size-single", type: "size-option", enabled: true, settings: { label: "Single", width: 90, length: 190, link: "/shop" } },
      { id: "size-small-double", type: "size-option", enabled: true, settings: { label: "Small double", width: 120, length: 190, link: "/shop" } },
      { id: "size-double", type: "size-option", enabled: true, settings: { label: "Double", width: 135, length: 190, note: "Most popular", link: "/shop" } },
      { id: "size-king", type: "size-option", enabled: true, settings: { label: "King", width: 150, length: 200, link: "/shop" } },
      { id: "size-super-king", type: "size-option", enabled: true, settings: { label: "Super king", width: 180, length: 200, link: "/shop" } },
    ],
    responsiveFields: [],
    presets: [{ id: "size-picker", label: "Shop by size", category: "products", description: "Sizes drawn to scale, each linking to the products in that size." }],
  },
  {
    // Numbered steps; with dates on, each step shows the day it happens ("In your room Thursday 26 Nov").
    type: "steps", category: "content", supportedPages: [...anyTemplatePage],
    settingsSchema: z.object({ eyebrow: z.string().max(80).optional(), heading: z.string().max(120).optional(), text: z.string().max(400).optional(), showDates: z.boolean().optional(), weekends: z.boolean().optional(), cutoffHour: z.number().int().min(0).max(23).optional(), contentAlignment: z.enum(["left", "center"]).optional() }).passthrough(),
    controls: [
      eyebrow, heading, text,
      { type: "checkbox", key: "showDates", label: "Show the date of each step", description: "Worked out from today in UK time, skipping weekends unless you tick the box below.", group: "content" },
      { type: "range", key: "cutoffHour", label: "Orders after this hour count as tomorrow", group: "content", min: 0, max: 23, step: 1, unit: ":00", visibleIf: { key: "showDates", equals: true } },
      { type: "checkbox", key: "weekends", label: "Count weekends", group: "content", visibleIf: { key: "showDates", equals: true } },
      alignment,
    ],
    allowedBlockTypes: ["step"], minBlocks: 1, maxBlocks: 6,
    defaultSettings: { eyebrow: "How it works", heading: "Order today, sleep on it this week", showDates: true, cutoffHour: 14, contentAlignment: "left" },
    defaultBlocks: [
      { id: "step-order", type: "step", enabled: true, settings: { title: "Order today", text: "Pick your bed, size and extras. Pay now or spread the cost.", icon: "card", days: 0 } },
      { id: "step-call", type: "step", enabled: true, settings: { title: "We call you", text: "Our team calls to book a two-hour delivery slot.", icon: "phone", days: 1 } },
      { id: "step-deliver", type: "step", enabled: true, settings: { title: "In your room", text: "Two people carry it to the room you choose and take the packaging away.", icon: "truck", days: 4 } },
    ],
    responsiveFields: [],
    presets: [{ id: "steps", label: "Steps", category: "content", description: "Numbered steps, optionally with the real date of each one." }],
  },
  {
    // Fabrics or colours as swatches; picking one shows its room photo large with a label.
    type: "swatch-showcase", category: "content", supportedPages: [...anyTemplatePage],
    settingsSchema: z.object({ eyebrow: z.string().max(80).optional(), heading: z.string().max(120).optional(), text: z.string().max(400).optional(), image: imageReference.optional(), imagePosition: z.enum(["left", "right"]).optional(), buttonLabel: z.string().max(40).optional(), buttonLink: link }).passthrough(),
    controls: [
      eyebrow, heading, text,
      { type: "image", key: "image", label: "Photo", description: "Shown until a shopper picks a swatch with a room photo.", group: "content" },
      buttonLabel, buttonLink,
      { type: "segmented", key: "imagePosition", label: "Photo position", group: "layout", options: [{ label: "Left", value: "left" }, { label: "Right", value: "right" }] },
    ],
    allowedBlockTypes: ["swatch"], minBlocks: 1, maxBlocks: 8,
    defaultSettings: { eyebrow: "Fabrics", heading: "Feel the difference", text: "Every frame comes in a choice of hard-wearing fabrics. Pick one to see it in a room.", imagePosition: "left", buttonLabel: "Order free swatches", buttonLink: "/contact" },
    defaultBlocks: [
      { id: "swatch-velvet", type: "swatch", enabled: true, settings: { name: "Velvet", color: "#2348E0", note: "Soft sheen" } },
      { id: "swatch-boucle", type: "swatch", enabled: true, settings: { name: "Boucle", color: "#F3E6C9", note: "Cosy loops" } },
      { id: "swatch-linen", type: "swatch", enabled: true, settings: { name: "Linen", color: "#FF7A45", note: "Washed and relaxed" } },
      { id: "swatch-weave", type: "swatch", enabled: true, settings: { name: "Weave", color: "#CFEFDF", note: "Hard-wearing" } },
    ],
    responsiveFields: [],
    presets: [{ id: "swatch-showcase", label: "Fabric swatches", category: "content", description: "Fabrics or colours as swatches; picking one shows it in a room." }],
  },
];
