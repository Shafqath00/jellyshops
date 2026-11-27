/**
 * The discount form as plain data: what the merchant has typed (money and numbers as text), how it becomes the API
 * input, the problems by field, and warnings. No React here, so all of it is unit-tested.
 */
import {
  ALL_ITEMS, discountsCombine, normaliseDiscountCode, validateDiscountInput,
  type DiscountDefinition, type DiscountInput, type DiscountMethod, type DiscountType, type ItemSelection,
} from "@jelly/storefront-schema";
import type { MerchantDiscount } from "./api";
import type { DiscountTemplate } from "./templates";

export interface DiscountDraft {
  method: DiscountMethod;
  type: DiscountType;
  title: string;
  code: string;
  valueType: "percent" | "fixed";
  percent: string;
  amount: string;
  appliesTo: ItemSelection;
  appliesOncePerOrder: boolean;
  minimumType: "none" | "amount" | "quantity";
  minimumAmount: string;
  minimumQuantity: string;
  eligibility: "everyone" | "first_order" | "tags" | "customers";
  tags: string[];
  /** Lowercase emails. */
  customers: string[];
  limitTotal: boolean;
  usageLimit: string;
  oncePerCustomer: boolean;
  combinesWith: { product: boolean; order: boolean; shipping: boolean };
  limitShipping: boolean;
  maxShipping: string;
  buysType: "quantity" | "amount";
  buysQuantity: string;
  buysAmount: string;
  buysItems: ItemSelection;
  getsQuantity: string;
  getsItems: ItemSelection;
  getsValue: "free" | "percent" | "fixed";
  getsPercent: string;
  getsAmount: string;
  limitUsesPerOrder: boolean;
  maxUsesPerOrder: string;
  /** Dates and times in the shop's time zone: "2026-12-01", "09:00". */
  startDate: string;
  startTime: string;
  hasEnd: boolean;
  endDate: string;
  endTime: string;
  active: boolean;
}

// --- Time zones --------------------------------------------------------------------------------------------------

function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
}

/** "2026-12-01" + "09:00" read as a wall-clock time in `timeZone` (summer time included). Null when not a real date. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time || "00:00");
  if (!day || !clock) return null;
  const wall = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]), Number(clock[1]), Number(clock[2]));
  if (Number.isNaN(wall)) return null;
  let instant = wall - zoneOffsetMs(wall, timeZone);
  instant = wall - zoneOffsetMs(instant, timeZone);
  return new Date(instant);
}

/** An instant as the shop's wall-clock date and time. */
export function utcToZoned(iso: string | Date, timeZone: string): { date: string; time: string } {
  const instant = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const local = new Date(instant + zoneOffsetMs(instant, timeZone));
  const pad = (value: number) => String(value).padStart(2, "0");
  return { date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`, time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}` };
}

/** "Europe/London" → "UK time (Europe/London)"; others as "Asia/Kolkata time". */
export function timeZoneName(timeZone: string): string {
  return timeZone === "Europe/London" ? "UK time" : `${timeZone.replace(/_/g, " ")} time`;
}

// --- Money and numbers -------------------------------------------------------------------------------------------

/** "5", "5.5", "£5.50", "1,200" → minor units; null when empty, NaN when not a sensible amount. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[£$€₹,\s]/g, "");
  if (!clean) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN;
  return Math.round(Number(clean) * 100);
}

export function moneyText(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

function parseCount(text: string): number | null {
  const clean = text.trim();
  if (!clean) return null;
  return /^\d+$/.test(clean) ? Number(clean) : Number.NaN;
}

// --- Building drafts ---------------------------------------------------------------------------------------------

const NO_COMBINATIONS = { product: false, order: false, shipping: false };

/** A blank draft for a type and method, starting today (the merchant can change it). */
export function blankDraft(type: DiscountType, method: DiscountMethod, timeZone: string, now = new Date()): DiscountDraft {
  const start = utcToZoned(now, timeZone);
  return {
    method, type, title: "", code: "",
    valueType: "percent", percent: type === "product_amount" || type === "order_amount" ? "10" : "", amount: "",
    appliesTo: type === "product_amount" ? { scope: "collections", productIds: [], collectionIds: [] } : ALL_ITEMS, appliesOncePerOrder: false,
    minimumType: "none", minimumAmount: "", minimumQuantity: "",
    eligibility: "everyone", tags: [], customers: [],
    limitTotal: false, usageLimit: "", oncePerCustomer: false,
    combinesWith: type === "free_shipping" ? { product: true, order: true, shipping: false } : { ...NO_COMBINATIONS, shipping: true },
    limitShipping: false, maxShipping: "",
    buysType: "quantity", buysQuantity: "1", buysAmount: "", buysItems: { scope: "products", productIds: [], collectionIds: [] },
    getsQuantity: "1", getsItems: { scope: "products", productIds: [], collectionIds: [] }, getsValue: "free", getsPercent: "50", getsAmount: "", limitUsesPerOrder: true, maxUsesPerOrder: "1",
    startDate: start.date, startTime: start.time, hasEnd: false, endDate: "", endTime: "23:59",
    active: true,
  };
}

/** A draft from the type picker's address: a template, or a type and method. */
export function draftFromChoice(choice: { type: DiscountType; method: DiscountMethod; template?: DiscountTemplate }, timeZone: string, now = new Date()): DiscountDraft {
  const draft = blankDraft(choice.type, choice.method, timeZone, now);
  if (!choice.template) return draft;
  const input = choice.template.input;
  return applyInput(draft, input, timeZone);
}

/** An existing discount as a draft. */
export function draftFromDiscount(discount: MerchantDiscount, timeZone: string): DiscountDraft {
  const draft = blankDraft(discount.type, discount.method, timeZone, discount.startsAt ? new Date(discount.startsAt) : new Date(discount.createdAt));
  const next = applyInput(draft, { ...discount, code: discount.code ?? undefined }, timeZone);
  if (!discount.startsAt) { const created = utcToZoned(discount.createdAt, timeZone); next.startDate = created.date; next.startTime = created.time; }
  return next;
}

function applyInput(draft: DiscountDraft, input: DiscountInput | (Omit<MerchantDiscount, "code"> & { code?: string }), timeZone: string): DiscountDraft {
  const next = { ...draft };
  next.method = input.method as DiscountMethod;
  next.type = input.type as DiscountType;
  next.title = input.title && input.title !== input.code ? input.title : "";
  next.code = input.code ?? "";
  if (input.valueType) next.valueType = input.valueType;
  if (input.valueType === "percent") next.percent = String(input.value ?? "");
  if (input.valueType === "fixed") next.amount = moneyText(input.value ?? null);
  if (input.appliesTo) next.appliesTo = { scope: input.appliesTo.scope, productIds: [...(input.appliesTo.productIds ?? [])], collectionIds: [...(input.appliesTo.collectionIds ?? [])] };
  next.appliesOncePerOrder = Boolean(input.appliesOncePerOrder);
  const minimum = input.minimum ?? { type: "none" };
  next.minimumType = minimum.type;
  if (minimum.type === "amount") next.minimumAmount = moneyText(minimum.amountMinor);
  if (minimum.type === "quantity") next.minimumQuantity = String(minimum.quantity);
  const eligibility = input.eligibility ?? { scope: "everyone" };
  next.eligibility = eligibility.scope;
  if (eligibility.scope === "tags") next.tags = [...eligibility.tags];
  if (eligibility.scope === "customers") next.customers = [...eligibility.emails];
  next.limitTotal = input.usageLimit != null;
  next.usageLimit = input.usageLimit != null ? String(input.usageLimit) : "";
  next.oncePerCustomer = Boolean(input.oncePerCustomer);
  if (input.combinesWith) next.combinesWith = { ...NO_COMBINATIONS, ...input.combinesWith };
  next.limitShipping = input.maxShippingMinor != null;
  next.maxShipping = moneyText(input.maxShippingMinor ?? null);
  const rule = input.buyXGetY;
  if (rule) {
    next.buysType = rule.buys.type;
    if (rule.buys.type === "quantity") next.buysQuantity = String(rule.buys.quantity); else next.buysAmount = moneyText(rule.buys.amountMinor);
    next.buysItems = { scope: rule.buysItems.scope, productIds: [...(rule.buysItems.productIds ?? [])], collectionIds: [...(rule.buysItems.collectionIds ?? [])] };
    next.getsQuantity = String(rule.getsQuantity);
    next.getsItems = { scope: rule.getsItems.scope, productIds: [...(rule.getsItems.productIds ?? [])], collectionIds: [...(rule.getsItems.collectionIds ?? [])] };
    next.getsValue = rule.getsValue.type;
    if (rule.getsValue.type === "percent") next.getsPercent = String(rule.getsValue.percent);
    if (rule.getsValue.type === "fixed") next.getsAmount = moneyText(rule.getsValue.amountMinor);
    next.limitUsesPerOrder = rule.maxUsesPerOrder != null;
    next.maxUsesPerOrder = rule.maxUsesPerOrder != null ? String(rule.maxUsesPerOrder) : "1";
  }
  if (input.startsAt) { const start = utcToZoned(String(input.startsAt), timeZone); next.startDate = start.date; next.startTime = start.time; }
  next.hasEnd = Boolean(input.endsAt);
  if (input.endsAt) { const end = utcToZoned(String(input.endsAt), timeZone); next.endDate = end.date; next.endTime = end.time; }
  next.active = input.active ?? true;
  return next;
}

// --- Checking and building the API input -------------------------------------------------------------------------

/** Field ids, so problems land under the right control. */
export type DraftField =
  | "title" | "code" | "value" | "appliesTo" | "minimum" | "eligibility" | "usageLimit" | "maxShipping"
  | "buysQuantity" | "buysAmount" | "buysItems" | "getsQuantity" | "getsItems" | "getsValue" | "maxUsesPerOrder" | "startsAt" | "endsAt" | "form";

export type DraftProblems = Partial<Record<DraftField, string>>;

/** Where a server or shared-rule problem path belongs in the form. */
export function fieldForPath(path: string): DraftField {
  if (path === "title" || path === "code") return path;
  if (path === "value" || path === "valueType" || path === "appliesOncePerOrder") return "value";
  if (path.startsWith("appliesTo")) return "appliesTo";
  if (path.startsWith("minimum")) return "minimum";
  if (path.startsWith("eligibility")) return "eligibility";
  if (path === "usageLimit") return "usageLimit";
  if (path === "maxShippingMinor") return "maxShipping";
  if (path.startsWith("buyXGetY.buys.")) return path.endsWith("amountMinor") ? "buysAmount" : "buysQuantity";
  if (path.startsWith("buyXGetY.buysItems")) return "buysItems";
  if (path.startsWith("buyXGetY.getsQuantity")) return "getsQuantity";
  if (path.startsWith("buyXGetY.getsItems")) return "getsItems";
  if (path.startsWith("buyXGetY.getsValue")) return "getsValue";
  if (path.startsWith("buyXGetY.maxUsesPerOrder")) return "maxUsesPerOrder";
  if (path === "startsAt") return "startsAt";
  if (path === "endsAt") return "endsAt";
  return "form";
}

/** The draft as the API input, or what is wrong with it (in the merchant's words, by field). */
export function draftToInput(draft: DiscountDraft, timeZone: string): { input?: DiscountInput; problems: DraftProblems } {
  const problems: DraftProblems = {};
  const money = (text: string, field: DraftField, what: string) => {
    const value = parseMoney(text);
    if (value === null) { problems[field] ??= `Enter ${what}.`; return 0; }
    if (Number.isNaN(value) || value <= 0) { problems[field] ??= `Enter ${what} like 5 or 5.50.`; return 0; }
    return value;
  };
  const count = (text: string, field: DraftField, what: string) => {
    const value = parseCount(text);
    if (value === null || Number.isNaN(value) || value < 1) { problems[field] ??= `Enter ${what} as a whole number, 1 or more.`; return 1; }
    return value;
  };

  const amountType = draft.type === "product_amount" || draft.type === "order_amount";
  let value = 0;
  if (amountType && draft.valueType === "percent") {
    const percent = parseCount(draft.percent);
    if (percent === null || Number.isNaN(percent) || percent < 1 || percent > 100) problems.value = "Enter a whole percentage from 1 to 100.";
    else value = percent;
  }
  if (amountType && draft.valueType === "fixed") value = money(draft.amount, "value", "the amount to take off");

  const minimum: DiscountInput["minimum"] = draft.type === "buy_x_get_y" || draft.minimumType === "none" ? { type: "none" }
    : draft.minimumType === "amount" ? { type: "amount", amountMinor: money(draft.minimumAmount, "minimum", "the minimum amount") }
    : { type: "quantity", quantity: count(draft.minimumQuantity, "minimum", "the minimum number of items") };

  const startsAt = zonedToUtc(draft.startDate, draft.startTime, timeZone);
  if (!startsAt) problems.startsAt = "Choose a start date.";
  const endsAt = draft.hasEnd ? zonedToUtc(draft.endDate, draft.endTime, timeZone) : null;
  if (draft.hasEnd && !endsAt) problems.endsAt = "Choose an end date, or untick \"Set an end date\".";
  if (startsAt && endsAt && endsAt <= startsAt) problems.endsAt = "The end must be after the start.";

  const eligibility: DiscountInput["eligibility"] = draft.eligibility === "tags" ? { scope: "tags", tags: draft.tags }
    : draft.eligibility === "customers" ? { scope: "customers", emails: draft.customers }
    : { scope: draft.eligibility };

  const input: DiscountInput = {
    method: draft.method,
    code: draft.method === "code" ? draft.code.trim().toUpperCase() : null,
    title: draft.title.trim(),
    type: draft.type,
    ...(amountType ? { valueType: draft.valueType, value } : {}),
    ...(draft.type === "product_amount" ? { appliesTo: draft.appliesTo, appliesOncePerOrder: draft.valueType === "fixed" && draft.appliesOncePerOrder } : {}),
    minimum,
    eligibility,
    combinesWith: draft.combinesWith,
    ...(draft.type === "free_shipping" && draft.limitShipping ? { maxShippingMinor: money(draft.maxShipping, "maxShipping", "the highest delivery charge") } : {}),
    ...(draft.type === "buy_x_get_y" ? {
      buyXGetY: {
        buys: draft.buysType === "quantity" ? { type: "quantity", quantity: count(draft.buysQuantity, "buysQuantity", "how many items they buy") } : { type: "amount", amountMinor: money(draft.buysAmount, "buysAmount", "how much they spend") },
        buysItems: draft.buysItems,
        getsQuantity: count(draft.getsQuantity, "getsQuantity", "how many items they get"),
        getsItems: draft.getsItems,
        getsValue: draft.getsValue === "free" ? { type: "free" }
          : draft.getsValue === "percent" ? { type: "percent", percent: (() => { const percent = parseCount(draft.getsPercent); if (percent === null || Number.isNaN(percent) || percent < 1 || percent > 100) { problems.getsValue ??= "Enter a whole percentage from 1 to 100."; return 1; } return percent; })() }
          : { type: "fixed", amountMinor: money(draft.getsAmount, "getsValue", "the amount off each item") },
        maxUsesPerOrder: draft.limitUsesPerOrder ? count(draft.maxUsesPerOrder, "maxUsesPerOrder", "how many times one order can use it") : null,
      },
    } : {}),
    usageLimit: draft.limitTotal ? count(draft.usageLimit, "usageLimit", "the total number of uses") : null,
    oncePerCustomer: draft.oncePerCustomer,
    startsAt: startsAt?.toISOString() ?? null,
    endsAt: endsAt?.toISOString() ?? null,
    active: draft.active,
  };

  // The same rules the server runs, for everything not already reported above.
  const checked = validateDiscountInput(input);
  if (!checked.ok) for (const problem of checked.problems) problems[fieldForPath(problem.path)] ??= problem.message;
  if (draft.method === "code" && !normaliseDiscountCode(draft.code)) problems.code ??= "Use 2 to 40 letters, numbers, dashes or underscores, with no spaces.";
  return Object.keys(problems).length ? { problems } : { input, problems };
}

/**
 * The draft as a definition for the live summary, filling gaps with sensible stand-ins so the sentence still reads
 * while the merchant is typing ("…% off" stays out: an unreadable value shows as 0).
 */
export function draftPreview(draft: DiscountDraft, timeZone: string): Omit<DiscountDefinition, "id" | "createdAt"> {
  const percent = Number(draft.percent) || 0;
  const amount = parseMoney(draft.amount) || 0;
  const minimumAmount = parseMoney(draft.minimumAmount) || 0;
  return {
    title: draft.title, method: draft.method, code: draft.code.trim().toUpperCase() || null, type: draft.type,
    valueType: draft.type === "product_amount" || draft.type === "order_amount" ? draft.valueType : null,
    value: draft.valueType === "percent" ? percent : amount,
    appliesTo: draft.appliesTo, appliesOncePerOrder: draft.appliesOncePerOrder,
    minimum: draft.type === "buy_x_get_y" || draft.minimumType === "none" ? { type: "none" } : draft.minimumType === "amount" ? { type: "amount", amountMinor: minimumAmount } : { type: "quantity", quantity: Number(draft.minimumQuantity) || 0 },
    eligibility: draft.eligibility === "tags" ? { scope: "tags", tags: draft.tags } : draft.eligibility === "customers" ? { scope: "customers", emails: draft.customers } : { scope: draft.eligibility },
    combinesWith: draft.combinesWith,
    maxShippingMinor: draft.limitShipping ? parseMoney(draft.maxShipping) || 0 : null,
    buyXGetY: draft.type === "buy_x_get_y" ? {
      buys: draft.buysType === "quantity" ? { type: "quantity", quantity: Number(draft.buysQuantity) || 0 } : { type: "amount", amountMinor: parseMoney(draft.buysAmount) || 0 },
      buysItems: draft.buysItems, getsQuantity: Number(draft.getsQuantity) || 0, getsItems: draft.getsItems,
      getsValue: draft.getsValue === "free" ? { type: "free" } : draft.getsValue === "percent" ? { type: "percent", percent: Number(draft.getsPercent) || 0 } : { type: "fixed", amountMinor: parseMoney(draft.getsAmount) || 0 },
      maxUsesPerOrder: draft.limitUsesPerOrder ? Number(draft.maxUsesPerOrder) || 1 : null,
    } : null,
    usageLimit: draft.limitTotal ? Number(draft.usageLimit) || 0 : null,
    oncePerCustomer: draft.oncePerCustomer,
    startsAt: zonedToUtc(draft.startDate, draft.startTime, timeZone),
    endsAt: draft.hasEnd ? zonedToUtc(draft.endDate, draft.endTime, timeZone) : null,
    active: draft.active,
  };
}

// --- Warnings ----------------------------------------------------------------------------------------------------

export interface DraftWarning { id: string; tone: "warning" | "info"; message: string }

/** Things worth knowing before saving (nothing here stops a save). */
export function draftWarnings(draft: DiscountDraft, context: {
  timeZone: string;
  now: Date;
  /** The shop's other discounts (the one being edited left out). */
  others: MerchantDiscount[];
  /** Products by id: whether each is on sale. */
  products?: Record<string, { title: string; active: boolean }>;
  /** True when the code is used by another discount. */
  codeTaken?: boolean;
}): DraftWarning[] {
  const warnings: DraftWarning[] = [];
  const preview = draftPreview(draft, context.timeZone);
  if (preview.endsAt && preview.endsAt <= context.now) warnings.push({ id: "ended", tone: "warning", message: "The end date has already passed, so customers can't use this discount. Change or remove the end date." });
  else if (preview.startsAt && preview.startsAt > context.now) warnings.push({ id: "scheduled", tone: "info", message: "This discount is scheduled. It starts on its start date and you don't need to do anything else." });
  if (!draft.active) warnings.push({ id: "off", tone: "info", message: "This discount is switched off. Customers can't use it until you switch it on." });
  if (context.codeTaken) warnings.push({ id: "code", tone: "warning", message: "Another discount already uses this code. Choose a different one." });

  const amountType = draft.type === "product_amount" || draft.type === "order_amount";
  if (amountType && draft.valueType === "percent" && Number(draft.percent) === 100) warnings.push({ id: "free", tone: "warning", message: "100% off makes the items free. Orders must still come to at least 50p to be paid by card, or checkout refuses them." });

  // Chosen products that aren't on sale (drafts or archived).
  const chosen = [
    ...(draft.type === "product_amount" && draft.appliesTo.scope === "products" ? draft.appliesTo.productIds : []),
    ...(draft.type === "buy_x_get_y" ? [draft.buysItems, draft.getsItems].flatMap((items) => (items.scope === "products" ? items.productIds : [])) : []),
  ];
  if (context.products && chosen.length) {
    const off = chosen.filter((id) => context.products![id] && !context.products![id]!.active);
    if (off.length === chosen.length) warnings.push({ id: "no-products", tone: "warning", message: "None of the chosen products are on sale, so this discount can't apply to anything yet." });
    else if (off.length) warnings.push({ id: "some-products", tone: "info", message: `${off.length} chosen ${off.length === 1 ? "product isn't" : "products aren't"} on sale (${off.slice(0, 3).map((id) => context.products![id]!.title).join(", ")}).` });
  }

  // Automatic discounts that run at the same time and don't combine with this one.
  const mine = { type: draft.type, combinesWith: draft.combinesWith };
  const overlaps = context.others.filter((other) => other.method === "automatic" && (other.status === "active" || other.status === "scheduled")
    && timesOverlap(preview.startsAt, preview.endsAt, other.startsAt ? new Date(other.startsAt) : null, other.endsAt ? new Date(other.endsAt) : null)
    && !discountsCombine(mine, other));
  if (overlaps.length) {
    const names = overlaps.slice(0, 2).map((other) => `"${other.title}"`).join(" and ");
    warnings.push({ id: "overlap", tone: "info", message: `${names}${overlaps.length > 2 ? ` and ${overlaps.length - 2} more` : ""} ${overlaps.length === 1 ? "runs" : "run"} automatically at the same time and can't be combined with this discount. Customers get whichever saves them more.` });
  }
  return warnings;
}

function timesOverlap(startA: Date | null, endA: Date | null, startB: Date | null, endB: Date | null): boolean {
  const a0 = startA?.getTime() ?? -Infinity, a1 = endA?.getTime() ?? Infinity;
  const b0 = startB?.getTime() ?? -Infinity, b1 = endB?.getTime() ?? Infinity;
  return a0 < b1 && b0 < a1;
}
