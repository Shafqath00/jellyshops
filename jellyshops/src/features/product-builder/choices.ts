import type { ProductOption, ProductOptionDisplay, ProductOptionKind, ProductOptionValue } from "@/lib/domain";
import type { TaxonomyTemplate } from "./taxonomy";

/**
 * Plain-language names for the three behaviours a choice can have. The seller never
 * sees "variant" or "configuration"; they answer one question about stock.
 */
export const CHOICE_KINDS: Array<{ kind: ProductOptionKind; label: string; hint: string }> = [
  { kind: "variant", label: "Needs its own stock", hint: "Size, colour. Each combination gets its own price, stock and SKU." },
  { kind: "configuration", label: "Changes the price only", hint: "Material, finish. Shoppers choose one; no separate stock." },
  { kind: "addon", label: "Optional extra", hint: "Gift wrap, headboard. Shoppers can add any of them." },
];

const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function newValue(label: string, position: number): ProductOptionValue {
  return { id: uid("value"), label: label.trim(), priceAdjustmentMinor: 0, position };
}

export function newChoice(position: number, kind: ProductOptionKind = "variant"): ProductOption {
  return { id: uid("option"), name: "", type: kind, display: "buttons", required: kind === "variant", multiple: kind === "addon", position, values: [] };
}

export function choiceFromTemplate(template: Pick<TaxonomyTemplate, "name" | "optionKind" | "displayType" | "required" | "multiple" | "defaultValues">, position: number): ProductOption {
  const variant = template.optionKind === "variant";
  return {
    id: uid("option"), name: template.name, type: template.optionKind, display: template.displayType as ProductOptionDisplay,
    required: variant || template.required, multiple: !variant && template.multiple, position,
    values: template.defaultValues.map((label, index) => newValue(label, index)),
  };
}

/** Templates that can still be offered: not already added (by name), in template order. */
export function unusedTemplates(templates: TaxonomyTemplate[], options: ProductOption[]) {
  return templates.filter((template) => !options.some((option) => sameName(option.name, template.name)));
}

/** Switching behaviour keeps the choice's values but fixes anything the new behaviour cannot support. */
export function withKind(option: ProductOption, kind: ProductOptionKind): ProductOption {
  if (kind === option.type) return option;
  if (kind === "variant") {
    // Prices live on the variants table for stock-tracked choices, so per-value surcharges would be hidden and misleading.
    return { ...option, type: kind, required: true, multiple: false, minSelect: undefined, maxSelect: undefined, values: option.values.map((value) => ({ ...value, priceAdjustmentMinor: 0 })) };
  }
  return { ...option, type: kind, multiple: kind === "addon" ? true : false, required: kind === "addon" ? false : option.required, minSelect: undefined, maxSelect: undefined };
}

/** Adds values typed or pasted as "S, M, L"; ignores blanks and duplicates (case-insensitive). */
export function withAddedValues(option: ProductOption, raw: string): ProductOption {
  const existing = new Set(option.values.map((value) => value.label.trim().toLowerCase()));
  const added: ProductOptionValue[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const label = part.trim();
    if (!label || existing.has(label.toLowerCase())) continue;
    existing.add(label.toLowerCase());
    added.push(newValue(label, option.values.length + added.length));
  }
  return added.length === 0 ? option : { ...option, values: [...option.values, ...added] };
}

export function withoutValue(option: ProductOption, valueId: string): ProductOption {
  return { ...option, values: option.values.filter((value) => value.id !== valueId).map((value, position) => ({ ...value, position })) };
}

export function withValuePatch(option: ProductOption, valueId: string, patch: Partial<ProductOptionValue>): ProductOption {
  return { ...option, values: option.values.map((value) => value.id === valueId ? { ...value, ...patch } : value) };
}

export function moveChoice(options: ProductOption[], id: string, direction: -1 | 1): ProductOption[] {
  const from = options.findIndex((option) => option.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= options.length) return options;
  const next = [...options];
  [next[from], next[to]] = [next[to], next[from]];
  return next.map((option, position) => ({ ...option, position }));
}
