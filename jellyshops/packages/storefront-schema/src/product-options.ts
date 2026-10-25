/**
 * Rules for product choices (size, colour, extras), shared by the merchant builder, the storefront and the API
 * so all three agree on what a valid product and a valid shopper selection look like.
 * Types are structural so the browser's `ProductOption` and the API's JSON both fit.
 */

export const MAX_VARIANT_AXES = 3;
export const MAX_VARIANTS = 100;

export interface ProductOptionValueLike { id: string; label: string; priceAdjustmentMinor?: number }
export interface ProductOptionConditionLike { optionId: string; valueIds: string[] }
export interface ProductOptionLike {
  id: string;
  name: string;
  type: "variant" | "configuration" | "addon";
  required: boolean;
  multiple?: boolean;
  minSelect?: number;
  maxSelect?: number;
  visibleWhen?: ProductOptionConditionLike;
  values: ProductOptionValueLike[];
}
export interface OptionSelection { optionId: string; valueId: string }

/* ───────────────────────── conditions ───────────────────────── */

export type ConditionProblem = { optionId: string; code: "self_reference" | "unknown_option" | "unknown_value" | "cycle"; message: string };

/** Options whose condition is met by the current selections, resolved through chains of conditions. */
export function getVisibleOptions<T extends ProductOptionLike>(options: T[], selections: OptionSelection[]): T[] {
  const byId = new Map(options.map((option) => [option.id, option]));
  const memo = new Map<string, boolean>();
  const visible = (option: T, trail: Set<string>): boolean => {
    const cached = memo.get(option.id);
    if (cached !== undefined) return cached;
    const condition = option.visibleWhen;
    let result = true;
    if (condition) {
      const controller = byId.get(condition.optionId);
      if (!controller || trail.has(option.id)) result = false;
      else result = visible(controller, new Set(trail).add(option.id)) && selections.some((selection) => selection.optionId === condition.optionId && condition.valueIds.includes(selection.valueId));
    }
    memo.set(option.id, result);
    return result;
  };
  return options.filter((option) => visible(option, new Set()));
}

/** Drops selections that belong to choices hidden by their condition. */
export function dropHiddenSelections<T extends ProductOptionLike>(options: T[], selections: OptionSelection[]): OptionSelection[] {
  const visibleIds = new Set(getVisibleOptions(options, selections).map((option) => option.id));
  return selections.filter((selection) => visibleIds.has(selection.optionId) || !options.some((option) => option.id === selection.optionId));
}

/** Structural problems with the conditions themselves: bad references and cycles. */
export function findConditionProblems(options: ProductOptionLike[]): ConditionProblem[] {
  const byId = new Map(options.map((option) => [option.id, option]));
  const problems: ConditionProblem[] = [];
  for (const option of options) {
    const condition = option.visibleWhen;
    if (!condition) continue;
    if (condition.optionId === option.id) {
      problems.push({ optionId: option.id, code: "self_reference", message: `"${option.name}" cannot depend on itself.` });
      continue;
    }
    const controller = byId.get(condition.optionId);
    if (!controller) {
      problems.push({ optionId: option.id, code: "unknown_option", message: `"${option.name}" depends on a choice that no longer exists.` });
      continue;
    }
    const known = new Set(controller.values.map((value) => value.id));
    if (condition.valueIds.length === 0 || condition.valueIds.some((id) => !known.has(id))) {
      problems.push({ optionId: option.id, code: "unknown_value", message: `"${option.name}" depends on a value of "${controller.name}" that no longer exists.` });
      continue;
    }
    const seen = new Set([option.id]);
    for (let current = controller; ; ) {
      if (seen.has(current.id)) {
        problems.push({ optionId: option.id, code: "cycle", message: `"${option.name}" is part of a circular dependency.` });
        break;
      }
      seen.add(current.id);
      const next = current.visibleWhen && byId.get(current.visibleWhen.optionId);
      if (!next) break;
      current = next;
    }
  }
  return problems;
}

/* ───────────────────────── shopper selections ───────────────────────── */

export type SelectionProblem = {
  optionId: string;
  code: "unknown_option" | "unknown_value" | "hidden_option" | "duplicate_value" | "single_only" | "required" | "too_few" | "too_many";
  message: string;
};

/** Checks a shopper's selections against the seller's choices. */
export function validateProductSelections(options: ProductOptionLike[], selections: OptionSelection[]): SelectionProblem[] {
  const problems: SelectionProblem[] = [];
  const byId = new Map(options.map((option) => [option.id, option]));
  const visibleIds = new Set(getVisibleOptions(options, selections).map((option) => option.id));
  const picked = new Map<string, string[]>();

  for (const selection of selections) {
    const option = byId.get(selection.optionId);
    if (!option) {
      problems.push({ optionId: selection.optionId, code: "unknown_option", message: "That choice does not exist." });
      continue;
    }
    if (!option.values.some((value) => value.id === selection.valueId)) {
      problems.push({ optionId: option.id, code: "unknown_value", message: `That is not a valid ${option.name}.` });
      continue;
    }
    if (!visibleIds.has(option.id)) {
      problems.push({ optionId: option.id, code: "hidden_option", message: `${option.name} is not available for this selection.` });
      continue;
    }
    const values = picked.get(option.id) ?? [];
    if (values.includes(selection.valueId)) problems.push({ optionId: option.id, code: "duplicate_value", message: `${option.name} was chosen twice.` });
    else values.push(selection.valueId);
    picked.set(option.id, values);
  }

  for (const option of options) {
    if (!visibleIds.has(option.id)) continue;
    const count = picked.get(option.id)?.length ?? 0;
    const multiple = option.type !== "variant" && option.multiple === true;
    if (count > 1 && !multiple) problems.push({ optionId: option.id, code: "single_only", message: `Choose only one ${option.name}.` });
    const min = Math.max(option.minSelect ?? 0, option.required ? 1 : 0);
    if (count === 0 && option.required) problems.push({ optionId: option.id, code: "required", message: `Please choose a ${option.name}.` });
    else if (count > 0 && count < min) problems.push({ optionId: option.id, code: "too_few", message: `Choose at least ${min} for ${option.name}.` });
    if (multiple && option.maxSelect !== undefined && count > option.maxSelect) problems.push({ optionId: option.id, code: "too_many", message: `Choose at most ${option.maxSelect} for ${option.name}.` });
  }
  return problems;
}

/** Clicking a value: replaces it for single-pick choices (optional ones can be un-picked), toggles for multi-pick up to the maximum. */
export function toggleSelection(option: ProductOptionLike, selections: OptionSelection[], valueId: string): OptionSelection[] {
  const others = selections.filter((selection) => selection.optionId !== option.id);
  const mine = selections.filter((selection) => selection.optionId === option.id);
  const picked = mine.some((selection) => selection.valueId === valueId);
  if (option.type !== "variant" && option.multiple) {
    if (picked) return selections.filter((selection) => !(selection.optionId === option.id && selection.valueId === valueId));
    if (option.maxSelect !== undefined && mine.length >= option.maxSelect) return selections;
    return [...selections, { optionId: option.id, valueId }];
  }
  if (picked) return option.required ? selections : others;
  return [...others, { optionId: option.id, valueId }];
}

/** A stable identity for a set of selections, independent of the order they were made in. */
export function selectionKey(selections: OptionSelection[]): string {
  return selections.map((selection) => `${selection.optionId}:${selection.valueId}`).sort().join("|");
}

/* ───────────────────────── seller-side validation ───────────────────────── */

export type OptionIssue = { severity: "error" | "warning"; code: string; message: string; optionId?: string; variantId?: string };

const norm = (text: string) => text.trim().toLowerCase();

/** Rules about the choices themselves. Used by the builder and enforced by the API on every product write. */
export function validateProductOptions(options: ProductOptionLike[], inventoryOptionIds: string[]): OptionIssue[] {
  const issues: OptionIssue[] = [];
  const error = (code: string, message: string, extra: Partial<OptionIssue> = {}) => issues.push({ severity: "error", code, message, ...extra });
  const warn = (code: string, message: string, extra: Partial<OptionIssue> = {}) => issues.push({ severity: "warning", code, message, ...extra });

  const names = new Set<string>();
  const ids = new Set<string>();
  for (const option of options) {
    const label = option.name.trim() || "An unnamed choice";
    if (ids.has(option.id)) error("option_id_duplicate", `${label} appears twice.`, { optionId: option.id });
    ids.add(option.id);
    if (!option.name.trim()) error("option_name_required", "Every choice needs a name.", { optionId: option.id });
    else if (names.has(norm(option.name))) error("option_name_duplicate", `You have two choices called "${option.name}".`, { optionId: option.id });
    names.add(norm(option.name));

    if (option.values.length === 0) error("option_values_required", `${label} needs at least one value.`, { optionId: option.id });
    const labels = new Set<string>();
    const valueIds = new Set<string>();
    for (const value of option.values) {
      if (valueIds.has(value.id)) error("value_id_duplicate", `${label} has a repeated value id.`, { optionId: option.id });
      valueIds.add(value.id);
      if (!value.label.trim()) error("value_label_required", `${label} has a value with no name.`, { optionId: option.id });
      else if (labels.has(norm(value.label))) error("value_label_duplicate", `${label} lists "${value.label}" twice.`, { optionId: option.id });
      labels.add(norm(value.label));
      if (value.priceAdjustmentMinor !== undefined && (!Number.isSafeInteger(value.priceAdjustmentMinor) || value.priceAdjustmentMinor < 0)) error("value_price", `${label}: "${value.label}" has an invalid price change.`, { optionId: option.id });
    }
    if (option.type === "variant" && option.multiple) error("variant_multiple", `${label} tracks stock per value, so customers can only pick one.`, { optionId: option.id });
    if (option.minSelect !== undefined && option.maxSelect !== undefined && option.minSelect > option.maxSelect) error("select_range", `${label}: the minimum is higher than the maximum.`, { optionId: option.id });
    if (option.maxSelect !== undefined && option.maxSelect > option.values.length) warn("select_max_exceeds_values", `${label}: the maximum is more than the number of values.`, { optionId: option.id });
  }

  for (const id of inventoryOptionIds) {
    const option = options.find((candidate) => candidate.id === id);
    if (!option) error("inventory_option_missing", "A stock-tracked choice no longer exists.", { optionId: id });
    else if (option.type !== "variant") error("inventory_option_not_variant", `${option.name || "A choice"} is marked as tracking stock but is not a variant option.`, { optionId: id });
  }

  const axes = options.filter((option) => option.type === "variant" && inventoryOptionIds.includes(option.id) && option.values.length > 0);
  if (axes.length > MAX_VARIANT_AXES) error("too_many_axes", `Stock can be tracked for at most ${MAX_VARIANT_AXES} choices. Make one of them an extra choice instead.`);
  const combinations = axes.reduce((count, option) => count * option.values.length, 1);
  if (axes.length > 0 && combinations > MAX_VARIANTS) error("too_many_variants", `This setup creates ${combinations} variants (the limit is ${MAX_VARIANTS}). Turn a choice into an extra choice or remove values.`);

  for (const problem of findConditionProblems(options)) error(`condition_${problem.code}`, problem.message, { optionId: problem.optionId });
  return issues;
}

/** Each sold combination must name a real value of every stock-tracked choice, exactly once. */
export function validateVariantCombinations(options: ProductOptionLike[], inventoryOptionIds: string[], variants: Array<{ id?: string; name?: string; options?: Record<string, unknown> }>): OptionIssue[] {
  const axes = options.filter((option) => option.type === "variant" && inventoryOptionIds.includes(option.id) && option.values.length > 0);
  if (axes.length === 0) return [];
  const issues: OptionIssue[] = [];
  if (variants.length > MAX_VARIANTS) issues.push({ severity: "error", code: "too_many_variants", message: `A product can have at most ${MAX_VARIANTS} variants.` });
  const seen = new Set<string>();
  for (const variant of variants) {
    const label = variant.name || "A combination";
    const picks = axes.map((axis) => {
      const chosen = variant.options?.[axis.id];
      return typeof chosen === "string" && axis.values.some((value) => value.id === chosen) ? { optionId: axis.id, valueId: chosen } : undefined;
    });
    if (picks.some((pick) => !pick)) {
      issues.push({ severity: "error", code: "variant_option_invalid", message: `${label} does not match your choices.`, variantId: variant.id });
      continue;
    }
    const key = selectionKey(picks as OptionSelection[]);
    if (seen.has(key)) issues.push({ severity: "error", code: "variant_duplicate", message: `${label} is listed more than once.`, variantId: variant.id });
    seen.add(key);
  }
  return issues;
}

export interface DraftVariantLike { id: string; name: string; sku: string; priceMinor: number; stock: number; options?: Record<string, unknown> }
export type DraftIssue = OptionIssue;

export interface ProductDraftInput {
  title: string;
  options: ProductOptionLike[];
  inventoryOptionIds: string[];
  variants: DraftVariantLike[];
  mediaCount?: number;
}

/** Dry-run validation shared by the builder UI and the API. Errors block publishing; warnings never do. */
export function validateProductDraft(draft: ProductDraftInput): { errors: DraftIssue[]; warnings: DraftIssue[]; issues: DraftIssue[] } {
  const issues: DraftIssue[] = [];
  const error = (code: string, message: string, extra: Partial<DraftIssue> = {}) => issues.push({ severity: "error", code, message, ...extra });
  const warn = (code: string, message: string, extra: Partial<DraftIssue> = {}) => issues.push({ severity: "warning", code, message, ...extra });

  if (!draft.title.trim()) error("title_required", "Give your product a name.");
  issues.push(...validateProductOptions(draft.options, draft.inventoryOptionIds));

  const axes = draft.options.filter((option) => option.type === "variant" && draft.inventoryOptionIds.includes(option.id) && option.values.length > 0);
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
