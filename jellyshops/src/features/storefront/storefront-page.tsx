import { StorefrontRenderer, type CommerceDataProvider } from "@jelly/storefront-renderer";
import type { StoreDesignDocument, StorefrontDocument } from "@jelly/storefront-schema";
import type { Currency, Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";

export function PublishedStorefront({ document, storeSlug, currency, products, pageId }: { document: StoreDesignDocument | StorefrontDocument; storeSlug: string; currency: Currency; products: Product[]; pageId?: string }) {
  const commerce: CommerceDataProvider = { async getProducts() { return products.filter((product) => product.published && !product.archived).map((product) => ({ id: product.id, name: product.name, href: `/${storeSlug}/products/${product.slug}`, imageUrl: product.imageUrl, price: formatMoney(product.variants[0]?.priceMinor ?? 0, currency) })); } };
  return <StorefrontRenderer document={document} page="home" pageId={pageId} mode="published" commerce={commerce} assetResolver={{ resolve: async () => null }} />;
}
