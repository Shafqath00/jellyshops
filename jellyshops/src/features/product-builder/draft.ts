import { majorToMinor, slugify } from "@/lib/domain";
import { validateProductDraft } from "@/lib/product-builder";

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
}

export const emptyDraft: ProductDraft = { title: "", description: "", imageUrl: "", categoryId: "", price: "", compareAtPrice: "", sku: "", stock: "", published: true };

export type DraftField = keyof ProductDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

const isWholeNumber = (text: string) => /^\d{1,9}$/.test(text.trim());

/** Field-level errors for the simple (no-choices) product. Empty object means ready to save. */
export function validateSimpleDraft(draft: ProductDraft): DraftErrors {
  const errors: DraftErrors = {};
  const price = majorToMinor(draft.price);
  const compareAt = draft.compareAtPrice.trim() ? majorToMinor(draft.compareAtPrice) : undefined;
  if (!draft.title.trim()) errors.title = "Give your product a name.";
  if (!draft.price.trim()) errors.price = "Enter a price.";
  else if (!Number.isFinite(price) || price < 0) errors.price = "Enter a valid price, like 499 or 499.50.";
  if (compareAt !== undefined) {
    if (!Number.isFinite(compareAt) || compareAt < 0) errors.compareAtPrice = "Enter a valid price, like 599.";
    else if (Number.isFinite(price) && compareAt <= price) errors.compareAtPrice = "The original price should be higher than the price.";
  }
  if (draft.stock.trim() && !isWholeNumber(draft.stock)) errors.stock = "Stock must be a whole number, 0 or more.";
  return errors;
}

export function draftToVariant(draft: ProductDraft, id = "") {
  return { id, name: "Standard", sku: draft.sku.trim(), priceMinor: majorToMinor(draft.price), stock: Number(draft.stock || 0), options: {} as Record<string, string> };
}

/** Shared-package check on top of the field checks, so the builder and the API agree on what blocks saving. */
export function validateDraftForPublish(draft: ProductDraft) {
  return validateProductDraft({ title: draft.title, options: [], inventoryOptionIds: [], variants: [draftToVariant(draft)], mediaCount: draft.imageUrl ? 1 : 0 });
}

/** Request body for the catalog API: one Standard variant, no choices yet. */
export function draftToPayload(draft: ProductDraft, categoryName: string | undefined) {
  const priceMinor = majorToMinor(draft.price);
  const compareAt = draft.compareAtPrice.trim() ? majorToMinor(draft.compareAtPrice) : 0;
  return {
    ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
    handle: slugify(draft.title.trim()),
    title: draft.title.trim(),
    description: draft.description.trim(),
    productType: categoryName ?? "Other",
    status: draft.published ? "ACTIVE" as const : "DRAFT" as const,
    primaryCategoryId: draft.categoryId || undefined,
    options: [] as unknown[],
    inventoryOptionIds: [] as string[],
    variants: [{
      title: "Standard",
      sku: draft.sku.trim() || undefined,
      priceMinor,
      compareAtPriceMinor: compareAt > 0 ? compareAt : null,
      quantity: Number(draft.stock || 0),
      trackInventory: true,
      options: {} as Record<string, string>,
    }],
  };
}
