import type { ProductPresentationContext } from "@jelly/storefront-renderer";
import type { ConfiguredOptionSelection, Currency, Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";
import { getConfiguredPriceMinor, resolveProductVariant } from "@/lib/product-configuration";
import { getVisibleOptions, toggleSelection, validateProductSelections } from "@/lib/product-builder";
import type { CatalogAdminProduct } from "@/features/store-editor/api/types";
import { productGallery } from "@/lib/product-media";
import { isVariantBuyable } from "@/lib/variant-stock";
import { isProductMediaEnabled, normalisePersonalisation, personalisationPriceMinor, validatePersonalisation, type PersonalisationEntry } from "@jelly/storefront-schema";

/** Maps the catalog detail DTO to the existing storefront Product domain shape. */
export function catalogProductToProduct(product: CatalogAdminProduct): Product {
  const options = (product.options ?? []).filter((option): option is NonNullable<Product["options"]>[number] =>
    Boolean(option) && typeof option === "object" && !Array.isArray(option)
    && typeof (option as { id?: unknown }).id === "string"
    && typeof (option as { name?: unknown }).name === "string"
    && Array.isArray((option as { values?: unknown }).values),
  );
  return {
    id: product.id, storeId: product.storeId, name: product.title, slug: product.handle,
    description: product.description, specifications: product.specifications ?? {}, category: product.productType ?? "", imageUrl: product.media[0]?.url ?? "",
    published: product.status === "ACTIVE", archived: product.status === "ARCHIVED", featured: false,
    media: product.media.map((media) => ({ ...media, altText: media.altText ?? undefined })),
    ...(product.vendor ? { vendor: product.vendor } : {}),
    variants: product.variants.map((variant) => ({
      id: variant.id, name: variant.title, sku: variant.sku ?? "", priceMinor: variant.priceMinor,
      ...(variant.compareAtPriceMinor == null ? {} : { compareAtPriceMinor: variant.compareAtPriceMinor }),
      stock: variant.quantity ?? 0, available: variant.available, options: variant.options as Record<string, string> | undefined,
    })),
    options, inventoryOptionIds: product.inventoryOptionIds ?? [], primaryCategoryId: product.primaryCategoryId ?? undefined,
    additionalCategoryIds: product.additionalCategoryIds ?? [], brandId: product.brandId ?? undefined, collectionIds: product.collectionIds ?? [],
  };
}

export function createProductPresentationContext({ product, currency, shippingCopy, selections, quantity, onSelectionsChange, onQuantityChange, onAddToCart, relatedProducts = [], personalisationValues = {}, onPersonalisationChange, showPersonalisationProblems = false }: {
  product: Product;
  currency: Currency;
  shippingCopy?: string;
  selections: ConfiguredOptionSelection[];
  quantity: number;
  onSelectionsChange(selections: ConfiguredOptionSelection[]): void;
  onQuantityChange(quantity: number): void;
  onAddToCart(input: { variantId: string; quantity: number; selections: ConfiguredOptionSelection[]; priceMinor: number; personalisation: PersonalisationEntry[] }): Promise<{ ok: boolean; message?: string }>;
  relatedProducts?: ProductPresentationContext["relatedProducts"];
  /** What the shopper typed in the personalisation fields, by field id. */
  personalisationValues?: Record<string, string>;
  onPersonalisationChange?(values: Record<string, string>): void;
  /** Show each field's problem (set after a failed Add to cart). */
  showPersonalisationProblems?: boolean;
}): ProductPresentationContext {
  const personalisationFields = product.personalisation ?? [];
  const personalisationEntries = Object.entries(personalisationValues).map(([fieldId, value]) => ({ fieldId, value }));
  const personalisationProblems = validatePersonalisation(personalisationFields, personalisationEntries);
  const personalised = normalisePersonalisation(personalisationFields, personalisationEntries);
  const allOptions = [...(product.options ?? [])].sort((left, right) => left.position - right.position);
  const gallery = productGallery(product, selections);
  const galleryEnabled = isProductMediaEnabled(product.storeId, process.env.NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS);
  // Choices hidden by a condition (e.g. "extra long" only for King) are not shown or required.
  const visibleIds = new Set(getVisibleOptions(allOptions, selections).map((option) => option.id));
  const options = allOptions.filter((option) => visibleIds.has(option.id));
  const isSelected = (optionId: string, valueId: string) => selections.some((selection) => selection.optionId === optionId && selection.valueId === valueId);
  const selectedValue = (optionId: string) => selections.find((selection) => selection.optionId === optionId)?.valueId;
  const inventoryChoiceMissing = (product.inventoryOptionIds ?? []).some((optionId) => !selectedValue(optionId));
  const problems = validateProductSelections(allOptions, selections);
  const missingOptionIds = new Set(problems.filter((problem) => problem.code === "required" || problem.code === "too_few").map((problem) => problem.optionId));
  const requiredMissing = inventoryChoiceMissing || missingOptionIds.size > 0;
  const variant = resolveProductVariant(product, selections);
  const optionsPriceMinor = getConfiguredPriceMinor(variant, options, selections);
  // Filled-in personalisation with a price (engraving +£5) is part of the line price, as at checkout.
  const priceMinor = optionsPriceMinor === undefined ? undefined : optionsPriceMinor + personalisationPriceMinor(personalisationFields, personalised);
  // A combination the merchant stopped selling cannot be bought, whatever stock it has left.
  const notSold = variant?.sellable === false;
  const untrackedAvailable = !notSold && variant?.available === true && variant.stock === 0;
  const maxQuantity = !requiredMissing && variant && !notSold && variant.stock > 0 ? variant.stock : untrackedAvailable ? undefined : 0;
  const clampedQuantity = maxQuantity === undefined ? Math.max(1, quantity) : Math.max(1, Math.min(quantity, maxQuantity));
  const fromVariant = !variant && inventoryChoiceMissing && product.variants.length ? product.variants.reduce((cheapest, candidate) => candidate.priceMinor < cheapest.priceMinor ? candidate : cheapest) : undefined;
  const availability = requiredMissing ? { state: "selection-required" as const, message: "Choose the required options", maxQuantity: 0 }
    : !variant || notSold ? { state: "unavailable" as const, message: "This combination is unavailable", maxQuantity: 0 }
      : variant.stock <= 0 && !untrackedAvailable ? { state: "out-of-stock" as const, message: "Out of stock", maxQuantity: 0 }
        : untrackedAvailable ? { state: "available" as const, message: "Available" }
          : { state: "available" as const, message: `${variant.stock} available`, maxQuantity: variant.stock };

  return {
    product: { id: product.id, title: product.name, description: product.description, descriptionDoc: product.descriptionDoc ?? null, imageUrl: gallery[0]?.url ?? "", galleryEnabled, specifications: product.specifications ?? {}, shippingCopy, media: gallery, sku: variant?.sku || undefined, vendor: product.vendor, options: options.map((option) => ({ id: option.id, name: option.name, required: option.required, ...(option.display === "color" || option.display === "image" ? { display: option.display } : {}), ...(option.type !== "variant" && option.multiple ? { multiple: true } : {}), ...(missingOptionIds.has(option.id) ? { missing: true } : {}), values: option.values.map((value) => ({ id: value.id, label: value.label, selected: isSelected(option.id, value.id), ...optionValueState(product, selections, option.id, value.id), ...(option.display === "color" && value.color ? { color: value.color } : {}), ...(option.display === "image" && value.image ? { image: value.image } : {}), ...(value.priceAdjustmentMinor > 0 && option.type !== "variant" ? { priceAdjustment: formatMoney(value.priceAdjustmentMinor, currency) } : {}) })) })) },
    selection: selections,
    quantity: clampedQuantity,
    // Before a size is chosen, the price (and its sale price) is the cheapest variant's, as on Shopify.
    pricing: pricingFor(priceMinor ?? fromVariant?.priceMinor ?? 0, (variant ?? fromVariant)?.compareAtPriceMinor ?? product.compareAtPriceMinor, currency),
    availability,
    canAddToCart: availability.state === "available" && priceMinor !== undefined && Boolean(variant),
    selectOption: (optionId, valueId) => { const option = allOptions.find((candidate) => candidate.id === optionId); if (option) onSelectionsChange(toggleSelection(option, selections, valueId)); },
    setQuantity: (nextQuantity) => onQuantityChange(maxQuantity === undefined ? Math.max(1, nextQuantity) : Math.max(1, Math.min(nextQuantity, maxQuantity))),
    addToCart: () => personalisationProblems.length ? Promise.resolve({ ok: false, message: personalisationProblems[0].message })
      : variant && priceMinor !== undefined && availability.state === "available" ? onAddToCart({ variantId: variant.id, quantity: clampedQuantity, selections, priceMinor, personalisation: personalised }) : Promise.resolve({ ok: false, message: availability.message }),
    ...(personalisationFields.length ? { personalisation: {
      fields: personalisationFields.map((field) => ({ id: field.id, label: field.label, required: field.required, maxLength: field.maxLength, ...(field.multiline ? { multiline: true } : {}), ...(field.helpText ? { helpText: field.helpText } : {}), ...(field.priceAdjustmentMinor ? { priceAdjustment: formatMoney(field.priceAdjustmentMinor, currency) } : {}) })),
      values: personalisationValues,
      setValue: (fieldId: string, value: string) => onPersonalisationChange?.({ ...personalisationValues, [fieldId]: value }),
      ...(showPersonalisationProblems && personalisationProblems.length ? { problems: Object.fromEntries(personalisationProblems.map((problem) => [problem.fieldId, problem.message])) } : {}),
    } } : {}),
    relatedProducts,
  };
}

/**
 * Whether a value of a choice that decides the variant (size, colour) can be bought with the shopper's other such
 * choices. A value with no buyable variant is shown as sold out but stays selectable (the shopper sees its price and
 * can ask to be told when it is back); only a value no variant has at all cannot be chosen. Other choices (add-ons,
 * engraving style) are always available.
 */
export function optionValueState(product: Pick<Product, "variants" | "inventoryOptionIds">, selections: ConfiguredOptionSelection[], optionId: string, valueId: string): { available: boolean; soldOut?: true } {
  const inventory = product.inventoryOptionIds ?? [];
  if (!inventory.includes(optionId)) return { available: true };
  const withValue = product.variants.filter((variant) => variant.options?.[optionId] === valueId);
  if (withValue.length === 0) return { available: false };
  const others = selections.filter((selection) => selection.optionId !== optionId && inventory.includes(selection.optionId));
  const matching = withValue.filter((variant) => others.every((selection) => variant.options?.[selection.optionId] === selection.valueId));
  return matching.some(isVariantBuyable) ? { available: true } : { available: true, soldOut: true };
}

/** Formatted prices plus the amounts themes use for "% off", "Save £X" and monthly finance. */
export function pricingFor(priceMinor: number, compareAtPriceMinor: number | null | undefined, currency: Currency): ProductPresentationContext["pricing"] {
  return {
    price: formatMoney(priceMinor, currency),
    priceMinor,
    format: (minor: number) => formatMoney(minor, currency),
    ...(compareAtPriceMinor ? { compareAtPrice: formatMoney(compareAtPriceMinor, currency), compareAtPriceMinor } : {}),
  };
}
