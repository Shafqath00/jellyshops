export function commerceStoreId(storeSlug: string, fallback = "store-demo"): string {
  return process.env.NEXT_PUBLIC_DEMO_STOREFRONT_ID ?? (storeSlug === "sweet-bakes" ? "store-demo" : fallback);
}
