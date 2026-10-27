import { majorToMinor } from "@/lib/domain";

/** Units a seller can measure a product in, grouped by what they measure (only same-group units can be compared). */
export const UNIT_GROUPS: Record<string, { label: string; units: Array<{ id: string; label: string }> }> = {
  mass: { label: "Weight", units: [{ id: "mg", label: "mg" }, { id: "g", label: "g" }, { id: "kg", label: "kg" }] },
  volume: { label: "Volume", units: [{ id: "ml", label: "ml" }, { id: "cl", label: "cl" }, { id: "l", label: "l" }] },
  length: { label: "Length", units: [{ id: "mm", label: "mm" }, { id: "cm", label: "cm" }, { id: "m", label: "m" }] },
  area: { label: "Area", units: [{ id: "m2", label: "m²" }] },
  count: { label: "Count", units: [{ id: "item", label: "item" }] },
};
export const unitGroupOf = (unit: string) => Object.entries(UNIT_GROUPS).find(([, group]) => group.units.some((entry) => entry.id === unit))?.[0];
const unitLabel = (unit: string) => Object.values(UNIT_GROUPS).flatMap((group) => group.units).find((entry) => entry.id === unit)?.label ?? unit;

/** Multiplier to a group's smallest unit, so 500 g and 1 kg can be compared. */
const FACTOR: Record<string, number> = { mg: 1, g: 1000, kg: 1_000_000, ml: 1, cl: 10, l: 1000, mm: 1, cm: 10, m: 1000, m2: 1, item: 1 };

export interface UnitPricingDraft { totalAmount: string; totalUnit: string; baseAmount: string; baseUnit: string }
export const emptyUnitPricing: UnitPricingDraft = { totalAmount: "", totalUnit: "g", baseAmount: "100", baseUnit: "g" };
export interface UnitPricingValue { totalAmount: number; totalUnit: string; baseAmount: number; baseUnit: string }

const positive = (text: string) => { const value = Number(text.trim()); return text.trim() !== "" && Number.isFinite(value) && value > 0 ? value : undefined; };

/** Null when the seller left unit pricing blank; a message when it is half-filled or inconsistent. */
export function parseUnitPricing(draft: UnitPricingDraft | undefined): { value: UnitPricingValue | null; error?: string } {
  if (!draft || (!draft.totalAmount.trim() && draft.baseAmount === emptyUnitPricing.baseAmount && draft.totalUnit === emptyUnitPricing.totalUnit && draft.baseUnit === emptyUnitPricing.baseUnit)) return { value: null };
  const totalAmount = positive(draft.totalAmount), baseAmount = positive(draft.baseAmount);
  if (!totalAmount) return { value: null, error: "Enter how much the product contains, like 500." };
  if (!baseAmount) return { value: null, error: "Enter the amount to price against, like 100." };
  if (unitGroupOf(draft.totalUnit) !== unitGroupOf(draft.baseUnit)) return { value: null, error: "The two units must measure the same thing, like g and kg." };
  return { value: { totalAmount, totalUnit: draft.totalUnit, baseAmount, baseUnit: draft.baseUnit } };
}

/** Price per base amount in minor units, e.g. £10 for 500 g shown per 100 g is 200. */
export function unitPriceMinor(priceMinor: number, unit: UnitPricingValue): number {
  const totalInBase = (unit.totalAmount * FACTOR[unit.totalUnit]) / (unit.baseAmount * FACTOR[unit.baseUnit]);
  return Math.round(priceMinor / totalInBase);
}
export const unitPriceLabel = (formattedPrice: string, unit: UnitPricingValue) => `${formattedPrice} / ${unit.baseAmount} ${unitLabel(unit.baseUnit)}`;

/** Profit and margin from the selling price and the seller's own cost. Margin is profit as a share of price. */
export function profitSummary(priceText: string, costText: string): { profitMinor: number; marginPercent: number | null } | null {
  if (!costText.trim() || !priceText.trim()) return null;
  const price = majorToMinor(priceText), cost = majorToMinor(costText);
  if (!Number.isFinite(price) || !Number.isFinite(cost) || price < 0 || cost < 0) return null;
  return { profitMinor: price - cost, marginPercent: price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null };
}
