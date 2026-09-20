export function commerceStoreId(storeSlug: string, fallback = "store-sweet-bakes"): string {
  if (process.env.NEXT_PUBLIC_DEMO_STOREFRONT_ID) return process.env.NEXT_PUBLIC_DEMO_STOREFRONT_ID;
  if (storeSlug === "sweet-bakes") return "store-sweet-bakes";
  if (storeSlug === "bloom-home") return "store-bloom-home";
  return fallback;
}
