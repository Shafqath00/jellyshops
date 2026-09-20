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
import { resolveDesignTokens, resolveTheme } from "@jelly/storefront-themes";
import type { Currency, Product } from "@/lib/domain";
import { formatMoney } from "@/lib/domain";
import type { ResolvedStorefrontRoute } from "./resource-loader";

function commerceProvider(storeSlug: string, currency: Currency, products: Product[]): CommerceDataProvider {
  return {
    async getProducts() {
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
  if (route.status !== "ready") return null;
  const resolvedTheme = resolveTheme(snapshot.theme.id ?? snapshot.theme.presetId, snapshot.theme.settings, snapshot.theme.version);
  const themeId = resolvedTheme.id as ThemeId;
  const style = resolveDesignTokens(themeId, runtimeThemeSettings(snapshot)) as CSSProperties;
  const commerce = commerceProvider(storeSlug, currency, products);

  return (
    <div className={`jelly-storefront jelly-theme-layout-${resolvedTheme.layout}`} data-jelly-theme={resolvedTheme.id} data-jelly-theme-version={resolvedTheme.version} style={style}>
      {resolvedTheme.layout === "editorial" ? <div className="jelly-theme-masthead"><span>JellyShop collection</span><img src={`${resolvedTheme.assetPrefix}monogram.svg`} alt="" /></div> : null}
      <main className={resolvedTheme.layout === "editorial" ? "jelly-theme-editorial-main" : undefined}>
        {route.sections.map((section) => (
          <RegistrySectionRenderer
            key={section.id}
            section={section}
            mode="published"
            commerce={commerce}
            region="template"
            themeId={resolvedTheme.id}
          />
        ))}
      </main>
    </div>
  );
}
