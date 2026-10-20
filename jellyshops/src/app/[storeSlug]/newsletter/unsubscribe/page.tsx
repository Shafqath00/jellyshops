import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsletterUnsubscribe } from "@/features/customers/newsletter-unsubscribe";
import { getServerStorefront } from "@/features/storefront/server-storefront";

export const metadata: Metadata = { title: "Newsletter preferences", robots: { index: false, follow: false } };
export default async function NewsletterUnsubscribePage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<{ token?: string | string[] }> }) {
  const [{ storeSlug }, query] = await Promise.all([params, searchParams]);
  const token = typeof query.token === "string" ? query.token : "";
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  return <main className="signature-page"><NewsletterUnsubscribe storeId={data.store.id} token={token} /></main>;
}
