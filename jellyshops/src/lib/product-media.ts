import { isProductMediaEnabled, resolveProductGallery } from "@jelly/storefront-schema";
import type { ConfiguredOptionSelection, Product, ProductVariant } from "./domain";
import { resolveProductVariant } from "./product-configuration";

/** A photo the merchant chose for the exact combination comes first; the rest keep their order. */
export function withVariantPhotoFirst<T extends { id: string }>(gallery: T[], allPhotos: T[], variant: Pick<ProductVariant, "mediaId"> | undefined): T[] {
  const photo = variant?.mediaId ? allPhotos.find((item) => item.id === variant.mediaId) : undefined;
  return photo ? [photo, ...gallery.filter((item) => item.id !== photo.id)] : gallery;
}

export function productGallery(product: Product, selections: ConfiguredOptionSelection[] = []) {
  const media = product.media ?? (product.imageUrl ? [{ id: `${product.id}-primary`, url: product.imageUrl }] : []);
  const gallery = isProductMediaEnabled(product.storeId, process.env.NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS)
    ? resolveProductGallery(media, product.options ?? [], selections)
    : media;
  return withVariantPhotoFirst(gallery, media, product.variants ? resolveProductVariant(product, selections) : undefined);
}

export function cartProductImage(product: Product, variant: ProductVariant, selections: ConfiguredOptionSelection[] = []): string {
  const selected = [...selections];
  for (const [optionId, valueId] of Object.entries(variant.options ?? {})) {
    if (typeof valueId === "string" && !selected.some((pick) => pick.optionId === optionId)) selected.push({ optionId, valueId });
  }
  const enabled = isProductMediaEnabled(product.storeId, process.env.NEXT_PUBLIC_PRODUCT_MEDIA_STORE_IDS);
  return productGallery(product, selected)[0]?.url ?? product.imageUrl;
}
