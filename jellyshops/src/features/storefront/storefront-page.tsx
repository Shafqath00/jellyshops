"use client";
import { useResourceLinks } from "@/features/navigation/use-resource-links";
import { useShop } from "@/contexts/shop-context";
import { useStorefrontChrome } from "./chrome-context";
import { fetchPublicMetaobjects } from "./metaobjects-api";
import { productCardData } from "./product-card-data";
import { suggestStoreProducts } from "./product-suggestions";
import { useStorefrontLanguage } from "./storefront-language";
import type { CSSProperties } from "react";
import { type StorefrontCartAccess,
  createCollectionLinks,
  StorefrontRenderer,
  ThemeCustomCss,
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
import { cardFitAttribute, cardLayoutAttribute, resolveDesignTokens, resolveStorefrontThemeTokens, resolveTheme, legacyStylesAttribute, themeStyleId, usesProductCompare } from "@jelly/storefront-themes";
import type { Currency, Product } from "@/lib/domain";
import type { ResolvedStorefrontRoute } from "./resource-loader";
import { RuntimeStorefrontView } from "./runtime-storefront-view";
import { useBagCount, useStorefrontCartAccess } from "./storefront-cart-access";
import { useCompareList } from "./compare-list";
import { useRecentlyViewed } from "./recently-viewed";
import { useCatalogBrowse } from "./catalog-browse-api";
import { useReviewSummaries, useStorefrontReviewAccess } from "./reviews-api";
import { catalogProductToStorefrontProduct, type PublicCatalogResponse } from "@/features/commerce/api/client";

function commerceProvider(storeSlug: string, currency: Currency, products: Product[], storeId?: string, cart?: StorefrontCartAccess, reviewData?: Pick<CommerceDataProvider, "ratings" | "reviews">): CommerceDataProvider {
  const initialProducts = products.filter((product) => product.published && !product.archived).map((product) => productCardData(product, `/${storeSlug}/products/${product.slug}`, currency));
  return {
    initialProducts,
    cart,
    suggestProducts: suggestStoreProducts(products, storeSlug, currency),
    ratings: reviewData?.ratings,
    reviews: reviewData?.reviews,
    getMetaobjects: storeId ? (handle) => fetchPublicMetaobjects(storeId, handle) : undefined,
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
        return data.nodes.map(catalogProductToStorefrontProduct).map((product) => productCardData(product, `/${storeSlug}/products/${product.slug}`, currency));
      }
      return products
        .filter((product) => product.published && !product.archived)
        .map((product) => productCardData(product, `/${storeSlug}/products/${product.slug}`, currency));
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
  const cart = useStorefrontCartAccess(storeSlug);
  return <StorefrontRenderer document={document} page="home" pageId={pageId} mode="published" commerce={commerceProvider(storeSlug, currency, products, undefined, cart)} assetResolver={{ resolve: async () => null }} />;
}

export function PublishedRuntimeStorefront({ snapshot, route, storeSlug, currency, products }: {
  snapshot: RuntimeStorefrontSnapshotV4;
  route: ResolvedStorefrontRoute;
  storeSlug: string;
  currency: Currency;
  products: Product[];
}) {
  const chromeHandled = useStorefrontChrome();
  const cart = useStorefrontCartAccess(storeSlug);
  const bagCount = useBagCount(storeSlug);
  const ratings = useReviewSummaries(snapshot.storeId, products.map((product) => product.id));
  const reviews = useStorefrontReviewAccess(snapshot.storeId);
  const { access: compare } = useCompareList(storeSlug);
  // Opening a product page adds it to the shopper's own "Recently viewed" list (kept in their browser).
  const recentlyViewed = useRecentlyViewed(storeSlug, route.status === "ready" && route.context.pageType === "product" ? route.context.resource.id : undefined);
  const browseProducts = useCatalogBrowse(snapshot.storeId, storeSlug, currency);
  const { language } = useStorefrontLanguage();
  const { state } = useShop();
  const resourceLinks = useResourceLinks(snapshot.storeId, storeSlug, state.products);
  const collectionLinks = createCollectionLinks(snapshot.storeId, storeSlug, state.collections);
  if (route.status !== "ready") return null;
  const resolvedTheme = resolveTheme(snapshot.theme.id ?? snapshot.theme.presetId, snapshot.theme.settings, snapshot.theme.version);
  const themeId = resolvedTheme.id as ThemeId;
  const style = resolveStorefrontThemeTokens(themeId, resolvedTheme.settings, {}, resolvedTheme.version) as CSSProperties;
  const commerce = { ...commerceProvider(storeSlug, currency, products, snapshot.storeId, cart, { ratings, reviews }), compare: usesProductCompare(resolvedTheme.settings) ? compare : undefined, bagCount, recentlyViewed, browseProducts };

  return (
    <div className={`jelly-storefront jelly-theme-layout-${resolvedTheme.layout}`} data-jelly-theme={themeStyleId(resolvedTheme.id, resolvedTheme.version)} data-jelly-legacy-styles={legacyStylesAttribute(resolvedTheme.id, resolvedTheme.version)} data-jelly-theme-version={resolvedTheme.version} data-card-layout={cardLayoutAttribute(style)} data-card-fit={cardFitAttribute(style)} style={style}>
      {/* Inside the storefront frame the frame already adds the theme's custom CSS. */}
      {!chromeHandled && <ThemeCustomCss settings={resolvedTheme.settings} themeId={resolvedTheme.id} themeVersion={resolvedTheme.version} />}
      <RuntimeStorefrontView route={route} commerce={commerce} themeId={resolvedTheme.id} themeVersion={resolvedTheme.version} menus={snapshot.menus} storeSlug={storeSlug} resourceLinks={resourceLinks} collectionLinks={collectionLinks} language={language} chrome={!chromeHandled} />
    </div>
  );
}
