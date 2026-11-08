import { isProductMediaEnabled } from "@jelly/storefront-schema";

export function isProductMediaEnabledForStore(storeId: string): boolean {
  return isProductMediaEnabled(storeId, process.env.PRODUCT_MEDIA_STORE_IDS);
}
