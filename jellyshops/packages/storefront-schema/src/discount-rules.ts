/**
 * Discounts with no database and no zod: the shape of a discount, its state, a plain-English summary and the one
 * calculation used by the checkout, the bag page and the admin's sample-bag preview. The backend uses the packed copy.
 *
 * Calculation order (the same every time):
 *  1. Product discounts (Amount off products, Buy X get Y) work out what they take off each line. A line keeps only the
 *     largest product discount; ties go to the older discount.
 *  2. Order discounts take off the subtotal left after product discounts, oldest first (two 10% discounts = 19%).
 *  3. Free shipping makes delivery free.
 * Discounts only stack when each one allows the other's kind. When they can't all apply, the shopper gets the set that
 * saves the most; ties go to the set of older discounts, so the answer never changes between two identical bags.
 */

export type DiscountType = "product_amount" | "order_amount" | "buy_x_get_y" | "free_shipping";
export const DISCOUNT_TYPES: readonly DiscountType[] = ["product_amount", "order_amount", "buy_x_get_y", "free_shipping"];
export type DiscountMethod = "code" | "automatic";
export const DISCOUNT_METHODS: readonly DiscountMethod[] = ["code", "automatic"];
export type DiscountValueType = "percent" | "fixed";
/** Which kind a discount counts as when combining. */
export type DiscountClass = "product" | "order" | "shipping";
export type DiscountStatus = "active" | "scheduled" | "expired" | "used_up" | "disabled";

export interface ItemSelection {
  scope: "all" | "products" | "collections";
  productIds: string[];
  collectionIds: string[];
}

export type DiscountMinimum = { type: "none" } | { type: "amount"; amountMinor: number } | { type: "quantity"; quantity: number };

export type DiscountEligibility =
  | { scope: "everyone" }
  | { scope: "first_order" }
  | { scope: "tags"; tags: string[] }
  | { scope: "customers"; emails: string[] };

export interface DiscountCombinations { product: boolean; order: boolean; shipping: boolean }

export type BuyXGetYValue = { type: "free" } | { type: "percent"; percent: number } | { type: "fixed"; amountMinor: number };

export interface BuyXGetY {
  buys: { type: "quantity"; quantity: number } | { type: "amount"; amountMinor: number };
  buysItems: ItemSelection;
  getsQuantity: number;
  getsItems: ItemSelection;
  /** What each "get" item receives. */
  getsValue: BuyXGetYValue;
  /** How many times one order can use it; null = as often as the bag allows. */
  maxUsesPerOrder: number | null;
}

/** A discount as the calculation and the summary see it. Money is in minor units. */
export interface DiscountDefinition {
  id: string;
  title: string;
  method: DiscountMethod;
  /** The main code (method "code"), shown in summaries. */
  code: string | null;
  type: DiscountType;
  /** Amount off products / order only. */
  valueType: DiscountValueType | null;
  /** Percent 1-100 or minor units; 0 for free shipping and Buy X get Y. */
  value: number;
  /** Amount off products only. */
  appliesTo: ItemSelection;
  /** Amount off products, fixed only: take the amount off once per order instead of off every item. */
  appliesOncePerOrder: boolean;
  minimum: DiscountMinimum;
  eligibility: DiscountEligibility;
  combinesWith: DiscountCombinations;
  /** Free shipping only: no discount when delivery costs more than this. */
  maxShippingMinor: number | null;
  buyXGetY: BuyXGetY | null;
  usageLimit: number | null;
  oncePerCustomer: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  /** Breaks ties: older discounts win. */
  createdAt: Date;
}

export const ALL_ITEMS: ItemSelection = { scope: "all", productIds: [], collectionIds: [] };

export function discountClass(type: DiscountType): DiscountClass {
  return type === "order_amount" ? "order" : type === "free_shipping" ? "shipping" : "product";
}

/** Codes are matched without case or surrounding spaces. Returns null when it can never be a code. */
export function normaliseDiscountCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{2,40}$/.test(code) ? code : null;
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
/** A code that is easy to read aloud: no 0/O or 1/I. `random` returns 0 <= n < 1 (pass a crypto-backed one on the server). */
export function generateDiscountCode(random: () => number, length = 8, prefix = ""): string {
  let code = prefix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  for (let i = 0; i < length; i += 1) code += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length) % CODE_LETTERS.length];
  return code.slice(0, 40);
}

export function discountStatus(discount: Pick<DiscountDefinition, "active" | "startsAt" | "endsAt" | "usageLimit">, uses: number, now: Date): DiscountStatus {
  if (!discount.active) return "disabled";
  if (discount.endsAt && now >= discount.endsAt) return "expired";
  if (discount.usageLimit !== null && uses >= discount.usageLimit) return "used_up";
  if (discount.startsAt && now < discount.startsAt) return "scheduled";
  return "active";
}

/** True when two discounts may both apply to one order. */
export function discountsCombine(a: Pick<DiscountDefinition, "type" | "combinesWith">, b: Pick<DiscountDefinition, "type" | "combinesWith">): boolean {
  return a.combinesWith[discountClass(b.type)] && b.combinesWith[discountClass(a.type)];
}

// ---------------------------------------------------------------------------------------------------------------------
// Calculation

export interface DiscountCartLine {
  /** Unique per line (variant + configuration). */
  key: string;
  productId: string;
  collectionIds: string[];
  unitPriceMinor: number;
  quantity: number;
}

export interface DiscountCart {
  lines: DiscountCartLine[];
  shippingMinor: number;
  hasDelivery: boolean;
}

export interface DiscountCustomer {
  /** Lowercase email; unknown before the shopper types it. */
  email: string | null;
  /** The customer's tags (lowercase). */
  tags: string[];
  /** Earlier orders that weren't cancelled. */
  previousOrders: number;
}

export interface DiscountCandidate {
  discount: DiscountDefinition;
  /** The code the shopper typed (uppercase) when this candidate came from a code. */
  code: string | null;
  /** Orders that used the discount and weren't cancelled. */
  uses: number;
  /** The same, for this customer's email. */
  usesByCustomer: number;
}

export interface AppliedDiscountResult {
  discountId: string;
  title: string;
  code: string | null;
  type: DiscountType;
  /** Taken off the products. */
  amountMinor: number;
  /** Taken off delivery. */
  shippingMinor: number;
  /** What it took off each line, by line key. */
  lines: Record<string, number>;
}

export interface DiscountProblem {
  discountId: string | null;
  code: string | null;
  message: string;
}

export interface DiscountCalculation {
  subtotalMinor: number;
  /** Products + order discounts together. */
  discountMinor: number;
  shippingBeforeMinor: number;
  shippingMinor: number;
  totalMinor: number;
  applied: AppliedDiscountResult[];
  /** Why typed codes didn't apply (automatic discounts that don't fit are left out quietly). */
  problems: DiscountProblem[];
  /** Everything taken off each line (product share + order share), adding up to discountMinor. */
  lineDiscounts: Record<string, number>;
}

export interface CalculationOptions {
  now: Date;
  formatMoney: (minor: number) => string;
  /** Most automatic discounts considered together (the best standalone savings are kept). */
  maxAutomatic?: number;
}

function lineValue(line: DiscountCartLine): number {
  return line.unitPriceMinor * line.quantity;
}

export function selectionIncludes(selection: ItemSelection, line: Pick<DiscountCartLine, "productId" | "collectionIds">): boolean {
  if (selection.scope === "all") return true;
  if (selection.scope === "products") return selection.productIds.includes(line.productId);
  return line.collectionIds.some((id) => selection.collectionIds.includes(id));
}

/** Shares an amount across values in proportion; leftovers go to the largest values so the shares add up exactly. */
export function allocateAmount(values: readonly number[], amountMinor: number): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (amountMinor <= 0 || total <= 0) return values.map(() => 0);
  const capped = Math.min(amountMinor, total);
  const shares = values.map((value) => Math.floor((value * capped) / total));
  let left = capped - shares.reduce((sum, value) => sum + value, 0);
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index);
  for (let i = 0; left > 0; i = (i + 1) % order.length) {
    const { index } = order[i]!;
    if ((shares[index] ?? 0) < (values[index] ?? 0)) { shares[index] = (shares[index] ?? 0) + 1; left -= 1; }
  }
  return shares;
}

const percentOf = (minor: number, percent: number) => Math.round((minor * Math.min(100, Math.max(0, percent))) / 100);

/** What a product discount takes off each line on its own (before other discounts). */
function productAmounts(discount: DiscountDefinition, lines: DiscountCartLine[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (discount.type === "product_amount") {
    const eligible = lines.filter((line) => selectionIncludes(discount.appliesTo, line));
    if (discount.valueType === "percent") for (const line of eligible) out[line.key] = percentOf(lineValue(line), discount.value);
    else if (discount.appliesOncePerOrder) {
      const shares = allocateAmount(eligible.map(lineValue), discount.value);
      eligible.forEach((line, index) => { out[line.key] = shares[index] ?? 0; });
    } else for (const line of eligible) out[line.key] = Math.min(line.unitPriceMinor, discount.value) * line.quantity;
  } else if (discount.type === "buy_x_get_y" && discount.buyXGetY) Object.assign(out, buyXGetYAmounts(discount.buyXGetY, lines));
  for (const key of Object.keys(out)) if (!out[key]) delete out[key];
  return out;
}

interface Unit { key: string; price: number; buy: boolean; get: boolean; used: boolean }

/**
 * Buy X get Y, item by item: each use takes the most expensive qualifying "buy" items, then discounts the cheapest
 * "get" items that are left (so the shopper never gets the dearer item free). Spend-based offers apply once.
 */
export function buyXGetYAmounts(rule: BuyXGetY, lines: DiscountCartLine[]): Record<string, number> {
  const units: Unit[] = [];
  for (const line of lines) {
    const buy = selectionIncludes(rule.buysItems, line);
    const get = selectionIncludes(rule.getsItems, line);
    if (!buy && !get) continue;
    for (let i = 0; i < line.quantity; i += 1) units.push({ key: line.key, price: line.unitPriceMinor, buy, get, used: false });
  }
  const out: Record<string, number> = {};
  const discountFor = (price: number) => (rule.getsValue.type === "free" ? price : rule.getsValue.type === "percent" ? percentOf(price, rule.getsValue.percent) : Math.min(price, rule.getsValue.amountMinor));
  const maxUses = rule.buys.type === "amount" ? 1 : rule.maxUsesPerOrder ?? Number.MAX_SAFE_INTEGER;
  const byPriceDesc = (a: Unit, b: Unit) => b.price - a.price || a.key.localeCompare(b.key);
  const byPriceAsc = (a: Unit, b: Unit) => a.price - b.price || a.key.localeCompare(b.key);
  for (let use = 0; use < maxUses; use += 1) {
    let buysTaken: Unit[] = [];
    if (rule.buys.type === "quantity") {
      // Prefer buy items that can't also be a "get", so the most items stay free to discount.
      const candidates = units.filter((unit) => unit.buy && !unit.used).sort((a, b) => Number(a.get) - Number(b.get) || byPriceDesc(a, b));
      if (candidates.length < rule.buys.quantity) break;
      buysTaken = candidates.slice(0, rule.buys.quantity);
    } else {
      const candidates = units.filter((unit) => unit.buy && !unit.used);
      if (candidates.reduce((sum, unit) => sum + unit.price, 0) < rule.buys.amountMinor) break;
      // A spend offer doesn't use up the bought items, except that a free item can't count towards its own spend.
      buysTaken = [];
    }
    for (const unit of buysTaken) unit.used = true;
    const gets = units.filter((unit) => unit.get && !unit.used).sort(byPriceAsc).slice(0, rule.getsQuantity);
    if (rule.buys.type === "amount") {
      const spendWithoutGets = units.filter((unit) => unit.buy && !gets.includes(unit)).reduce((sum, unit) => sum + unit.price, 0);
      if (spendWithoutGets < rule.buys.amountMinor) break;
    }
    if (!gets.length) { for (const unit of buysTaken) unit.used = false; break; }
    for (const unit of gets) { unit.used = true; out[unit.key] = (out[unit.key] ?? 0) + discountFor(unit.price); }
  }
  return out;
}

/** Why a single discount can't apply to this bag on its own, or null when it can. */
export function discountProblemFor(candidate: DiscountCandidate, cart: DiscountCart, customer: DiscountCustomer, options: CalculationOptions): string | null {
  const { discount } = candidate;
  const notValid = "This code isn't valid.";
  const status = discountStatus(discount, candidate.uses, options.now);
  if (status === "disabled" || status === "scheduled") return notValid;
  if (status === "expired") return "This code has expired.";
  if (status === "used_up") return "This code has been used up.";
  const needsEmail = discount.oncePerCustomer || discount.eligibility.scope !== "everyone";
  if (needsEmail && !customer.email) return "Enter your email address first to use this code.";
  if (discount.oncePerCustomer && candidate.usesByCustomer > 0) return "You've already used this code.";
  const eligibility = discount.eligibility;
  if (eligibility.scope === "first_order" && customer.previousOrders > 0) return "This code is for first orders only.";
  if (eligibility.scope === "tags" && !eligibility.tags.some((tag) => customer.tags.includes(tag.toLowerCase()))) return "This code isn't available for your account.";
  if (eligibility.scope === "customers" && !eligibility.emails.some((email) => email.toLowerCase() === customer.email)) return "This code isn't available for your account.";

  const subtotal = cart.lines.reduce((sum, line) => sum + lineValue(line), 0);
  if (discount.type === "product_amount") {
    const eligible = cart.lines.filter((line) => selectionIncludes(discount.appliesTo, line));
    if (!eligible.length) return "This code doesn't apply to anything in your bag.";
    const spend = eligible.reduce((sum, line) => sum + lineValue(line), 0);
    const quantity = eligible.reduce((sum, line) => sum + line.quantity, 0);
    if (discount.minimum.type === "amount" && spend < discount.minimum.amountMinor) return `Spend ${options.formatMoney(discount.minimum.amountMinor)} or more on the items this code covers to use it.`;
    if (discount.minimum.type === "quantity" && quantity < discount.minimum.quantity) return `Add ${discount.minimum.quantity} or more of the items this code covers to use it.`;
  } else if (discount.type === "buy_x_get_y" && discount.buyXGetY) {
    const rule = discount.buyXGetY;
    if (!Object.keys(buyXGetYAmounts(rule, cart.lines)).length) {
      if (rule.buys.type === "quantity") return `Add ${rule.buys.quantity} qualifying ${rule.buys.quantity === 1 ? "item" : "items"} and the item you get to use this code.`;
      return `Spend ${options.formatMoney(rule.buys.amountMinor)} on qualifying items and add the item you get to use this code.`;
    }
  } else {
    if (discount.minimum.type === "amount" && subtotal < discount.minimum.amountMinor) return `Spend ${options.formatMoney(discount.minimum.amountMinor)} or more to use this code.`;
    if (discount.minimum.type === "quantity" && cart.lines.reduce((sum, line) => sum + line.quantity, 0) < discount.minimum.quantity) return `Add ${discount.minimum.quantity} or more items to use this code.`;
    if (discount.type === "free_shipping") {
      if (!cart.hasDelivery || cart.shippingMinor <= 0) return "There's nothing to pay for delivery in this order.";
      if (discount.maxShippingMinor !== null && cart.shippingMinor > discount.maxShippingMinor) return "This code doesn't cover this delivery charge.";
    }
    if (discount.type === "order_amount" && subtotal <= 0) return "This code doesn't apply to anything in your bag.";
  }
  return null;
}

const older = (a: DiscountDefinition, b: DiscountDefinition) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

interface Evaluated { applied: AppliedDiscountResult[]; saving: number; lineDiscounts: Record<string, number>; shippingMinor: number; valid: boolean }

function evaluate(set: DiscountCandidate[], cart: DiscountCart): Evaluated {
  const sorted = [...set].sort((a, b) => older(a.discount, b.discount));
  const applied = new Map<string, AppliedDiscountResult>();
  for (const candidate of sorted) {
    const { discount } = candidate;
    applied.set(discount.id, { discountId: discount.id, title: discount.title, code: candidate.code, type: discount.type, amountMinor: 0, shippingMinor: 0, lines: {} });
  }
  // 1. Product discounts: each line keeps its largest one.
  const lineDiscounts: Record<string, number> = {};
  const productSets = sorted.filter((candidate) => discountClass(candidate.discount.type) === "product").map((candidate) => ({ candidate, amounts: productAmounts(candidate.discount, cart.lines) }));
  for (const line of cart.lines) {
    let best: { id: string; amount: number } | null = null;
    for (const { candidate, amounts } of productSets) {
      const amount = Math.min(amounts[line.key] ?? 0, lineValue(line));
      if (amount > 0 && (!best || amount > best.amount)) best = { id: candidate.discount.id, amount };
    }
    if (best) {
      const result = applied.get(best.id)!;
      result.amountMinor += best.amount;
      result.lines[line.key] = best.amount;
      lineDiscounts[line.key] = best.amount;
    }
  }
  // A product discount that lost every line to a better one doesn't count as applied.
  let valid = productSets.every(({ candidate }) => (applied.get(candidate.discount.id)?.amountMinor ?? 0) > 0);
  // 2. Order discounts on what is left.
  for (const candidate of sorted.filter((item) => item.discount.type === "order_amount")) {
    const { discount } = candidate;
    const remaining = cart.lines.map((line) => lineValue(line) - (lineDiscounts[line.key] ?? 0));
    const left = remaining.reduce((sum, value) => sum + value, 0);
    if (discount.minimum.type === "amount" && left < discount.minimum.amountMinor) valid = false;
    const amount = Math.min(left, discount.valueType === "percent" ? percentOf(left, discount.value) : discount.value);
    if (amount <= 0) { valid = false; continue; }
    const shares = allocateAmount(remaining, amount);
    const result = applied.get(discount.id)!;
    result.amountMinor = amount;
    cart.lines.forEach((line, index) => {
      const share = shares[index] ?? 0;
      if (!share) return;
      result.lines[line.key] = share;
      lineDiscounts[line.key] = (lineDiscounts[line.key] ?? 0) + share;
    });
  }
  // 3. Free shipping (the minimum counts what is paid for the products after other discounts).
  let shippingMinor = cart.hasDelivery ? cart.shippingMinor : 0;
  const productsLeft = cart.lines.reduce((sum, line) => sum + lineValue(line) - (lineDiscounts[line.key] ?? 0), 0);
  for (const candidate of sorted.filter((item) => item.discount.type === "free_shipping")) {
    if (candidate.discount.minimum.type === "amount" && productsLeft < candidate.discount.minimum.amountMinor) { valid = false; continue; }
    if (shippingMinor <= 0) { valid = false; continue; }
    applied.get(candidate.discount.id)!.shippingMinor = shippingMinor;
    shippingMinor = 0;
  }
  const results = [...applied.values()];
  const saving = results.reduce((sum, result) => sum + result.amountMinor + result.shippingMinor, 0);
  return { applied: results, saving, lineDiscounts, shippingMinor, valid };
}

function pairwiseCombine(set: DiscountCandidate[]): boolean {
  for (let i = 0; i < set.length; i += 1) for (let j = i + 1; j < set.length; j += 1) if (!discountsCombine(set[i]!.discount, set[j]!.discount)) return false;
  return true;
}

/** "Older first" order of the ids in a set, used to break ties between two sets that save the same. */
function setKey(set: DiscountCandidate[]): string {
  return [...set].sort((a, b) => older(a.discount, b.discount)).map((candidate) => `${String(candidate.discount.createdAt.getTime()).padStart(15, "0")}:${candidate.discount.id}`).join("|");
}

/**
 * Works out every discount on a bag: the typed codes plus the store's automatic discounts. Pure and deterministic.
 * Codes that can't apply come back in `problems` with words for the shopper.
 */
export function calculateDiscounts(cart: DiscountCart, candidates: DiscountCandidate[], customer: DiscountCustomer, options: CalculationOptions): DiscountCalculation {
  const subtotalMinor = cart.lines.reduce((sum, line) => sum + lineValue(line), 0);
  const shippingBeforeMinor = cart.hasDelivery ? cart.shippingMinor : 0;
  const problems: DiscountProblem[] = [];
  const usable: DiscountCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.discount.id)) continue;
    seen.add(candidate.discount.id);
    const problem = discountProblemFor(candidate, cart, customer, options);
    if (problem) { if (candidate.code) problems.push({ discountId: candidate.discount.id, code: candidate.code, message: problem }); continue; }
    usable.push(candidate);
  }
  // Keep the work small: typed codes always, plus the automatic discounts that save the most on their own.
  const typed = usable.filter((candidate) => candidate.code);
  const automatic = usable.filter((candidate) => !candidate.code)
    .map((candidate) => ({ candidate, saving: evaluate([candidate], cart).saving }))
    .sort((a, b) => b.saving - a.saving || older(a.candidate.discount, b.candidate.discount))
    .slice(0, options.maxAutomatic ?? 10)
    .map((item) => item.candidate);
  const pool = [...typed, ...automatic].sort((a, b) => older(a.discount, b.discount));

  let best: { set: DiscountCandidate[]; result: Evaluated; key: string } | null = null;
  const total = 1 << pool.length;
  for (let mask = 1; mask < total; mask += 1) {
    const set = pool.filter((_, index) => mask & (1 << index));
    if (!pairwiseCombine(set)) continue;
    const result = evaluate(set, cart);
    if (!result.valid || result.saving <= 0) continue;
    const key = setKey(set);
    if (!best || result.saving > best.result.saving || (result.saving === best.result.saving && (set.length < best.set.length || (set.length === best.set.length && key < best.key)))) best = { set, result, key };
  }

  const chosen = best?.result;
  for (const candidate of typed) {
    if (best?.set.includes(candidate)) continue;
    const winner = best?.set.find((other) => !discountsCombine(other.discount, candidate.discount));
    problems.push({
      discountId: candidate.discount.id, code: candidate.code,
      message: winner ? `This code can't be used with "${winner.discount.title}", which saves you more.` : "This code doesn't apply to anything in your bag.",
    });
  }
  const applied = chosen ? chosen.applied.filter((result) => result.amountMinor > 0 || result.shippingMinor > 0) : [];
  const lineDiscounts = chosen?.lineDiscounts ?? {};
  const discountMinor = applied.reduce((sum, result) => sum + result.amountMinor, 0);
  const shippingMinor = chosen ? chosen.shippingMinor : shippingBeforeMinor;
  return { subtotalMinor, discountMinor, shippingBeforeMinor, shippingMinor, totalMinor: subtotalMinor - discountMinor + shippingMinor, applied, problems, lineDiscounts };
}

// ---------------------------------------------------------------------------------------------------------------------
// Words

export interface SummaryNames {
  products?: Record<string, string>;
  collections?: Record<string, string>;
}

export interface SummaryOptions {
  formatMoney: (minor: number) => string;
  timeZone: string;
  names?: SummaryNames;
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  product_amount: "Amount off products",
  order_amount: "Amount off order",
  buy_x_get_y: "Buy X get Y",
  free_shipping: "Free shipping",
};

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length > 3) return `${items.slice(0, 2).join(", ")} and ${items.length - 2} more`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function describeSelection(selection: ItemSelection, names: SummaryNames = {}, all = "all products"): string {
  if (selection.scope === "all") return all;
  if (selection.scope === "products") {
    const labels = selection.productIds.map((id) => names.products?.[id] ?? "a product");
    return selection.productIds.length === 0 ? "no products yet" : names.products ? listWords(labels) : `${selection.productIds.length} ${selection.productIds.length === 1 ? "product" : "products"}`;
  }
  const labels = selection.collectionIds.map((id) => names.collections?.[id] ?? "a collection");
  if (selection.collectionIds.length === 0) return "no collections yet";
  return names.collections ? `products in ${listWords(labels)}` : `products in ${selection.collectionIds.length} ${selection.collectionIds.length === 1 ? "collection" : "collections"}`;
}

function shortDate(date: Date, timeZone: string, withYear: boolean): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone }).format(date);
}

/** What the customer gets, in a few words: "20% off products in Summer", "Buy 2, get 1 free". */
export function describeDiscountValue(discount: Pick<DiscountDefinition, "type" | "valueType" | "value" | "appliesTo" | "appliesOncePerOrder" | "buyXGetY" | "maxShippingMinor">, options: Pick<SummaryOptions, "formatMoney" | "names">): string {
  const money = options.formatMoney;
  if (discount.type === "free_shipping") return discount.maxShippingMinor !== null ? `Free shipping on delivery up to ${money(discount.maxShippingMinor)}` : "Free shipping";
  if (discount.type === "buy_x_get_y" && discount.buyXGetY) {
    const rule = discount.buyXGetY;
    const buys = rule.buys.type === "quantity" ? `Buy ${rule.buys.quantity}` : `Spend ${money(rule.buys.amountMinor)}`;
    const from = describeSelection(rule.buysItems, options.names, "any products");
    const gets = rule.getsValue.type === "free" ? "free" : rule.getsValue.type === "percent" ? `at ${rule.getsValue.percent}% off` : `at ${money(rule.getsValue.amountMinor)} off`;
    const getsFrom = describeSelection(rule.getsItems, options.names, "any product");
    const same = JSON.stringify(rule.buysItems) === JSON.stringify(rule.getsItems);
    return `${buys} from ${from}, get ${rule.getsQuantity} ${same ? "more " : `from ${getsFrom} `}${gets}`.replace(/\s+/g, " ");
  }
  const amount = discount.valueType === "percent" ? `${discount.value}% off` : `${money(discount.value)} off`;
  if (discount.type === "order_amount") return `${amount} the whole order`;
  const each = discount.valueType === "fixed" ? (discount.appliesOncePerOrder ? " (once per order)" : " each") : "";
  return `${amount} ${describeSelection(discount.appliesTo, options.names)}${each}`;
}

/**
 * The whole discount in one plain sentence, for the form's live summary, the list and the detail page:
 * "20% off products in Summer, for customers who spend at least £50, from 1 Dec to 31 Dec 2026, limited to 100 uses".
 */
export function summariseDiscount(discount: Omit<DiscountDefinition, "id" | "createdAt" | "title" | "code" | "method"> & Partial<Pick<DiscountDefinition, "method" | "code">>, options: SummaryOptions): string {
  const parts = [describeDiscountValue(discount, options)];
  const minimum = discount.minimum;
  const scopeWord = discount.type === "product_amount" ? " on those items" : "";
  if (minimum.type === "amount") parts.push(`when the customer spends at least ${options.formatMoney(minimum.amountMinor)}${scopeWord}`);
  if (minimum.type === "quantity") parts.push(`when the customer buys at least ${minimum.quantity} ${minimum.quantity === 1 ? "item" : "items"}${scopeWord}`);
  const who = discount.eligibility;
  if (who.scope === "first_order") parts.push("for first orders only");
  if (who.scope === "tags") parts.push(`for customers tagged ${listWords(who.tags.map((tag) => `"${tag}"`))}`);
  if (who.scope === "customers") parts.push(`for ${who.emails.length} chosen ${who.emails.length === 1 ? "customer" : "customers"}`);
  const { startsAt, endsAt } = discount;
  if (startsAt && endsAt) {
    // A discount ending at midnight is described by its last whole day.
    const lastDay = new Date(endsAt.getTime() - 1);
    const year = (date: Date) => new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: options.timeZone }).format(date);
    parts.push(`from ${shortDate(startsAt, options.timeZone, year(startsAt) !== year(lastDay))} to ${shortDate(lastDay, options.timeZone, true)}`);
  } else if (startsAt) parts.push(`from ${shortDate(startsAt, options.timeZone, true)}`);
  else if (endsAt) parts.push(`until ${shortDate(new Date(endsAt.getTime() - 1), options.timeZone, true)}`);
  const limits: string[] = [];
  if (discount.usageLimit !== null) limits.push(`limited to ${discount.usageLimit} ${discount.usageLimit === 1 ? "use" : "uses"}`);
  if (discount.oncePerCustomer) limits.push("one use per customer");
  if (limits.length) parts.push(listWords(limits));
  if (discount.method === "automatic") parts.push("applied automatically");
  else if (discount.method === "code" && discount.code) parts.push(`with code ${discount.code}`);
  return parts.join(", ");
}
