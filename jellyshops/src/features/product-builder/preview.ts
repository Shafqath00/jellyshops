import { majorToMinor, type ConfiguredOptionSelection, type Product, type ProductOption, type ProductVariant } from "@/lib/domain";
import { getVisibleOptions, toggleSelection, validateProductSelections, type SelectionProblem } from "@/lib/product-builder";
import { getConfiguredPriceMinor, resolveProductVariant } from "@/lib/product-configuration";
import { effectiveVariants, inventoryOptionIdsOf, isUnlimitedStock, type ProductDraft } from "./draft";

/** Choices a shopper could actually see: named, with at least one named value. */
export function usableOptions(options: ProductOption[]): ProductOption[] {
  return options
    .filter((option) => option.name.trim() && option.values.some((value) => value.label.trim()))
    .map((option) => ({ ...option, name: option.name.trim(), values: option.values.filter((value) => value.label.trim()) }))
    .sort((a, b) => a.position - b.position);
}

/**
 * Maps the in-progress draft onto the same Product shape the live storefront uses, so the
 * preview can run the storefront's own variant and price helpers instead of re-implementing them.
 */
export function draftToProduct(draft: ProductDraft): Product {
  const options = usableOptions(draft.options);
  const axisIds = new Set(inventoryOptionIdsOf(options));
  const usableAxes = options.filter((option) => axisIds.has(option.id));
  const variants: ProductVariant[] = (usableAxes.length > 0 ? draft.variants : effectiveVariants({ ...draft, options: [] })).map((variant, index) => ({
    ...variant,
    id: variant.id || `preview-${index}`,
    compareAtPriceMinor: usableAxes.length === 0 && draft.compareAtPrice.trim() && Number.isFinite(majorToMinor(draft.compareAtPrice)) ? majorToMinor(draft.compareAtPrice) : variant.compareAtPriceMinor,
  }));
  return {
    id: "preview", storeId: "preview", name: draft.title.trim() || "Product name", slug: "preview", description: draft.description, category: "",
    imageUrl: draft.imageUrl, published: draft.published, archived: false, featured: false, options, inventoryOptionIds: [...axisIds], variants,
  };
}

/** Removes selections whose choice or value no longer exists (the seller keeps editing while previewing). */
export function pruneSelections(options: ProductOption[], selections: ConfiguredOptionSelection[]): ConfiguredOptionSelection[] {
  return selections.filter((selection) => options.find((option) => option.id === selection.optionId)?.values.some((value) => value.id === selection.valueId));
}

export { toggleSelection };

export type ValueStatus = "available" | "sold-out" | "unavailable";

export interface PreviewState {
  options: ProductOption[];
  visible: Set<string>;
  variant: ProductVariant | undefined;
  /** Exact price once the combination is complete; otherwise the lowest possible. */
  priceMinor: number | undefined;
  fromPrice: boolean;
  compareAtMinor: number | undefined;
  availability: string;
  soldOut: boolean;
  problems: SelectionProblem[];
  valueStatus: (optionId: string, valueId: string) => ValueStatus;
}

const surcharge = (options: ProductOption[], selections: ConfiguredOptionSelection[]) =>
  selections.reduce((total, selection) => total + (options.find((option) => option.id === selection.optionId)?.type === "variant" ? 0 : options.find((option) => option.id === selection.optionId)?.values.find((value) => value.id === selection.valueId)?.priceAdjustmentMinor ?? 0), 0);

/** Everything the preview shows, derived from the draft's product and the shopper's picks. Wording matches the live product page. */
export function computePreview(product: Product, rawSelections: ConfiguredOptionSelection[]): PreviewState {
  const options = product.options ?? [];
  const selections = pruneSelections(options, rawSelections);
  const visible = new Set(getVisibleOptions(options, selections).map((option) => option.id));
  const axes = options.filter((option) => option.type === "variant" && (product.inventoryOptionIds ?? []).includes(option.id));
  const problems = validateProductSelections(options, selections);
  const variant = resolveProductVariant(product, selections);
  const requiredMissing = problems.some((problem) => problem.code === "required");
  const extras = surcharge(options, selections);

  const picked = (optionId: string) => selections.find((selection) => selection.optionId === optionId)?.valueId;
  const consistent = product.variants.filter((candidate) => axes.every((axis) => !picked(axis.id) || candidate.options?.[axis.id] === picked(axis.id)));
  let priceMinor: number | undefined;
  let fromPrice = false;
  if (variant) priceMinor = getConfiguredPriceMinor(variant, options, selections);
  else if (consistent.length > 0) {
    const prices = consistent.map((candidate) => candidate.priceMinor + extras).filter(Number.isFinite);
    if (prices.length) { priceMinor = Math.min(...prices); fromPrice = Math.min(...prices) !== Math.max(...prices); }
  }

  const stockText = variant ? (isUnlimitedStock(variant.stock) ? "In stock" : variant.stock > 0 ? `${variant.stock} available` : "Out of stock") : "";
  const availability = variant ? stockText : requiredMissing ? "Choose the required options" : "This combination is unavailable";
  const soldOut = variant ? !isUnlimitedStock(variant.stock) && variant.stock <= 0 : axes.length === 0 ? false : consistent.length > 0 && consistent.every((candidate) => !isUnlimitedStock(candidate.stock) && candidate.stock <= 0);

  const valueStatus = (optionId: string, valueId: string): ValueStatus => {
    if (!axes.some((axis) => axis.id === optionId)) return "available";
    const matching = product.variants.filter((candidate) => candidate.options?.[optionId] === valueId && axes.every((axis) => axis.id === optionId || !picked(axis.id) || candidate.options?.[axis.id] === picked(axis.id)));
    if (matching.length === 0) return "unavailable";
    return matching.every((candidate) => !isUnlimitedStock(candidate.stock) && candidate.stock <= 0) ? "sold-out" : "available";
  };

  const compare = variant?.compareAtPriceMinor ?? (axes.length === 0 ? product.variants[0]?.compareAtPriceMinor : undefined);
  const compareAtMinor = compare !== undefined && priceMinor !== undefined && compare > priceMinor ? compare : undefined;
  return { options, visible, variant, priceMinor, fromPrice, compareAtMinor, availability, soldOut, problems, valueStatus };
}
