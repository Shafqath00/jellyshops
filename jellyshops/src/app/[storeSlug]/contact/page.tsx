import type { Metadata } from "next";
import { ContactForm } from "@/features/customers/contact-form";
import { ServerContentPage } from "@/features/storefront/server-content-page";
import { getServerStorefront } from "@/features/storefront/server-storefront";

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  return { title: data ? `Contact ${data.store.name}` : "Contact", ...(data ? {} : { robots: { index: false, follow: false } }) };
}

export default async function ContactPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) return null;
  return <><ServerContentPage storeSlug={storeSlug} type="page" handle="contact" /><main className="signature-page"><ContactForm storeId={data.store.id} /></main></>;
}
