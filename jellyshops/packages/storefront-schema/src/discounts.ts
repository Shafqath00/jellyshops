import { z } from "zod";
import { DISCOUNT_METHODS, DISCOUNT_TYPES, normaliseDiscountCode, type DiscountDefinition } from "./discount-rules.js";

/**
 * The save-time rules for a discount. The backend runs them on every save; the admin runs them too, to show the same
 * messages next to each field before sending. Every message is written for a shop owner.
 */

export const DISCOUNT_LIMITS = {
  title: 120,
  selection: 500,
  tags: 50,
  emails: 1000,
  maxMoneyMinor: 100_000_000,
  maxQuantity: 100_000,
  maxUsageLimit: 1_000_000,
} as const;

const L = DISCOUNT_LIMITS;
const id = z.string().trim().min(1).max(120);
const money = (label: string) => z.number({ message: `Enter ${label}.` }).int(`Enter ${label} in whole pence.`).min(1, `Enter ${label}.`).max(L.maxMoneyMinor, `${label[0]!.toUpperCase()}${label.slice(1)} is too large.`);
const count = (label: string, max: number = L.maxQuantity) => z.number({ message: `Enter ${label}.` }).int(`Use a whole number for ${label}.`).min(1, `${label[0]!.toUpperCase()}${label.slice(1)} must be at least 1.`).max(max, `${label[0]!.toUpperCase()}${label.slice(1)} can be up to ${max.toLocaleString("en-GB")}.`);

const selectionSchema = z.object({
  scope: z.enum(["all", "products", "collections"]),
  productIds: z.array(id).max(L.selection, `Choose up to ${L.selection} products.`).default([]),
  collectionIds: z.array(id).max(L.selection, `Choose up to ${L.selection} collections.`).default([]),
}).strict().superRefine((value, context) => {
  if (value.scope === "products" && !value.productIds.length) context.addIssue({ code: "custom", path: ["productIds"], message: "Choose at least one product." });
  if (value.scope === "collections" && !value.collectionIds.length) context.addIssue({ code: "custom", path: ["collectionIds"], message: "Choose at least one collection." });
});

const minimumSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }).strict(),
  z.object({ type: z.literal("amount"), amountMinor: money("a minimum amount") }).strict(),
  z.object({ type: z.literal("quantity"), quantity: count("a minimum number of items") }).strict(),
]);

const tag = z.string().trim().min(1).max(60).transform((value) => value.toLowerCase());
const email = z.string().trim().max(254).email("Check this email address.").transform((value) => value.toLowerCase());

const eligibilitySchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("everyone") }).strict(),
  z.object({ scope: z.literal("first_order") }).strict(),
  z.object({ scope: z.literal("tags"), tags: z.array(tag).min(1, "Add at least one customer tag.").max(L.tags, `Use up to ${L.tags} tags.`) }).strict(),
  z.object({ scope: z.literal("customers"), emails: z.array(email).min(1, "Choose at least one customer.").max(L.emails, `Choose up to ${L.emails.toLocaleString("en-GB")} customers.`) }).strict(),
]);

const combinationsSchema = z.object({ product: z.boolean(), order: z.boolean(), shipping: z.boolean() }).strict();

const bxgyValueSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("free") }).strict(),
  z.object({ type: z.literal("percent"), percent: z.number().int("Use a whole percentage.").min(1, "Use a percentage from 1 to 100.").max(100, "Use a percentage from 1 to 100.") }).strict(),
  z.object({ type: z.literal("fixed"), amountMinor: money("the amount off each item") }).strict(),
]);

const buyXGetYSchema = z.object({
  buys: z.discriminatedUnion("type", [
    z.object({ type: z.literal("quantity"), quantity: count("how many items the customer buys", 1000) }).strict(),
    z.object({ type: z.literal("amount"), amountMinor: money("how much the customer spends") }).strict(),
  ]),
  buysItems: selectionSchema,
  getsQuantity: count("how many items the customer gets", 1000),
  getsItems: selectionSchema,
  getsValue: bxgyValueSchema,
  maxUsesPerOrder: count("the most uses per order", 1000).nullable().default(null),
}).strict();

const dateText = z.string().max(40).refine((value) => !Number.isNaN(new Date(value).getTime()), "Check this date and time.");

export const discountInputSchema = z.object({
  title: z.string().trim().max(L.title, `The title can be up to ${L.title} characters.`).refine((value) => !/[\u0000-\u001f\u007f<>]/.test(value), "The title can't contain < or > or hidden characters.").default(""),
  method: z.enum(DISCOUNT_METHODS as [string, ...string[]]),
  code: z.string().max(60).nullable().optional(),
  type: z.enum(DISCOUNT_TYPES as [string, ...string[]]),
  valueType: z.enum(["percent", "fixed"]).nullable().optional(),
  value: z.number().int().min(0).max(L.maxMoneyMinor).optional(),
  appliesTo: selectionSchema.default({ scope: "all", productIds: [], collectionIds: [] }),
  appliesOncePerOrder: z.boolean().default(false),
  minimum: minimumSchema.default({ type: "none" }),
  eligibility: eligibilitySchema.default({ scope: "everyone" }),
  combinesWith: combinationsSchema.default({ product: false, order: false, shipping: false }),
  maxShippingMinor: money("the highest delivery charge to cover").nullable().optional(),
  buyXGetY: buyXGetYSchema.nullable().optional(),
  usageLimit: count("the total number of uses", L.maxUsageLimit).nullable().optional(),
  oncePerCustomer: z.boolean().default(false),
  startsAt: dateText.nullable().optional(),
  endsAt: dateText.nullable().optional(),
  active: z.boolean().default(true),
}).strict().superRefine((input, context) => {
  const add = (path: string, message: string) => context.addIssue({ code: "custom", path: path.split("."), message });
  if (input.method === "code" && !normaliseDiscountCode(input.code ?? "")) add("code", "Use 2 to 40 letters, numbers, dashes or underscores, with no spaces.");
  if (input.method === "automatic" && !input.title.trim()) add("title", "Give the discount a title. Customers see it in their bag and at checkout.");
  if (input.type === "product_amount" || input.type === "order_amount") {
    if (!input.valueType) add("valueType", "Choose a percentage or a fixed amount.");
    else if (input.valueType === "percent" && !(Number.isInteger(input.value) && input.value! >= 1 && input.value! <= 100)) add("value", "Use a whole percentage from 1 to 100.");
    else if (input.valueType === "fixed" && !(Number.isInteger(input.value) && input.value! >= 1)) add("value", "Enter the amount to take off.");
  }
  if (input.type === "buy_x_get_y" && !input.buyXGetY) add("buyXGetY", "Say what the customer buys and what they get.");
  if (input.appliesOncePerOrder && !(input.type === "product_amount" && input.valueType === "fixed")) add("appliesOncePerOrder", "Only a fixed amount off products can be taken once per order.");
  if (input.type === "buy_x_get_y" && input.minimum.type !== "none") add("minimum", "Buy X get Y sets its own minimum: what the customer buys.");
  if (input.maxShippingMinor != null && input.type !== "free_shipping") add("maxShippingMinor", "Only free shipping has a highest delivery charge.");
  if (input.startsAt && input.endsAt && new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) add("endsAt", "The end must be after the start.");
});

export type DiscountInput = z.input<typeof discountInputSchema>;

export interface DiscountFieldProblem { path: string; message: string }

/** Merchant input → the clean definition fields (without id/createdAt), or the problems by field path. */
export function validateDiscountInput(input: unknown):
  | { ok: true; value: Omit<DiscountDefinition, "id" | "createdAt"> }
  | { ok: false; problems: DiscountFieldProblem[] } {
  const parsed = discountInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.code === "unrecognized_keys" || issue.code === "invalid_value" || (issue.code === "invalid_type" && !issue.message.startsWith("Enter")) ? "This value isn't allowed." : issue.message,
      })),
    };
  }
  const data = parsed.data;
  const type = data.type as DiscountDefinition["type"];
  const amountType = type === "product_amount" || type === "order_amount";
  const code = data.method === "code" ? normaliseDiscountCode(data.code ?? "")! : null;
  return {
    ok: true,
    value: {
      title: data.title.trim() || code || "",
      method: data.method as DiscountDefinition["method"],
      code,
      type,
      valueType: amountType ? data.valueType! : null,
      value: amountType ? data.value! : 0,
      appliesTo: type === "product_amount" ? data.appliesTo : { scope: "all", productIds: [], collectionIds: [] },
      appliesOncePerOrder: data.appliesOncePerOrder,
      minimum: type === "buy_x_get_y" ? { type: "none" } : data.minimum,
      eligibility: data.eligibility,
      combinesWith: data.combinesWith,
      maxShippingMinor: type === "free_shipping" ? data.maxShippingMinor ?? null : null,
      buyXGetY: type === "buy_x_get_y" ? data.buyXGetY ?? null : null,
      usageLimit: data.usageLimit ?? null,
      oncePerCustomer: data.oncePerCustomer,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      active: data.active,
    },
  };
}
