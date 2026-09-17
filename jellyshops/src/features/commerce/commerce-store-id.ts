export function commerceStoreId(storeSlug: string, fallback = "store-demo"): string {
  if (process.env.NEXT_PUBLIC_DEMO_STOREFRONT_ID) return process.env.NEXT_PUBLIC_DEMO_STOREFRONT_ID;
  if (storeSlug === "sweet-bakes") return "store-demo";
  if (storeSlug === "bloom-home") return "store-bloom-home";
  return fallback;
}
