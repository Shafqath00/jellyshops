"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommerceDataProvider, PublicProduct, StorefrontCartAccess, StorefrontPageContext } from "@jelly/storefront-renderer";
import { getStarterPack, resolveTheme, usesProductCompare } from "@jelly/storefront-themes";
import type { RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";
import type { ConfiguredOptionSelection } from "@/lib/domain";
import { createProductPresentationContext } from "@/features/storefront/product-presentation";
import { resolveStorefrontRoute, type PublicResourceReader, type PublicResourceType, type ResolvedStorefrontRoute, type StorefrontRouteRequest } from "@/features/storefront/resource-loader";
import { RuntimeStorefrontView } from "@/features/storefront/runtime-storefront-view";
import { previewCatalogProduct, snapshotFromStarterPack } from "./preview-fixtures";
import { sampleReviews } from "./sample-reviews";
import { MAX_COMPARE, useCompareList } from "@/features/storefront/compare-list";
import type { CompareItem } from "@/features/storefront/compare-table";
import { ComparePageView, CompareTrayView } from "@/features/storefront/components/compare-view";
import type { ThemePreviewConfig } from "./configs";

/**
 * Renders a theme's starter template (home, product, collection, cart, search,
 * page or 404) with sample catalogue data through the live store's own path: the
 * starter pack becomes a published snapshot, `resolveStorefrontRoute` picks the
 * template and lays it out, the product page uses the live product logic, and
 * `RuntimeStorefrontView` draws the page. Only the data source differs.
 */
export type PreviewTemplate = "home" | "product" | "collection" | "cart" | "search" | "page" | "not-found" | "compare";

const menus: Record<string, RuntimeMenuV4> = {
  main: { id: "preview-main", handle: "main", items: [
    { id: "home", label: "Home", target: { kind: "home" }, children: [] },
    // Sub-links so the preview shows the header dropdown and the phone menu's fold-out group.
    { id: "shop", label: "Shop all", target: { kind: "search" }, children: [
      { id: "new", label: "New arrivals", target: { kind: "search" }, children: [] },
      { id: "best", label: "Best sellers", target: { kind: "search" }, children: [] },
      { id: "gifts", label: "Gifts", target: { kind: "search" }, children: [
        { id: "gifts-small", label: "Under £50", target: { kind: "search" }, children: [] },
      ] },
    ] },
    { id: "about", label: "About", target: { kind: "home" }, children: [] },
  ] },
};

/** Sample prices as a shop shows them: "£1,197.00". */
const pounds = (value: number) => `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The sample product page, built by the live product logic from a catalog-shaped sample product. */
export function useProductContext(config: ThemePreviewConfig): StorefrontPageContext {
  const [selections, setSelections] = useState<ConfiguredOptionSelection[]>([]);
  const [quantity, setQuantity] = useState(1);
  const product = previewCatalogProduct(config);
  const presentation = createProductPresentationContext({
    product, currency: "GBP", shippingCopy: config.product.shippingCopy, selections, quantity,
    onSelectionsChange: setSelections, onQuantityChange: setQuantity, onAddToCart: async () => ({ ok: true }),
    relatedProducts: config.products.filter((item) => item.id !== product.id).slice(0, 4),
  });
  if (config.product.showBuyNow !== false) presentation.buyNow = async () => ({ ok: true });
  return { pageType: "product", resource: { id: product.id, handle: product.slug, data: { title: product.name, product, productPresentation: presentation } } } as unknown as StorefrontPageContext;
}

export function useCartContext(config: ThemePreviewConfig): StorefrontPageContext {
  const [quantities, setQuantities] = useState<Record<string, number>>(config.cart);
  const second = Object.keys(config.cart)[1];
  const lines = config.products.filter((product) => quantities[product.id]).map((product) => {
    const unit = Number(product.price.replace(/[^0-9.]/g, ""));
    const quantity = quantities[product.id];
    const update = (next: number) => setQuantities((current) => { const copy = { ...current }; if (next <= 0) delete copy[product.id]; else copy[product.id] = next; return copy; });
    return { id: product.id, name: product.name, productName: product.name, variantName: product.id === second ? "Medium" : "Standard", imageUrl: product.imageUrl, quantity, unitPrice: product.price, total: pounds(unit * quantity), canIncrease: quantity < 5, onDecrease: () => update(quantity - 1), onIncrease: () => update(quantity + 1), onRemove: () => update(0), minor: unit * quantity * 100 };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.minor, 0) / 100;
  return { pageType: "cart", resource: null, data: { lines, subtotal: pounds(subtotal), shippingNote: "Free delivery on orders over £50. Taxes included.", checkoutHref: "#checkout", shopHref: "#shop" } };
}

/** `productLayout` overrides the product gallery's "Product page layout" setting, to review each layout. */
/** A bag that lives only in the preview, so the Quick add card style can be tried. */
export function usePreviewCart(): StorefrontCartAccess {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  return useMemo(() => ({
    quantity: (variantId: string) => quantities[variantId] ?? 0,
    async setQuantity(variantId: string, quantity: number) { setQuantities((current) => ({ ...current, [variantId]: quantity })); return { ok: true }; },
  }), [quantities]);
}

/** Sample products all count as single-variant products in the preview, so quick add shows on every card. */
export function withPreviewQuickAdd(products: PublicProduct[]): PublicProduct[] {
  return products.map((product) => ({ ...product, quickAdd: product.quickAdd ?? { variantId: `preview-${product.id}`, max: 10 } }));
}

/** Applies the preview's product or collection layout choice to the template's own section. */
function previewLayout(section: SectionNode, productLayout: string | undefined, collectionLayout: string | undefined, config: ThemePreviewConfig): SectionNode {
  if (productLayout && section.type === "product-gallery") return { ...section, settings: { ...section.settings, pageLayout: productLayout } };
  if (collectionLayout && section.type === "collection-product-grid") {
    const story = { id: "preview-story", type: "story-tile", enabled: true, settings: { heading: "Made in small batches", text: "Every piece in this collection is made to order by the same small team.", image: { url: config.products[1]?.imageUrl ?? "", alt: "" }, link: "/pages/about", linkLabel: "Our story", position: 2 } };
    return { ...section, settings: { ...section.settings, listLayout: collectionLayout }, blocks: collectionLayout === "editorial" ? [...section.blocks, story] : section.blocks } as SectionNode;
  }
  return section;
}

/** Whether the theme lets shoppers compare products (shows the Compare tab, ticks, tray). */
export function previewHasCompare(config: ThemePreviewConfig): boolean {
  return usesProductCompare(resolveTheme(config.themeId).settings);
}

/** The sample page context of every previewed page (the product and cart pages come from their hooks). */
export function previewPages(config: ThemePreviewConfig, productPage: StorefrontPageContext, cartPage: StorefrontPageContext): Record<PreviewTemplate, StorefrontPageContext> {
  return {
    home: { pageType: "home", resource: null },
    product: productPage,
    collection: {
      pageType: "collection",
      resource: { id: "c1", handle: "sample", data: { collectionPresentation: { collection: { id: "c1", ...config.collection }, products: config.products, totalProducts: config.products.length } } },
    } as StorefrontPageContext,
    cart: cartPage,
    search: { pageType: "search", resource: null, data: { query: config.searchQuery, state: "results", resultCount: 2, results: config.products.slice(0, 2), searchHref: "#search" } },
    page: {
      pageType: "page",
      resource: { id: "about", handle: "about", data: { title: config.page.title, content: { type: "doc", content: [
        { type: "paragraph", content: [{ type: "text", text: config.page.intro }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: config.page.heading }] },
        { type: "paragraph", content: [{ type: "text", text: config.page.body }] },
        { type: "bulletList", content: config.page.bullets.map((text) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })) },
      ] } } },
    } as unknown as StorefrontPageContext,
    "not-found": { pageType: "not-found", resource: null },
    compare: { pageType: "page", resource: null } as unknown as StorefrontPageContext,
  };
}

/** The route the live store would ask for to show this preview page (the compare page sits in the home page's frame). */
function routeRequest(template: PreviewTemplate, page: StorefrontPageContext): StorefrontRouteRequest {
  if (template === "compare" || template === "home") return { type: "home" };
  if (template === "cart" || template === "not-found") return { type: template };
  if (template === "search") return { type: "search", context: { type: "search", ...(page as Extract<StorefrontPageContext, { pageType: "search" }>).data } } as StorefrontRouteRequest;
  return { type: template, handle: (page.resource as { handle: string }).handle };
}

/** Sample resources served to the live loader as the API would serve them. */
function fixtureReader(pages: Record<PreviewTemplate, StorefrontPageContext>): PublicResourceReader {
  const resource = (type: PublicResourceType) => {
    const page = pages[type as PreviewTemplate];
    const source = page?.resource as { id: string; handle: string; data: Record<string, unknown> } | null | undefined;
    return source ? { type, id: source.id, handle: source.handle, visible: true, data: source.data } : null;
  };
  return {
    findByHandle: async (type, handle) => { const found = resource(type); return found?.handle === handle ? found : null; },
    findById: async (type, id) => { const found = resource(type); return found?.id === id ? found : null; },
  };
}

export function TemplatePreview({ template, config, productLayout, collectionLayout, onOpenCompare }: { template: PreviewTemplate; config: ThemePreviewConfig; productLayout?: string; collectionLayout?: string; onOpenCompare?: () => void }) {
  const productPage = useProductContext(config);
  const cartPage = useCartContext(config);
  // Built once per theme: getStarterPack returns a fresh copy each call, which would re-run the loader every render.
  const snapshot = useMemo(() => snapshotFromStarterPack(getStarterPack(config.packId), config.themeId), [config.packId, config.themeId]);
  // Themes that ship their own main menu are shown with it; the others with a sample menu that has dropdowns.
  const previewMenus = config.useStarterMenu ? snapshot.menus : menus;
  const cart = usePreviewCart();
  const products = withPreviewQuickAdd(config.products);
  // Comparing in the preview uses its own list, kept in this browser like the live store's.
  const compareOn = previewHasCompare(config);
  const { access: compare, ids: compareIds } = useCompareList(`theme-preview-${config.themeId}`);
  const compareItems = compareIds.flatMap((id): CompareItem[] => {
    const product = config.products.find((item) => item.id === id);
    return product ? [{ id: product.id, name: product.name, href: "#", imageUrl: product.imageUrl, price: product.price, vendor: product.vendor, available: product.available !== false, specifications: config.compareSpecifications?.[product.id] }] : [];
  });
  const commerce: CommerceDataProvider = { initialProducts: products, cart, ratings: config.ratings, reviews: sampleReviews, compare: compareOn ? compare : undefined, async getProducts(input) { return products.slice(0, input?.limit ?? products.length); } };
  const pages = previewPages(config, productPage, cartPage);
  const page = pages[template];
  // The live loader picks the template and lays it out; it runs again only when the page or the data set changes.
  const [resolved, setResolved] = useState<{ key: string; route: ResolvedStorefrontRoute }>();
  const routeKey = `${template}:${config.themeId}:${config.packId}:${config.product.id}:${config.collection.title}`;
  useEffect(() => {
    let active = true;
    void resolveStorefrontRoute(snapshot, routeRequest(template, page), fixtureReader(pages), async () => new Map()).then((route) => { if (active) setResolved({ key: routeKey, route }); });
    return () => { active = false; };
    // The page's own state (chosen size, bag lines) is passed in below; only a different page needs a new route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, snapshot]);
  const route = resolved?.key === routeKey ? resolved.route : undefined;
  if (!route || route.status !== "ready") return null;
  // Live pages hand their current data (the chosen size, the bag's lines) to the resolved route the same way.
  const ready = { ...route, context: (template === "compare" ? { pageType: "home", resource: null } : page) as typeof route.context, layout: { ...route.layout, template: template === "compare" ? [] : route.layout.template.map((section) => previewLayout(section, productLayout, collectionLayout, config)) } };
  return <div className="jelly-storefront">
    <RuntimeStorefrontView route={ready} commerce={commerce} themeId={config.themeId} menus={previewMenus} storeSlug="preview" mode="preview" identity={{ name: config.name }}
      main={template === "compare" ? <ComparePageView items={compareItems} max={MAX_COMPARE} shopHref="#shop" onRemove={(id) => compare.remove(id)} /> : undefined} />
    {compareOn && template !== "compare" && <CompareTrayView items={compareItems} max={MAX_COMPARE} compareHref="#compare" onOpen={onOpenCompare} onRemove={(id) => compare.remove(id)} onClear={() => compare.clear()} />}
  </div>;
}
