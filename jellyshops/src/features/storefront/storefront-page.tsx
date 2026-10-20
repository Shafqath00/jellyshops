"use client";
import { useStorefrontChrome } from "./chrome-context";
import type { CSSProperties } from "react";
import {
  RegistrySectionRenderer,
  StorefrontRenderer,
  type CommerceDataProvider,
} from "@jelly/storefront-renderer";
import {
  createDefaultStorefrontDocument,
  type GlobalSettings,
  type RuntimeStorefrontSnapshotV4,
  type StoreDesignDocument,
  type StorefrontDocument,
  type ThemeId,
} from "@jelly/storefront-schema";
import { resolveDesignTokens, resolveStorefrontThemeTokens, resolveTheme } from "@jelly/storefront-themes";
import type { Currency, Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";
import type { ResolvedStorefrontRoute } from "./resource-loader";
import { catalogProductToStorefrontProduct, type PublicCatalogResponse } from "@/features/commerce/api/client";

function commerceProvider(storeSlug: string, currency: Currency, products: Product[], storeId?: string): CommerceDataProvider {
  const initialProducts = products.filter((product) => product.published && !product.archived).map((product) => ({ id: product.id, name: product.name, href: `/${storeSlug}/products/${product.slug}`, imageUrl: product.imageUrl, price: formatMoney(product.variants[0]?.priceMinor ?? 0, currency) }));
  return {
    initialProducts,
    subscribeNewsletter: storeId ? async (email, source) => {
      const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
      const response = await fetch(`${origin}/api/public/stores/${encodeURIComponent(storeId)}/engagement/newsletter`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, source, consent: true }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error?.message ?? "Unable to subscribe. Please retry."); }
    } : undefined,
    async getProducts(input) {
      if (storeId && (input?.sort || input?.collectionId)) {
        const params = new URLSearchParams({ limit: String(input.limit ?? 6) });
        if (input.sort) params.set("sort", input.sort);
        if (input.collectionId) params.set("collectionId", input.collectionId);
        const response = await fetch(`${process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001"}/api/public/stores/${encodeURIComponent(storeId)}/catalog/products?${params}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Products are temporarily unavailable.");
        const data = await response.json() as PublicCatalogResponse;
        return data.nodes.map(catalogProductToStorefrontProduct).map((product) => ({ id: product.id, name: product.name, href: `/${storeSlug}/products/${product.slug}`, imageUrl: product.imageUrl, price: formatMoney(product.variants[0]?.priceMinor ?? 0, currency) }));
      }
      return products
        .filter((product) => product.published && !product.archived)
        .map((product) => ({
          id: product.id,
          name: product.name,
          href: `/${storeSlug}/products/${product.slug}`,
          imageUrl: product.imageUrl,
          price: formatMoney(product.variants[0]?.priceMinor ?? 0, currency),
        }));
    },
  };
}

function runtimeThemeSettings(snapshot: RuntimeStorefrontSnapshotV4): GlobalSettings {
  const themeId = resolveTheme(snapshot.theme.id ?? snapshot.theme.presetId, snapshot.theme.settings, snapshot.theme.version).id as ThemeId;
  const defaults = createDefaultStorefrontDocument(snapshot.storeId, themeId).theme.settings;
  const input = snapshot.theme.settings as Partial<GlobalSettings>;
  return {
    colors: { ...defaults.colors, ...(input.colors ?? {}) },
    typography: { ...defaults.typography, ...(input.typography ?? {}) },
    buttons: { ...defaults.buttons, ...(input.buttons ?? {}) },
    layout: { ...defaults.layout, ...(input.layout ?? {}) },
    productCards: { ...defaults.productCards, ...(input.productCards ?? {}) },
  };
}

export function PublishedStorefront({ document, storeSlug, currency, products, pageId }: { document: StoreDesignDocument | StorefrontDocument; storeSlug: string; currency: Currency; products: Product[]; pageId?: string }) {
  return <StorefrontRenderer document={document} page="home" pageId={pageId} mode="published" commerce={commerceProvider(storeSlug, currency, products)} assetResolver={{ resolve: async () => null }} />;
}

export function PublishedRuntimeStorefront({ snapshot, route, storeSlug, currency, products }: {
  snapshot: RuntimeStorefrontSnapshotV4;
  route: ResolvedStorefrontRoute;
  storeSlug: string;
  currency: Currency;
  products: Product[];
}) {
  const chromeHandled = useStorefrontChrome();
  if (route.status !== "ready") return null;
  const resolvedTheme = resolveTheme(snapshot.theme.id ?? snapshot.theme.presetId, snapshot.theme.settings, snapshot.theme.version);
  const themeId = resolvedTheme.id as ThemeId;
  const style = resolveStorefrontThemeTokens(themeId, resolvedTheme.settings) as CSSProperties;
  const commerce = commerceProvider(storeSlug, currency, products, snapshot.storeId);

  return (
    <div className={`jelly-storefront jelly-theme-layout-${resolvedTheme.layout}`} data-jelly-theme={resolvedTheme.id} data-jelly-theme-version={resolvedTheme.version} style={style}>
      {resolvedTheme.layout === "editorial" ? <div className="jelly-theme-masthead"><span>JellyShop collection</span><img src={`${resolvedTheme.assetPrefix}monogram.svg`} alt="" /></div> : null}
      {!chromeHandled && route.layout.announcement.map((section) => <RegistrySectionRenderer key={section.id} section={section} mode="published" commerce={commerce} region="header" themeId={resolvedTheme.id} page={route.context} menus={snapshot.menus} storeSlug={storeSlug} />)}
      {!chromeHandled && route.layout.header.map((section) => <RegistrySectionRenderer key={section.id} section={section} mode="published" commerce={commerce} region="header" themeId={resolvedTheme.id} page={route.context} menus={snapshot.menus} storeSlug={storeSlug} />)}
      <main className={resolvedTheme.layout === "editorial" ? "jelly-theme-editorial-main" : undefined}>
        {route.layout.template.map((section) => (
          <RegistrySectionRenderer
            key={section.id}
            section={section}
            mode="published"
            commerce={commerce}
            region="template"
            themeId={resolvedTheme.id}
            page={route.context}
            menus={snapshot.menus}
            storeSlug={storeSlug}
          />
        ))}
      </main>
      {!chromeHandled && route.layout.footer.map((section) => <RegistrySectionRenderer key={section.id} section={section} mode="published" commerce={commerce} region="footer" themeId={resolvedTheme.id} page={route.context} menus={snapshot.menus} storeSlug={storeSlug} />)}
    </div>
  );
}
