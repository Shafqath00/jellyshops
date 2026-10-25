import { majorToMinor, minorToMajor, slugify, type Product, type ProductOption, type ProductVariant } from "@/lib/domain";
import { reconcileProductVariants } from "@/lib/product-variants";
import { validateProductDraft, type DraftIssue } from "@/lib/product-builder";

/** What the seller has typed so far. Text fields stay strings so partial input is never lost. */
export interface ProductDraft {
  title: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  stock: string;
  published: boolean;
  /** The seller's choices (size, colour, extras). Empty for a simple product. */
  options: ProductOption[];
  /** One row per combination of stock-tracked choices. Only used while such choices exist. */
  variants: ProductVariant[];
}

export const emptyDraft: ProductDraft = { title: "", description: "", imageUrl: "", categoryId: "", price: "", compareAtPrice: "", sku: "", stock: "", published: true, options: [], variants: [] };

/** What already exists on the server, so saves update the same rows instead of duplicating them. */
export interface PersistedState {
  variantIds: string[];
  /** The single "Standard" variant of a simple product, if the product already has one. */
  standardVariantId?: string;
  imageUrl: string;
}

export type DraftField = "title" | "description" | "imageUrl" | "categoryId" | "price" | "compareAtPrice" | "sku" | "stock" | "published";
export type DraftErrors = Partial<Record<DraftField, string>>;

/** Untracked inventory is represented as a huge number by the catalog mapper; never send that back as a quantity. */
export const isUnlimitedStock = (stock: number) => !Number.isFinite(stock) || stock > 1_000_000_000;
const isWholeNumber = (text: string) => /^\d{1,9}$/.test(text.trim());

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
  if (!draft.price.trim()) errors.price = "Enter a price.";
  else if (!Number.isFinite(price) || price < 0) errors.price = "Enter a valid price, like 499 or 499.50.";
  if (!hasVariantAxes(draft)) {
    if (compareAt !== undefined) {
      if (!Number.isFinite(compareAt) || compareAt < 0) errors.compareAtPrice = "Enter a valid price, like 599.";
      else if (Number.isFinite(price) && compareAt <= price) errors.compareAtPrice = "The original price should be higher than the price.";
    }
    if (draft.stock.trim() && !isWholeNumber(draft.stock)) errors.stock = "Stock must be a whole number, 0 or more.";
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
  const next = { ...draft, options };
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
  const { errors } = validateProductDraft({ title: draft.title, options: draft.options, inventoryOptionIds: inventoryOptionIdsOf(draft.options), variants: effectiveVariants(draft), mediaCount: draft.imageUrl ? 1 : 0 });
  // Title and the simple-mode price are already reported next to their fields.
  const problems = errors.filter((issue) => issue.code !== "title_required" && !(issue.code === "variant_price" && !axes));
  return { fields, problems };
}

/** Shared-package check without field rules; warnings (no photo, no SKU) never block. */
export function validateDraftForPublish(draft: ProductDraft) {
  return validateProductDraft({ title: draft.title, options: draft.options, inventoryOptionIds: inventoryOptionIdsOf(draft.options), variants: effectiveVariants(draft), mediaCount: draft.imageUrl ? 1 : 0 });
}

const NO_PERSISTED: PersistedState = { variantIds: [], imageUrl: "" };

/** Request body for the catalog API. Existing rows keep their ids; the photo is only re-sent when it changed. */
export function draftToPayload(draft: ProductDraft, categoryName: string | undefined, persisted: PersistedState = NO_PERSISTED) {
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
        ...(isUnlimitedStock(variant.stock) ? { trackInventory: false } : { quantity: variant.stock, trackInventory: true }),
        options: variant.options ?? {},
      }))
    : [{
        ...(persisted.standardVariantId ? { id: persisted.standardVariantId } : {}),
        title: "Standard",
        sku: draft.sku.trim() || undefined,
        priceMinor: majorToMinor(draft.price),
        compareAtPriceMinor: compareAt > 0 ? compareAt : null,
        // Blank stock on an existing product means "leave it as it is" (it may be untracked).
        ...(draft.stock.trim() === "" && persisted.standardVariantId ? {} : { quantity: Number(draft.stock || 0), trackInventory: true }),
        options: {} as Record<string, string>,
      }];
  return {
    ...(draft.imageUrl && draft.imageUrl !== persisted.imageUrl ? { imageUrl: draft.imageUrl } : {}),
    handle: slugify(draft.title.trim()),
    title: draft.title.trim(),
    description: draft.description.trim(),
    productType: categoryName ?? "Other",
    status: draft.published ? "ACTIVE" as const : "DRAFT" as const,
    primaryCategoryId: draft.categoryId || undefined,
    options: draft.options.map((option, position) => ({ ...option, name: option.name.trim(), position, values: option.values.map((value, index) => ({ ...value, label: value.label.trim(), position: index })) })) as unknown[],
    inventoryOptionIds: inventoryOptionIdsOf(draft.options),
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
    title: product.name,
    description: product.description,
    imageUrl,
    categoryId: product.primaryCategoryId ?? "",
    price: minorToMajor(first?.priceMinor ?? 0),
    compareAtPrice: !axes && first?.compareAtPriceMinor ? minorToMajor(first.compareAtPriceMinor) : "",
    sku: !axes ? first?.sku ?? "" : "",
    stock: !axes && first && Number.isFinite(first.stock) && first.stock < Number.MAX_SAFE_INTEGER ? String(first.stock) : "",
    published: product.published,
    options,
    variants: axes ? product.variants : [],
  };
  return {
    draft,
    persisted: { variantIds: product.variants.map((variant) => variant.id), standardVariantId: !axes ? first?.id : undefined, imageUrl },
  };
}
