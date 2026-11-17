import { z } from "zod";
import { STORE_ICON_LABELS, STORE_ICON_NAMES, settingValueSchema } from "@jelly/storefront-schema";
import type { BlockDefinition } from "./types.js";

/**
 * Blocks for the product page's buying column (theme plan T5, docs/template-analysis.md section 6.4). The
 * "@product" ones need the product being shown, so only Main product takes them; the notice is a general
 * "@content" block that suits the buying column best.
 */

const PRODUCT: BlockDefinition["sets"] = ["@product"];
const linkSchema = z.union([z.string(), settingValueSchema(z.string())]).optional();
const choice = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.enum(values), z.literal("")]).optional();
const options = (...pairs: Array<[string, string]>) => pairs.map(([value, label]) => ({ label, value }));

/** Home / Shop / This product, above the title. */
const breadcrumbs: BlockDefinition = {
  type: "product-breadcrumbs", sets: PRODUCT,
  settingsSchema: z.object({ shopLabel: z.string().max(40).optional() }).passthrough(),
  controls: [{ type: "text", key: "shopLabel", label: "Shop link text", description: "The middle step, which links to all your products.", group: "content", maxLength: 40 }],
  defaultSettings: { shopLabel: "Shop" },
};

/** "Order in the next 3 hours for delivery Tue 12 – Thu 14 Nov", worked out in the shopper's browser in UK time. */
const deliveryEstimate: BlockDefinition = {
  type: "delivery-estimate", sets: PRODUCT,
  settingsSchema: z.object({
    cutoffHour: z.number().int().min(0).max(23).optional(),
    dispatchDays: z.number().int().min(0).max(10).optional(),
    deliveryMin: z.number().int().min(0).max(30).optional(),
    deliveryMax: z.number().int().min(0).max(30).optional(),
    weekendDispatch: z.boolean().optional(),
  }).passthrough(),
  controls: [
    { type: "range", key: "cutoffHour", label: "Same-day dispatch cut-off", description: "Orders before this hour (UK time) count as today.", group: "content", min: 0, max: 23, step: 1, unit: ":00" },
    { type: "range", key: "dispatchDays", label: "Working days to dispatch", group: "content", min: 0, max: 10, step: 1 },
    { type: "range", key: "deliveryMin", label: "Delivery takes at least (working days)", group: "content", min: 0, max: 30, step: 1 },
    { type: "range", key: "deliveryMax", label: "Delivery takes at most (working days)", group: "content", min: 0, max: 30, step: 1 },
    { type: "checkbox", key: "weekendDispatch", label: "Dispatch and deliver at weekends", group: "content" },
  ],
  defaultSettings: { cutoffHour: 14, dispatchDays: 0, deliveryMin: 2, deliveryMax: 4 },
};

/** A few small product rows ("Pairs well with"), from the same recommendations as Related products. */
const complementaryProducts: BlockDefinition = {
  type: "complementary-products", sets: PRODUCT,
  settingsSchema: z.object({ heading: z.string().max(80).optional(), limit: z.number().int().min(1).max(6).optional() }).passthrough(),
  controls: [
    { type: "text", key: "heading", label: "Heading", group: "content", maxLength: 80 },
    { type: "range", key: "limit", label: "Products to show", group: "content", min: 1, max: 6, step: 1 },
  ],
  defaultSettings: { heading: "Pairs well with", limit: 3 },
};

/** A short coloured note with an icon, such as a promotion or a delivery message. */
const notice: BlockDefinition = {
  type: "notice", sets: ["@content"],
  settingsSchema: z.object({ text: z.string().max(200), icon: z.enum(STORE_ICON_NAMES).optional(), link: linkSchema, linkLabel: z.string().max(40).optional(), tone: choice(["info", "success", "warning", "sale"] as const) }).passthrough(),
  controls: [
    { type: "text", key: "text", label: "Message", group: "content", maxLength: 200 },
    { type: "select", key: "icon", label: "Icon", group: "content", options: STORE_ICON_NAMES.map((value) => ({ label: STORE_ICON_LABELS[value], value })) },
    { type: "text", key: "linkLabel", label: "Link text", group: "content", maxLength: 40 },
    { type: "link", key: "link", label: "Link", group: "content", dynamicTypes: ["url"] },
    { type: "segmented", key: "tone", label: "Colour", group: "style", options: options(["info", "Calm"], ["success", "Good news"], ["warning", "Heads up"], ["sale", "Sale"]) },
  ],
  defaultSettings: { text: "Use code WELCOME10 for 10% off your first order.", icon: "tag", tone: "sale" },
};

export const PRODUCT_BLOCKS: BlockDefinition[] = [breadcrumbs, deliveryEstimate, complementaryProducts, notice];
export const PRODUCT_BLOCK_TYPES = PRODUCT_BLOCKS.map((definition) => definition.type);
