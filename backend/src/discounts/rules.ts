/**
 * Discount code rules with no database: what a code looks like, how much it takes off,
 * and how that amount is shared across order lines (refunds and order edits read the share).
 */

export type DiscountKind = "percent" | "fixed" | "free_shipping";
export const DISCOUNT_KINDS: readonly DiscountKind[] = ["percent", "fixed", "free_shipping"];

export interface DiscountRule {
  code: string;
  kind: DiscountKind;
  /** Percent 1-100, or minor units for "fixed"; 0 for free delivery. */
  value: number;
  minimumSubtotalMinor: number | null;
  usageLimit: number | null;
  oncePerCustomer: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
}

export interface DiscountedTotals {
  /** Taken off the products (never more than the subtotal). */
  discountMinor: number;
  /** Delivery after the code (0 for a free delivery code). */
  shippingMinor: number;
  totalMinor: number;
}

const CODE_PATTERN = /^[A-Z0-9_-]{2,40}$/;

/** Codes are matched without case or surrounding spaces: " summer10 " is "SUMMER10". Returns null when it can never be a code. */
export function normaliseDiscountCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** Works out the order totals with a code that is already known to apply. */
export function applyDiscount(rule: Pick<DiscountRule, "kind" | "value">, subtotalMinor: number, shippingMinor: number): DiscountedTotals {
  let discountMinor = 0;
  let shipping = shippingMinor;
  if (rule.kind === "percent") discountMinor = Math.round((subtotalMinor * Math.min(100, Math.max(0, rule.value))) / 100);
  else if (rule.kind === "fixed") discountMinor = Math.min(subtotalMinor, Math.max(0, rule.value));
  else shipping = 0;
  discountMinor = Math.min(discountMinor, subtotalMinor);
  return { discountMinor, shippingMinor: shipping, totalMinor: subtotalMinor - discountMinor + shipping };
}

/** Why a code can't be used right now, in words for the shopper; null when it can. */
export function discountProblem(
  rule: DiscountRule,
  context: { subtotalMinor: number; hasDelivery: boolean; uses: number; usesByCustomer: number; now: Date; formatMoney: (minor: number) => string },
): string | null {
  const notValid = "This code isn't valid.";
  if (!rule.active) return notValid;
  if (rule.startsAt && context.now < rule.startsAt) return notValid;
  if (rule.endsAt && context.now >= rule.endsAt) return "This code has expired.";
  if (rule.usageLimit !== null && context.uses >= rule.usageLimit) return "This code has been used up.";
  if (rule.oncePerCustomer && context.usesByCustomer > 0) return "You've already used this code.";
  if (rule.minimumSubtotalMinor !== null && context.subtotalMinor < rule.minimumSubtotalMinor) return `This code needs an order of ${context.formatMoney(rule.minimumSubtotalMinor)} or more.`;
  if (rule.kind === "free_shipping" && !context.hasDelivery) return "There's nothing to deliver in this order.";
  return null;
}

/** Shares a discount across lines by line value; rounding leftovers go to the largest lines so the shares add up exactly. */
export function allocateDiscount(lineTotals: readonly number[], discountMinor: number): number[] {
  const total = lineTotals.reduce((sum, value) => sum + value, 0);
  if (discountMinor <= 0 || total <= 0) return lineTotals.map(() => 0);
  const capped = Math.min(discountMinor, total);
  const shares = lineTotals.map((value) => Math.floor((value * capped) / total));
  let left = capped - shares.reduce((sum, value) => sum + value, 0);
  const order = lineTotals.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value || a.index - b.index);
  for (let i = 0; left > 0; i = (i + 1) % order.length) {
    const { index } = order[i]!;
    if ((shares[index] ?? 0) < (lineTotals[index] ?? 0)) { shares[index] = (shares[index] ?? 0) + 1; left -= 1; }
  }
  return shares;
}

/** Short words for a code, for the merchant list and the checkout summary: "10% off", "£5.00 off", "Free delivery". */
export function describeDiscount(rule: Pick<DiscountRule, "kind" | "value">, formatMoney: (minor: number) => string): string {
  if (rule.kind === "percent") return `${rule.value}% off`;
  if (rule.kind === "fixed") return `${formatMoney(rule.value)} off`;
  return "Free delivery";
}
