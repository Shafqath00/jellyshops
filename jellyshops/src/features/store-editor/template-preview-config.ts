import type { V4StarterPack } from "@jelly/storefront-registry";
import { jellyMinimalPreview, themePreviewEntries, type ThemePreviewConfig } from "@/features/theme-preview/configs";
import type { TemplateStoreData } from "./template-store-data";

/**
 * The sample catalogue and copy a store design is previewed with. Designs with their own theme preview
 * use it; the others (the Fresh Market and Artisan Boutique presets) borrow Jelly Minimal's sample shop
 * with their own theme and starter pages. When the merchant has products, the product lists show them
 * under the store's own name.
 */
export function templatePreviewConfig(starter: Pick<V4StarterPack, "id" | "name" | "theme">, store?: TemplateStoreData): ThemePreviewConfig {
  const own = themePreviewEntries().find((entry) => entry.config.packId === starter.id)?.config;
  const base: ThemePreviewConfig = own ?? { ...jellyMinimalPreview, themeId: starter.theme.themeId, packId: starter.id, name: starter.name, useStarterMenu: true };
  if (!store?.products.length) return base;
  const [first, second] = store.products;
  return { ...base, name: store.name, products: store.products, cart: second ? { [first.id]: 1, [second.id]: 2 } : { [first.id]: 1 } };
}
