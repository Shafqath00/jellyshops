import type { Metadata } from "next";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import PublicOrderView from "./view";

// An order page is private to whoever holds the link: keep it out of search engines and link previews.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * The shop is already loaded by the store layout (same request, cached), so its id
 * goes straight to the browser and the order is asked for as soon as the page runs.
 */
export default async function PublicOrderPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const storefront = await getServerStorefront(storeSlug);
  return <PublicOrderView storeId={storefront?.store.id} />;
}
