import { pruneMediaAssignments, type ProductMediaLike, type RichTextDocument } from "@jelly/storefront-schema";
import { majorToMinor, minorToMajor, slugify, type Product, type ProductOption, type ProductVariant } from "@/lib/domain";
import { reconcileProductVariants } from "@/lib/product-variants";
import { validateProductDraft, type DraftIssue } from "@/lib/product-builder";
import { emptyUnitPricing, parseUnitPricing, type UnitPricingDraft } from "./pricing";
import { dimensionsToDraft, emptyShipping, shippingToValues, validateShipping, weightToDraft, type ShippingDraft } from "./shipping";
import { quantityRuleProblems, type PersonalisationField, type QuantityRule } from "@jelly/storefront-schema";

/** What the seller has typed so far. Text fields stay strings so partial input is never lost. */
export interface ProductDraft {
  specificationsText?: string;
  /** Text fields shoppers fill in per item (engraving, gift message). Undefined leaves the saved fields untouched. */
  personalisation?: PersonalisationField[];
  /** Minimum order, steps and most per order; null = no rule, undefined leaves the saved rule untouched. */
  quantityRule?: QuantityRule | null;
  additionalCategoryIds?: string[];
  brandId?: string;
  archived?: boolean;
  vendor?: string;
  productType?: string;
  tags?: string[];
  collectionIds?: string[];
  trackInventory?: boolean;
  title: string;
  /** Plain text. Derived from `descriptionDoc` whenever the rich text changes. */
  description: string;
  /** What the seller formatted; null while the product only has a plain-text description. */
  descriptionDoc?: RichTextDocument | null;
  imageUrl: string;
  media?: ProductMediaLike[];
  categoryId: string;
  price: string;
  compareAtPrice: string;
  /** What the seller pays per item. Internal only; drives profit and margin. */
  cost: string;
  /** Optional "price per 100 g" display; blank while untouched. */
  unitPricing: UnitPricingDraft;
  /** The code on the product (GTIN, UPC, ...). Optional. */
  barcode: string;
  /** Warn when this many or fewer are still available; blank uses the store default. */
  lowStockThreshold: string;
  /** False for downloadable products, which are never shipped. */
  physical: boolean;
  /** Weight, size, origin and HS code of a product without combinations. */
  shipping: ShippingDraft;
  sku: string;
  stock: string;
  published: boolean;
  /** The seller's choices (size, colour, extras). Empty for a simple product. */
  options: ProductOption[];
  /** One row per combination of stock-tracked choices. Only used while such choices exist. */
  variants: ProductVariant[];
  /** The product's web address. Follows the name until the seller edits it; a saved product keeps its own. */
  handle: string;
  handleManual: boolean;
  /** The handle the product was opened with; a legacy handle is never reported as invalid until it is changed. */
  initialHandle: string;
  /** What search engines show; empty uses the product name and description. */
  seoTitle: string;
  seoDescription: string;
}

export const emptyDraft: ProductDraft = { specificationsText: "", additionalCategoryIds: [], brandId: "", vendor: "", productType: "", tags: [], collectionIds: [], trackInventory: true, title: "", description: "", descriptionDoc: null, imageUrl: "", categoryId: "", price: "", compareAtPrice: "", cost: "", unitPricing: emptyUnitPricing, barcode: "", lowStockThreshold: "", physical: true, shipping: emptyShipping, sku: "", stock: "", published: true, options: [], variants: [], handle: "", handleManual: false, initialHandle: "", seoTitle: "", seoDescription: "" };

/** What already exists on the server, so saves update the same rows instead of duplicating them. */
export interface PersistedState {
  variantIds: string[];
  /** The single "Standard" variant of a simple product, if the product already has one. */
  standardVariantId?: string;
  imageUrl: string;
  media?: ProductMediaLike[];
}

export type DraftField = "title" | "description" | "imageUrl" | "categoryId" | "price" | "compareAtPrice" | "cost" | "unitPricing" | "barcode" | "lowStockThreshold" | "weight" | "dimensions" | "hsCode" | "handle" | "sku" | "stock" | "published" | "personalisation" | "quantityRule";
export type DraftErrors = Partial<Record<DraftField, string>>;

/** Untracked inventory is represented as a huge number by the catalog mapper; never send that back as a quantity. */
export const isUnlimitedStock = (stock: number) => !Number.isFinite(stock) || stock > 1_000_000_000;
const isWholeNumber = (text: string) => /^\d{1,9}$/.test(text.trim());

/** The web address the product will be saved with. */
export const effectiveHandle = (draft: Pick<ProductDraft, "title" | "handle" | "handleManual">) => draft.handleManual ? draft.handle.trim() : slugify(draft.title.trim());

/** A handle the seller typed must be usable in a web address; one the product already had is left alone until it changes. */
export function handleProblem(draft: Pick<ProductDraft, "handle" | "handleManual" | "initialHandle">): string | undefined {
  if (!draft.handleManual) return undefined;
  const handle = draft.handle.trim();
  if (!handle) return "Enter a URL handle, like organic-linen-shirt.";
  if (handle === draft.initialHandle) return undefined;
  if (handle.length > 255) return "A URL handle can be at most 255 characters.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle)) return "Use lowercase letters, numbers and single hyphens, like organic-linen-shirt.";
  return undefined;
}

/** Choices whose combinations are sold, priced and counted separately. */
export function inventoryOptionIdsOf(options: ProductOption[]): string[] {
  return options.filter((option) => option.type === "variant").map((option) => option.id);
}
export const hasVariantAxes = (draft: Pick<ProductDraft, "options">) => inventoryOptionIdsOf(draft.options).length > 0;

/** Field-level errors. Quantity and SKU belong to the product only while it has no stock-tracked choices. */
export function validateSimpleDraft(draft: ProductDraft): DraftErrors {
  const errors: DraftErrors = {};
  const price = majorToMinor(draft.price);
  const compareAt = draft.compareAtPrice.trim() ? majorToMinor(draft.compareAtPrice) : undefined;
  if (!draft.title.trim()) errors.title = "Give your product a name.";
  if (draft.personalisation?.some((field) => !field.label.trim())) errors.personalisation = "Each personalisation field needs a name.";
  const [quantityIssue] = draft.quantityRule ? quantityRuleProblems(draft.quantityRule) : [];
  if (quantityIssue) errors.quantityRule = quantityIssue;
  const handleIssue = handleProblem(draft);
  if (handleIssue) errors.handle = handleIssue;
  if (!draft.price.trim()) errors.price = "Enter a price.";
  else if (!Number.isFinite(price) || price < 0) errors.price = "Enter a valid price, like 499 or 499.50.";
  if (!hasVariantAxes(draft)) {
    if (draft.cost.trim()) {
      const cost = majorToMinor(draft.cost);
      if (!Number.isFinite(cost) || cost < 0) errors.cost = "Enter a valid cost, like 250 or 250.50.";
    }
    const unit = parseUnitPricing(draft.unitPricing);
    if (unit.error) errors.unitPricing = unit.error;
    if (compareAt !== undefined) {
      if (!Number.isFinite(compareAt) || compareAt < 0) errors.compareAtPrice = "Enter a valid price, like 599.";
      else if (Number.isFinite(price) && compareAt <= price) errors.compareAtPrice = "The original price should be higher than the price.";
    }
    if (draft.trackInventory !== false && draft.stock.trim() && !isWholeNumber(draft.stock)) errors.stock = "Stock must be a whole number, 0 or more.";
    if (draft.barcode.trim().length > 64) errors.barcode = "A barcode can be up to 64 characters.";
    if (draft.lowStockThreshold.trim() && !/^\d{1,7}$/.test(draft.lowStockThreshold.trim())) errors.lowStockThreshold = "Use a whole number, 0 or more.";
    if (draft.physical) Object.assign(errors, validateShipping(draft.shipping));
  }
  return errors;
}

export function draftToVariant(draft: ProductDraft, id = ""): ProductVariant {
  return { id, name: "Standard", sku: draft.sku.trim(), priceMinor: majorToMinor(draft.price), stock: Number(draft.stock || 0), options: {} };
}

/** The variants that will actually be sold: the combinations table, or the single Standard variant. */
export function effectiveVariants(draft: ProductDraft): ProductVariant[] {
  return hasVariantAxes(draft) ? draft.variants : [draftToVariant(draft)];
}

/** Applies new choices and rebuilds the combinations, keeping price/stock/SKU the seller already entered. */
export function withOptions(draft: ProductDraft, options: ProductOption[]): { draft: ProductDraft; error?: string } {
  const next = { ...draft, options, ...(draft.media ? { media: pruneMediaAssignments(draft.media, options).media } : {}) };
  const inventoryOptionIds = inventoryOptionIdsOf(options);
  if (inventoryOptionIds.length === 0) return { draft: { ...next, variants: [] } };
  const basePriceMinor = majorToMinor(draft.price);
  const result = reconcileProductVariants({
    options, inventoryOptionIds, variants: draft.variants,
    basePriceMinor: Number.isFinite(basePriceMinor) && basePriceMinor >= 0 ? basePriceMinor : 0,
    defaultStock: isWholeNumber(draft.stock) ? Number(draft.stock) : 0,
  });
  return result.error ? { draft: next, error: result.error } : { draft: { ...next, variants: result.variants } };
}

/** Everything that blocks saving, as field errors plus plain-language problems from the shared rules. */
export function validateBuilderDraft(draft: ProductDraft): { fields: DraftErrors; problems: DraftIssue[] } {
  const fields = validateSimpleDraft(draft);
  const axes = hasVariantAxes(draft);
  const { errors } = validateProductDraft({ title: draft.title, options: draft.options, inventoryOptionIds: inventoryOptionIdsOf(draft.options), variants: effectiveVariants(draft), mediaCount: draft.media?.length ?? (draft.imageUrl ? 1 : 0) });
  // Title and the simple-mode price are already reported next to their fields.
  const problems = errors.filter((issue) => issue.code !== "title_required" && !(issue.code === "variant_price" && !axes));
  if (axes) {
    for (const variant of draft.variants) {
      const compareAt = variant.compareAtPriceMinor;
      if (compareAt != null && (!Number.isFinite(compareAt) || compareAt <= variant.priceMinor)) {
        problems.push({ severity: "error", code: "variant_compare_at_price", message: `${variant.name || "A combination"}: original price must be higher than the price.`, variantId: variant.id });
      }
    }
  }
  return { fields, problems };
}

/** Shared-package check without field rules; warnings (no photo, no SKU) never block. */
export function validateDraftForPublish(draft: ProductDraft) {
  return validateProductDraft({ title: draft.title, options: draft.options, inventoryOptionIds: inventoryOptionIdsOf(draft.options), variants: effectiveVariants(draft), mediaCount: draft.media?.length ?? (draft.imageUrl ? 1 : 0) });
}

const NO_PERSISTED: PersistedState = { variantIds: [], imageUrl: "" };

/** Request body for the catalog API. Existing rows keep their ids; the photo is only re-sent when it changed. */
export function draftToPayload(draft: ProductDraft, _categoryName: string | undefined, persisted: PersistedState = NO_PERSISTED) {
  const axes = hasVariantAxes(draft);
  const compareAt = draft.compareAtPrice.trim() ? majorToMinor(draft.compareAtPrice) : 0;
  const known = new Set(persisted.variantIds);
  const variants = axes
    ? draft.variants.map((variant) => ({
        ...(known.has(variant.id) ? { id: variant.id } : {}),
        title: variant.name,
        sku: variant.sku.trim() || undefined,
        priceMinor: variant.priceMinor,
        compareAtPriceMinor: variant.compareAtPriceMinor ?? null,
        costMinor: variant.costMinor ?? null,
        barcode: variant.barcode?.trim() || null,
        lowStockThreshold: variant.lowStockThreshold ?? null,
        sellable: variant.sellable !== false,
        // A photo that is no longer on the product cannot be shown for a combination.
        mediaId: variant.mediaId && (draft.media ?? []).some((photo) => photo.id === variant.mediaId) ? variant.mediaId : null,
        ...(draft.physical ? { weightGrams: variant.weightGrams ?? null, lengthMm: variant.lengthMm ?? null, widthMm: variant.widthMm ?? null, heightMm: variant.heightMm ?? null, countryOfOrigin: variant.countryOfOrigin ?? null, hsCode: variant.hsCode ?? null } : {}),
        ...(variant.trackInventory === false || isUnlimitedStock(variant.stock) ? { trackInventory: false } : { quantity: variant.stock, trackInventory: true }),
        options: variant.options ?? {},
      }))
    : [{
        ...(persisted.standardVariantId ? { id: persisted.standardVariantId } : {}),
        title: "Standard",
        sku: draft.sku.trim() || undefined,
        priceMinor: majorToMinor(draft.price),
        compareAtPriceMinor: compareAt > 0 ? compareAt : null,
        costMinor: draft.cost.trim() ? majorToMinor(draft.cost) : null,
        unitPricing: parseUnitPricing(draft.unitPricing).value,
        barcode: draft.barcode.trim() || null,
        lowStockThreshold: draft.lowStockThreshold.trim() ? Number(draft.lowStockThreshold.trim()) : null,
        // A digital product is never shipped, so its shipping details are left as they are.
        ...(draft.physical ? shippingToValues(draft.shipping) : {}),
        // Blank stock on an existing product means "leave it as it is" (it may be untracked).
        ...(draft.trackInventory === false ? { trackInventory: false } : { quantity: Number(draft.stock || 0), trackInventory: true }),
        options: {} as Record<string, string>,
      }];
  return {
    ...(draft.media !== undefined
      ? JSON.stringify(draft.media) !== JSON.stringify(persisted.media ?? []) ? { media: draft.media.map((photo) => ({ mediaId: photo.id, altText: photo.altText ?? null, appliesTo: photo.appliesTo ?? {} })) } : {}
      : draft.imageUrl && draft.imageUrl !== persisted.imageUrl ? { imageUrl: draft.imageUrl } : {}),
    handle: effectiveHandle(draft),
    title: draft.title.trim(),
    description: draft.description.trim(),
    ...(draft.descriptionDoc !== undefined ? { descriptionDoc: draft.descriptionDoc } : {}),
    seoTitle: draft.seoTitle.trim() || null,
    seoDescription: draft.seoDescription.trim() || null,
    ...(draft.specificationsText !== undefined ? { specifications: Object.fromEntries(draft.specificationsText.split("\n").flatMap(line => { const separator = line.indexOf(":"); if (separator < 1) return []; const key = line.slice(0, separator).trim(), value = line.slice(separator + 1).trim(); return key && value ? [[key, value]] : []; })) } : {}),
    ...(draft.additionalCategoryIds !== undefined ? { additionalCategoryIds: draft.additionalCategoryIds.filter(id => id !== draft.categoryId) } : {}),
    ...(draft.brandId !== undefined ? { brandId: draft.brandId || null } : {}),
    ...(draft.productType !== undefined ? { productType: draft.productType.trim() || null } : {}),
    ...(draft.vendor !== undefined ? { vendor: draft.vendor.trim() || null } : {}),
    ...(draft.tags !== undefined ? { tags: draft.tags } : {}),
    ...(draft.collectionIds !== undefined ? { collectionIds: draft.collectionIds } : {}),
    status: draft.archived ? "ARCHIVED" as const : draft.published ? "ACTIVE" as const : "DRAFT" as const,
    primaryCategoryId: draft.categoryId || null,
    fulfillmentType: draft.physical ? "PHYSICAL" as const : "DIGITAL" as const,
    options: draft.options.map((option, position) => ({ ...option, name: option.name.trim(), position, values: option.values.map((value, index) => ({ ...value, label: value.label.trim(), position: index })) })) as unknown[],
    inventoryOptionIds: inventoryOptionIdsOf(draft.options),
    ...(draft.quantityRule !== undefined ? { quantityRule: draft.quantityRule } : {}),
    ...(draft.personalisation !== undefined ? { personalisation: draft.personalisation.map((field) => ({ ...field, label: field.label.trim() })) } : {}),
    variants,
  };
}

/** Opens a saved product in the builder. Returns what the server already holds alongside the draft. */
export function productToDraft(product: Product): { draft: ProductDraft; persisted: PersistedState } {
  const options = product.options ?? [];
  const axes = inventoryOptionIdsOf(options).length > 0;
  const first = product.variants[0];
  const hasPhoto = Boolean(product.media?.length);
  const imageUrl = hasPhoto ? product.imageUrl : "";
  const draft: ProductDraft = {
    personalisation: product.personalisation ?? [],
    // Undefined unless the product has a rule, so saves leave the column alone until the merchant sets one.
    quantityRule: product.quantityRule ?? undefined,
    specificationsText: Object.entries(product.specifications ?? {}).map(([key, value]) => `${key}: ${value}`).join("\n"),
    additionalCategoryIds: product.additionalCategoryIds ?? [],
    brandId: product.brandId ?? "",
    archived: product.archived,
    vendor: product.vendor ?? "",
    productType: product.productType ?? "",
    tags: product.tags ?? [],
    collectionIds: product.collectionIds ?? [],
    trackInventory: product.fulfillmentType === "DIGITAL" ? false : first?.trackInventory ?? !isUnlimitedStock(first?.stock ?? 0),
    title: product.name,
    description: product.description,
    descriptionDoc: product.descriptionDoc ?? null,
    handle: product.slug ?? "",
    handleManual: Boolean(product.slug),
    initialHandle: product.slug ?? "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    imageUrl,
    media: product.media ?? [],
    categoryId: product.primaryCategoryId ?? "",
    price: minorToMajor(first?.priceMinor ?? 0),
    compareAtPrice: !axes && first?.compareAtPriceMinor ? minorToMajor(first.compareAtPriceMinor) : "",
    cost: !axes && first?.costMinor != null ? minorToMajor(first.costMinor) : "",
    unitPricing: !axes && first?.unitPricing ? { totalAmount: String(first.unitPricing.totalAmount), totalUnit: first.unitPricing.totalUnit, baseAmount: String(first.unitPricing.baseAmount), baseUnit: first.unitPricing.baseUnit } : emptyUnitPricing,
    barcode: !axes ? first?.barcode ?? "" : "",
    lowStockThreshold: !axes && first?.lowStockThreshold != null ? String(first.lowStockThreshold) : "",
    physical: product.fulfillmentType !== "DIGITAL",
    shipping: !axes ? { ...emptyShipping, ...weightToDraft(first?.weightGrams), ...dimensionsToDraft(first?.lengthMm, first?.widthMm, first?.heightMm), countryOfOrigin: first?.countryOfOrigin ?? "", hsCode: first?.hsCode ?? "" } : emptyShipping,
    sku: !axes ? first?.sku ?? "" : "",
    stock: !axes && first && Number.isFinite(first.stock) && first.stock < Number.MAX_SAFE_INTEGER ? String(first.stock) : "",
    published: product.published,
    options,
    variants: axes ? product.variants : [],
  };
  return {
    draft,
    persisted: { variantIds: product.variants.map((variant) => variant.id), standardVariantId: !axes ? first?.id : undefined, imageUrl, media: product.media ?? [] },
  };
}
