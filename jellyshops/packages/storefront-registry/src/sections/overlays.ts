import { z } from "zod";
import { safeRichTextHref } from "@jelly/storefront-schema";
import type { SectionDefinition } from "../types.js";
import { anyTemplatePage } from "./content.js";

/**
 * Overlay sections (theme plan T6 part 2): drawn on top of every page from the store's overlay group, never placed
 * on a page template. The pop-up is drawn by the renderer; the slide-out bag's settings are read by the store's bag
 * drawer, so the section itself only draws an editor preview.
 */
const imageReference = z.object({
  id: z.string().optional(),
  url: z.string().refine((value) => safeRichTextHref(value) !== null && !value.startsWith("#"), "Image URL must use a safe relative, HTTP, or HTTPS URL"),
  alt: z.string().optional(),
}).passthrough();

const overlayOnly = { enabledOn: { pages: [...anyTemplatePage], groups: ["overlay" as const] } };

export const overlaySections: SectionDefinition[] = [
  {
    type: "popup", category: "content", supportedPages: [...anyTemplatePage], ...overlayOnly,
    settingsSchema: z.object({
      delaySeconds: z.number().int().min(0).max(120).optional(),
      showAgainDays: z.number().int().min(1).max(365).optional(),
      position: z.enum(["centre", "corner"]).optional(),
      image: imageReference.optional(),
    }).passthrough(),
    controls: [
      { type: "range", key: "delaySeconds", label: "Show after", group: "content", min: 0, max: 120, step: 1, unit: "s", description: "Seconds after a shopper arrives. 0 shows it straight away." },
      { type: "range", key: "showAgainDays", label: "Show again after", group: "content", min: 1, max: 365, step: 1, unit: "days", description: "A shopper who closes it doesn't see it again for this many days." },
      { type: "segmented", key: "position", label: "Position", group: "layout", options: [{ label: "Centre", value: "centre" }, { label: "Corner", value: "corner" }] },
      { type: "image", key: "image", label: "Photo (optional)", group: "content" },
    ],
    allowedBlockTypes: ["@content", "@app"], maxBlocks: 8,
    defaultSettings: { delaySeconds: 5, showAgainDays: 14, position: "centre" },
    defaultBlocks: [
      { id: "popup-heading", type: "heading", enabled: true, settings: { text: "Get 10% off your first order" } },
      { id: "popup-text", type: "text", enabled: true, settings: { text: "Join our list for new arrivals and members-only offers." } },
      { id: "popup-signup", type: "newsletter-form", enabled: true, settings: {} },
    ],
    responsiveFields: [],
    presets: [{ id: "popup", label: "Pop-up", category: "marketing", description: "A message that opens over the page, for example an email sign-up offer." }],
  },
  {
    type: "cart-drawer", category: "commerce", supportedPages: [...anyTemplatePage], ...overlayOnly, limit: 1,
    settingsSchema: z.object({
      style: z.enum(["drawer", "sheet"]).optional(),
      heading: z.string().max(60).optional(),
      emptyText: z.string().max(160).optional(),
      freeDeliveryFrom: z.number().min(0).max(100000).optional(),
    }).passthrough(),
    controls: [
      { type: "segmented", key: "style", label: "On phones", group: "layout", options: [{ label: "Slides in from the side", value: "drawer" }, { label: "Rises from the bottom", value: "sheet" }] },
      { type: "text", key: "heading", label: "Heading", group: "content", maxLength: 60 },
      { type: "text", key: "emptyText", label: "When the bag is empty", group: "content", maxLength: 160 },
      { type: "number", key: "freeDeliveryFrom", label: "Free delivery from (0 hides the progress bar)", group: "content", min: 0, max: 100000, step: 1 },
    ],
    allowedBlockTypes: [],
    defaultSettings: { style: "drawer", heading: "Your bag", emptyText: "Your bag is empty.", freeDeliveryFrom: 0 },
    defaultBlocks: [],
    responsiveFields: [],
    presets: [{ id: "cart-drawer", label: "Slide-out bag", category: "products", description: "Add to cart and the bag icon open the bag over the page instead of going to the bag page." }],
  },
];
