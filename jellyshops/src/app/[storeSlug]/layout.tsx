import { StorefrontFrame } from "@/components/storefront-frame";
import { StorefrontCatalogSync } from "@/features/commerce/components/storefront-catalog-sync";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  return <StorefrontFrame storeSlug={storeSlug}><StorefrontCatalogSync storeSlug={storeSlug} />{children}</StorefrontFrame>;
}
