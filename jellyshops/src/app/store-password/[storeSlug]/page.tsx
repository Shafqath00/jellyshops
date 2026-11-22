import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { loadAccessStatus } from "@/features/storefront-access/access-api";
import { StorefrontPasswordPage } from "@/features/storefront-access/password-page";

/**
 * The password page of a protected store. Shoppers never visit this address: `src/proxy.ts` shows it in place of a
 * store page until they enter the password. It is the same for everyone, so it may be cached with the store.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };
export function generateStaticParams() { return []; }

export default async function StorePasswordPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  const status = await loadAccessStatus(data.store.id, undefined);
  return <StorefrontPasswordPage storeSlug={data.store.slug} storeName={data.store.name} message={status.message} />;
}
