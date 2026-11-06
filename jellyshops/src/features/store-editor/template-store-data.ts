import type { CommerceDataProvider, PublicProduct } from "@jelly/storefront-renderer";
import { catalogProductToProduct } from "@/features/storefront/product-presentation";
import { productCardData } from "@/features/storefront/product-card-data";
import type { Currency } from "@/lib/domain";
import type { CatalogAdminProduct } from "./api/types";

/** What the store design preview shows of the merchant's own store: its name, logo and products. */
export interface TemplateStoreData {
  name: string;
  logoUrl?: string;
  products: PublicProduct[];
}

const CURRENCIES: readonly Currency[] = ["GBP", "INR", "USD"];

/** The store's published products as product cards (at most 24), for the store design preview. */
export function templateStoreProducts(nodes: CatalogAdminProduct[], storeSlug: string, currency: string): PublicProduct[] {
  const money = (CURRENCIES as readonly string[]).includes(currency) ? currency as Currency : "GBP";
  return nodes.map(catalogProductToProduct)
    .filter((product) => product.published && !product.archived)
    .slice(0, 24)
    .map((product) => productCardData(product, `/${storeSlug}/products/${product.slug}`, money));
}

/** The logo from the store's theme settings (branding.logoUrl), when it is a usable link. */
export function templateStoreLogo(settings: Record<string, unknown> | undefined): string | undefined {
  const branding = settings?.branding;
  const url = branding && typeof branding === "object" ? (branding as Record<string, unknown>).logoUrl : undefined;
  return typeof url === "string" && /^(https:\/\/|\/)/.test(url.trim()) ? url.trim() : undefined;
}

/** Product lists in the preview show the store's own products (or nothing, like a new store, when it has none). */
export function templateStoreCommerce(products: PublicProduct[]): CommerceDataProvider {
  return {
    initialProducts: products,
    async getProducts(input) {
      return typeof input?.limit === "number" ? products.slice(0, Math.max(0, input.limit)) : products;
    },
  };
}
