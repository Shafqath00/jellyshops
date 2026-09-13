"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Sparkle } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { useShop } from "@/contexts/shop-context";
import {
  PublishedRuntimeStorefront,
  PublishedStorefront,
} from "@/features/storefront/storefront-page";
import {
  loadPublicStorefrontPublication,
  type PublicStorefrontPublication,
} from "@/features/storefront/public-storefront-api";
import { expandRuntimeTemplate, type ResolvedStorefrontRoute } from "@/features/storefront/resource-loader";
import { migrateStorefrontDocument, type StorefrontDocument } from "@jelly/storefront-schema";

function homeRoute(publication: Extract<PublicStorefrontPublication, { kind: "v4" }>): ResolvedStorefrontRoute {
  const templateId = publication.snapshot.templateDefaults.home;
  const template = templateId ? publication.snapshot.templates[templateId] : undefined;
  if (!template) return { status: "not-found", reason: "template" };
  return {
    status: "ready",
    resource: null,
    template,
    sections: expandRuntimeTemplate(publication.snapshot, template),
  };
}

export default function StoreHomePage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { repository } = useShop();
  const store = repository.getStoreBySlug(storeSlug);
  const storeId = store?.id;
  const localPublication = store ? repository.getPublishedStoreDesign(store.id) : null;
  const fallbackDocument = useMemo<StorefrontDocument | null>(
    () => localPublication ? migrateStorefrontDocument(localPublication.document, "store-demo") : null,
    [localPublication],
  );
  const [remotePublication, setRemotePublication] = useState<PublicStorefrontPublication | null>(null);

  useEffect(() => {
    if (storeSlug !== "sweet-bakes") return;
    let active = true;
    void loadPublicStorefrontPublication({
      baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
      storeId: "store-demo",
    }).then((publication) => {
      if (active) setRemotePublication(publication);
    });
    return () => { active = false; };
  }, [storeId, storeSlug]);

  if (!store) return null;
  const products = repository.listProducts(storeSlug).filter((product) => product.published && !product.archived);

  if (remotePublication?.kind === "v4") {
    return (
      <PublishedRuntimeStorefront
        snapshot={remotePublication.snapshot}
        route={homeRoute(remotePublication)}
        storeSlug={store.slug}
        currency={store.currency}
        products={products}
      />
    );
  }

  if (remotePublication?.kind === "v3") {
    return <PublishedStorefront document={remotePublication.document} storeSlug={store.slug} currency={store.currency} products={products} />;
  }

  if (fallbackDocument) {
    return <PublishedStorefront document={fallbackDocument} storeSlug={store.slug} currency={store.currency} products={products} />;
  }

  const featured = products.filter((product) => product.featured).slice(0, 3);
  return (
    <main className="text-[var(--store-text)]">
      <section className="grid min-h-[calc(100vh-74px)] border-b border-[color-mix(in_srgb,var(--store-text)_20%,transparent)] lg:grid-cols-[.86fr_1.14fr]">
        <div className="flex min-h-[520px] flex-col justify-center px-[clamp(20px,6vw,90px)] py-[clamp(60px,8vw,120px)]">
          <p className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--store-accent)]"><Sparkle size={14} /> Baked in small batches</p>
          <h1 className="my-[22px] max-w-[720px] font-[var(--store-display,Georgia)] text-[clamp(4rem,7.6vw,8.5rem)] leading-[.82] tracking-[-.07em]">{store.tagline}</h1>
          <p className="mb-[30px] max-w-[500px] leading-relaxed opacity-70">{store.description}</p>
          <Link className="inline-flex min-h-[50px] w-fit items-center gap-2 rounded-[999px_999px_999px_14px] border-[1.5px] border-[var(--store-text)] bg-[var(--store-text)] px-5 text-[13px] font-extrabold text-[var(--store-bg)]" href={`/${store.slug}/shop`}>Shop today’s treats <ArrowRight size={18} /></Link>
        </div>
        <div className="relative min-h-[480px] overflow-hidden lg:min-h-[680px]">
          <Image src={store.bannerUrl} alt={`A selection from ${store.name}`} fill priority sizes="(max-width: 800px) 100vw, 55vw" className="object-cover" />
          <span className="absolute bottom-7 left-7 grid size-[118px] place-items-center rounded-[52%_48%_56%_44%] border-2 border-[var(--store-text)] bg-[var(--store-accent-soft)] text-center font-[var(--store-display,Georgia)] text-base font-bold -rotate-6">Made today<br />Loved tonight</span>
        </div>
      </section>
      <section className="overflow-hidden border-b border-[color-mix(in_srgb,var(--store-text)_20%,transparent)] bg-[var(--store-accent-soft)]">
        <div className="flex min-h-[58px] min-w-max items-center justify-around gap-12 px-6 font-[var(--store-display,Georgia)] text-lg italic"><span>Hand-finished</span><i className="not-italic text-[var(--store-accent)]">✦</i><span>Freshly baked</span><i className="not-italic text-[var(--store-accent)]">✦</i><span>Local delivery</span><i className="not-italic text-[var(--store-accent)]">✦</i><span>Small joys</span></div>
      </section>
      <section className="px-[clamp(20px,6vw,90px)] py-[clamp(70px,9vw,130px)]">
        <div className="mb-9 flex items-end justify-between gap-5"><div><span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[var(--store-accent)]">Something lovely</span><h2 className="mt-2 font-[var(--store-display,Georgia)] text-[clamp(2.3rem,4vw,4rem)] tracking-[-.055em]">Shop the favourites</h2></div><Link className="flex items-center gap-2 border-b pb-1.5 text-xs font-bold" href={`/${store.slug}/shop`}>See everything <ArrowRight size={16} /></Link></div>
        <div className="grid grid-cols-2 gap-[clamp(15px,2.5vw,34px)] md:grid-cols-3">{featured.map((product) => <ProductCard key={product.id} product={product} storeSlug={store.slug} currency={store.currency} />)}</div>
      </section>
    </main>
  );
}
