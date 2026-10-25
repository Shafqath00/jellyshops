import type { ProductOption, ProductVariant } from "../domain";
import { findConditionProblems } from "./conditions";

export const MAX_VARIANT_AXES = 3;
export const MAX_VARIANTS = 100;

export type DraftIssue = { severity: "error" | "warning"; code: string; message: string; optionId?: string; variantId?: string };

export type ProductDraftInput = {
  title: string;
  options: ProductOption[];
  inventoryOptionIds: string[];
  variants: ProductVariant[];
  mediaCount?: number;
};

const norm = (text: string) => text.trim().toLowerCase();

/** Dry-run validation shared by the builder UI and the API. Errors block publishing; warnings never do. */
export function validateProductDraft(draft: ProductDraftInput): { errors: DraftIssue[]; warnings: DraftIssue[]; issues: DraftIssue[] } {
  const issues: DraftIssue[] = [];
  const error = (code: string, message: string, extra: Partial<DraftIssue> = {}) => issues.push({ severity: "error", code, message, ...extra });
  const warn = (code: string, message: string, extra: Partial<DraftIssue> = {}) => issues.push({ severity: "warning", code, message, ...extra });

  if (!draft.title.trim()) error("title_required", "Give your product a name.");

  const names = new Set<string>();
  for (const option of draft.options) {
    const label = option.name.trim() || "An unnamed choice";
    if (!option.name.trim()) error("option_name_required", "Every choice needs a name.", { optionId: option.id });
    else if (names.has(norm(option.name))) error("option_name_duplicate", `You have two choices called "${option.name}".`, { optionId: option.id });
    names.add(norm(option.name));

    if (option.values.length === 0) error("option_values_required", `${label} needs at least one value.`, { optionId: option.id });
    const labels = new Set<string>();
    for (const value of option.values) {
      if (!value.label.trim()) error("value_label_required", `${label} has a value with no name.`, { optionId: option.id });
      else if (labels.has(norm(value.label))) error("value_label_duplicate", `${label} lists "${value.label}" twice.`, { optionId: option.id });
      labels.add(norm(value.label));
    }
    if (option.type === "variant" && option.multiple) error("variant_multiple", `${label} tracks stock per value, so customers can only pick one.`, { optionId: option.id });
    if (option.minSelect !== undefined && option.maxSelect !== undefined && option.minSelect > option.maxSelect) error("select_range", `${label}: the minimum is higher than the maximum.`, { optionId: option.id });
    if (option.maxSelect !== undefined && option.maxSelect > option.values.length) warn("select_max_exceeds_values", `${label}: the maximum is more than the number of values.`, { optionId: option.id });
  }

  for (const id of draft.inventoryOptionIds) {
    const option = draft.options.find((candidate) => candidate.id === id);
    if (!option) error("inventory_option_missing", "A stock-tracked choice no longer exists.", { optionId: id });
    else if (option.type !== "variant") error("inventory_option_not_variant", `${option.name || "A choice"} is marked as tracking stock but is not a variant option.`, { optionId: id });
  }

  const axes = draft.options.filter((option) => option.type === "variant" && draft.inventoryOptionIds.includes(option.id) && option.values.length > 0);
  if (axes.length > MAX_VARIANT_AXES) error("too_many_axes", `Stock can be tracked for at most ${MAX_VARIANT_AXES} choices. Make one of them an extra choice instead.`);
  const combinations = axes.reduce((count, option) => count * option.values.length, 1);
  if (axes.length > 0 && combinations > MAX_VARIANTS) error("too_many_variants", `This setup creates ${combinations} variants (the limit is ${MAX_VARIANTS}). Turn a choice into an extra choice or remove values.`);

  for (const problem of findConditionProblems(draft.options)) error(`condition_${problem.code}`, problem.message, { optionId: problem.optionId });

  const live = draft.variants;
  if (live.length === 0) error("variant_required", "A product needs a price.");
  const skus = new Map<string, number>();
  for (const variant of live) {
    if (!Number.isFinite(variant.priceMinor) || variant.priceMinor < 0) error("variant_price", `${variant.name || "A variant"} needs a valid price.`, { variantId: variant.id });
    if (variant.stock < 0) error("variant_stock", `${variant.name || "A variant"} has negative stock.`, { variantId: variant.id });
    if (variant.sku.trim()) skus.set(norm(variant.sku), (skus.get(norm(variant.sku)) ?? 0) + 1);
    else if (axes.length > 0) warn("variant_sku_missing", `${variant.name} has no SKU.`, { variantId: variant.id });
  }
  for (const [sku, count] of skus) if (count > 1) error("variant_sku_duplicate", `SKU "${sku}" is used by ${count} variants.`);

  if (draft.mediaCount === 0) warn("no_photos", "Products with photos sell better. Add at least one.");

  return { errors: issues.filter((i) => i.severity === "error"), warnings: issues.filter((i) => i.severity === "warning"), issues };
}
