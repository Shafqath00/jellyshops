"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { migrateStorefrontDocument } from "@jelly/storefront-schema";
import { useShop } from "@/contexts/shop-context";
import { PublishedStorefront } from "@/features/storefront/storefront-page";
import { useThemePresentation } from "@/components/storefront-shell";

export default function CustomStorePage() {
  const { storeSlug, pageSlug } = useParams<{
    storeSlug: string;
    pageSlug: string;
  }>();
  const { shell, settings } = useThemePresentation();
  const { repository } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const publication = store
    ? repository.getPublishedStoreDesign(store.id)
    : undefined;

  if (!store || !publication) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-6 text-center">
        <div>
          <h1 className="font-[var(--store-display,Georgia)] text-5xl">
            Page not found
          </h1>
          <Link className="mt-5 inline-block border-b text-sm font-bold" href={`/${storeSlug}`}>
            Return home
          </Link>
        </div>
      </main>
    );
  }

  const document = migrateStorefrontDocument(
    publication.document,
    store.id,
  );
  const page = document.pages.find(
    (entry) =>
      entry.type === "custom" &&
      entry.slug === pageSlug,
  );

  if (!page) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-6 text-center">
        <div>
          <h1 className="font-[var(--store-display,Georgia)] text-5xl">
            Page not found
          </h1>
          <Link className="mt-5 inline-block border-b text-sm font-bold" href={`/${store.slug}`}>
            Return home
          </Link>
        </div>
      </main>
    );
  }

  const products = repository
    .listProducts(storeSlug)
    .filter((product) => product.published && !product.archived);

  const ContentPage = shell.ContentPage;
  return <ContentPage store={{ name: store.name, slug: store.slug, tagline: store.tagline, logoUrl: store.logoUrl }} settings={settings} pageSlug={pageSlug}>
    <PublishedStorefront
      document={document}
      storeSlug={store.slug}
      currency={store.currency}
      products={products}
      pageId={page.id}
    />
  </ContentPage>;
}
