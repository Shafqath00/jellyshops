import { StorefrontFrame } from "@/components/storefront-frame";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  return <StorefrontFrame storeSlug={storeSlug}>{children}</StorefrontFrame>;
}
