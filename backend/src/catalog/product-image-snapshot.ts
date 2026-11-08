import { resolveProductGallery, type OptionSelection, type ProductMediaLike, type ProductOptionLike } from "@jelly/storefront-schema";
import { isProductMediaEnabledForStore } from "./product-media-feature.js";

/** The line's actual stock choice fills legacy lines that predate configuration selections. */
export function productImageSnapshot(storeId: string, media: ProductMediaLike[], rawOptions: unknown[], selections: OptionSelection[], variantOptions: Record<string, unknown> = {}, preferredMediaId: string | null = null): string | null {
  // A photo the merchant chose for this exact combination wins over the choice-based gallery.
  const preferred = preferredMediaId ? media.find((item) => item.id === preferredMediaId) : undefined;
  if (preferred) return preferred.url;
  if (!isProductMediaEnabledForStore(storeId)) return media[0]?.url ?? null;
  const options = rawOptions.map(raw => {
    const option = raw as ProductOptionLike;
    return { ...option, values: option.values ?? [] };
  });
  const resolvedSelections = [...selections];
  for (const option of options) {
    if (resolvedSelections.some(selection => selection.optionId === option.id)) continue;
    const actual = variantOptions[option.id];
    if (typeof actual === "string" && option.values.some(value => value.id === actual)) resolvedSelections.push({ optionId: option.id, valueId: actual });
  }
  return resolveProductGallery(media, options, resolvedSelections)[0]?.url ?? null;
}
