/**
 * Quantity rules on a product: a minimum order, steps (sold in sixes) and a most per order. The product page, the bag
 * and checkout share these rules so they agree on which quantities a shopper may buy. They apply to each variant
 * (each size or colour on its own), adding up every bag line of that variant.
 */

export const MAX_QUANTITY_RULE_VALUE = 999;

export interface QuantityRule {
  /** The smallest quantity a shopper may buy (1 = no minimum). */
  min: number;
  /** Quantities go up in this step (6 = 6, 12, 18 …). The minimum and the most are multiples of it. */
  step: number;
  /** The most a shopper may buy in one order; absent = no limit. */
  max?: number;
}

export const NO_QUANTITY_RULE: QuantityRule = { min: 1, step: 1 };

const whole = (value: unknown): number | undefined => (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_QUANTITY_RULE_VALUE ? value : undefined);

/** The rule as stored on the product; anything missing or malformed means "no rule" for that part. */
export function readQuantityRule(value: unknown): QuantityRule {
  if (!value || typeof value !== "object") return { ...NO_QUANTITY_RULE };
  const raw = value as Record<string, unknown>;
  const step = whole(raw.step) ?? 1;
  const min = whole(raw.min) ?? step;
  const max = whole(raw.max);
  return max === undefined ? { min, step } : { min, step, max };
}

export function hasQuantityRule(rule: QuantityRule): boolean {
  return rule.min > 1 || rule.step > 1 || rule.max !== undefined;
}

/** Problems with a rule the merchant entered, in plain words (empty = fine). */
export function quantityRuleProblems(rule: QuantityRule): string[] {
  const problems: string[] = [];
  if (!whole(rule.min) || !whole(rule.step) || (rule.max !== undefined && !whole(rule.max))) problems.push(`Quantities must be whole numbers from 1 to ${MAX_QUANTITY_RULE_VALUE}.`);
  else {
    if (rule.min % rule.step !== 0) problems.push(`The minimum must be a multiple of the step (${rule.step}).`);
    if (rule.max !== undefined && rule.max % rule.step !== 0) problems.push(`The most per order must be a multiple of the step (${rule.step}).`);
    if (rule.max !== undefined && rule.max < rule.min) problems.push("The most per order can't be less than the minimum.");
  }
  return problems;
}

/** Why a quantity is not allowed, in plain words, or undefined when it is. */
export function quantityProblem(rule: QuantityRule, quantity: number, productName = "This product"): string | undefined {
  if (!Number.isInteger(quantity) || quantity < 1) return "Choose a quantity of at least 1.";
  if (quantity < rule.min) return `${productName} has a minimum order of ${rule.min}.`;
  if (quantity % rule.step !== 0) return `${productName} is sold in steps of ${rule.step}.`;
  if (rule.max !== undefined && quantity > rule.max) return `You can buy at most ${rule.max} of ${productName === "This product" ? "this product" : productName}.`;
  return undefined;
}

/**
 * The nearest allowed quantity to the one asked for, never above `limit` (stock left); undefined when no allowed
 * quantity fits (the stock left is under the minimum).
 */
export function allowedQuantity(rule: QuantityRule, quantity: number, limit = Number.POSITIVE_INFINITY): number | undefined {
  const top = Math.min(rule.max ?? Number.POSITIVE_INFINITY, limit);
  const highest = Number.isFinite(top) ? Math.floor(top / rule.step) * rule.step : Number.POSITIVE_INFINITY;
  if (highest < rule.min) return undefined;
  const wanted = Math.max(rule.min, Number.isFinite(quantity) ? quantity : rule.min);
  const rounded = Math.round(wanted / rule.step) * rule.step;
  return Math.min(Math.max(rounded, rule.min), highest);
}

/** "Minimum 6 · in steps of 6 · at most 48", for the product page and the bag; empty without a rule. */
export function quantityRuleText(rule: QuantityRule): string {
  const parts: string[] = [];
  if (rule.min > 1 && rule.min !== rule.step) parts.push(`Minimum ${rule.min}`);
  if (rule.step > 1) parts.push(rule.min === rule.step ? `Sold in steps of ${rule.step}` : `in steps of ${rule.step}`);
  if (rule.max !== undefined) parts.push(`at most ${rule.max}`);
  const text = parts.join(" · ");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}
