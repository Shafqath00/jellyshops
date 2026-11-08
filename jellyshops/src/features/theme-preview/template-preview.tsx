"use client";

import { useState } from "react";
import { RegistrySectionRenderer, type CommerceDataProvider, type StorefrontPageContext } from "@jelly/storefront-renderer";
import { getStarterPack } from "@jelly/storefront-themes";
import type { RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";
import type { ThemePreviewConfig } from "./configs";

/**
 * Renders a theme's starter template (home, product, collection, cart, search,
 * page or 404) with sample catalogue data, exactly as the published storefront
 * composes it.
 */
export type PreviewTemplate = "home" | "product" | "collection" | "cart" | "search" | "page" | "not-found";

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

/** "£28.00" to 2800 (sample prices only). */
const toMinor = (price: string) => Math.round(Number(price.replace(/[^0-9.]/g, "")) * 100);

/** Sample prices as a shop shows them: "£1,197.00". */
const pounds = (value: number) => `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function useProductContext(config: ThemePreviewConfig): StorefrontPageContext {
  const [size, setSize] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const sample = config.product;
  const option = sample.option ?? { id: "size", name: "Size", values: [{ id: "s", label: "Small" }, { id: "m", label: "Medium" }, { id: "l", label: "Large", soldOut: true }] };
  return {
    pageType: "product",
    resource: { id: sample.id, handle: "sample-product", data: { title: sample.title, productPresentation: {
      product: {
        id: sample.id, title: sample.title, vendor: config.name,
        description: sample.description,
        imageUrl: sample.media[0]?.url,
        galleryEnabled: sample.galleryEnabled,
        media: sample.media.map((item, index) => ({ id: `m${index + 1}`, url: item.url, altText: item.alt })),
        specifications: sample.specifications,
        shippingCopy: sample.shippingCopy,
        options: [{ id: option.id, name: option.name, required: true, values: option.values.map((value) => ({ id: value.id, label: value.label, selected: size === value.id, available: !value.soldOut })) }],
      },
      selection: size ? [{ optionId: option.id, valueId: size }] : [],
      quantity,
      pricing: { price: sample.price, compareAtPrice: sample.compareAtPrice, priceMinor: toMinor(sample.price), ...(sample.compareAtPrice ? { compareAtPriceMinor: toMinor(sample.compareAtPrice) } : {}), format: (minor: number) => `£${(minor / 100).toFixed(2)}` },
      availability: size ? { state: "available", message: "In stock", maxQuantity: 10 } : { state: "selection-required", message: `Choose a ${option.name.toLowerCase()}` },
      canAddToCart: Boolean(size),
      selectOption: (_option: string, value: string) => setSize(value),
      setQuantity: (next: number) => setQuantity(Math.max(1, Math.min(10, next))),
      addToCart: async () => ({ ok: true }),
      buyNow: sample.showBuyNow === false ? undefined : async () => ({ ok: true }),
      relatedProducts: config.products.filter((product) => product.id !== sample.id).slice(0, 4),
    } } },
  } as unknown as StorefrontPageContext;
}

function useCartContext(config: ThemePreviewConfig): StorefrontPageContext {
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
/** Applies the preview's product or collection layout choice to the template's own section. */
function previewLayout(section: SectionNode, productLayout: string | undefined, collectionLayout: string | undefined, config: ThemePreviewConfig): SectionNode {
  if (productLayout && section.type === "product-gallery") return { ...section, settings: { ...section.settings, pageLayout: productLayout } };
  if (collectionLayout && section.type === "collection-product-grid") {
    const story = { id: "preview-story", type: "story-tile", enabled: true, settings: { heading: "Made in small batches", text: "Every piece in this collection is made to order by the same small team.", image: { url: config.products[1]?.imageUrl ?? "", alt: "" }, link: "/pages/about", linkLabel: "Our story", position: 2 } };
    return { ...section, settings: { ...section.settings, listLayout: collectionLayout }, blocks: collectionLayout === "editorial" ? [...section.blocks, story] : section.blocks } as SectionNode;
  }
  return section;
}

export function TemplatePreview({ template, config, productLayout, collectionLayout }: { template: PreviewTemplate; config: ThemePreviewConfig; productLayout?: string; collectionLayout?: string }) {
  const pack = getStarterPack(config.packId);
  const productPage = useProductContext(config);
  const cartPage = useCartContext(config);
  // Themes that ship their own main menu are shown with it; the others with a sample menu that has dropdowns.
  const previewMenus = config.useStarterMenu ? Object.fromEntries(pack.menus.map((menu) => [menu.handle, { id: `preview-${menu.key}`, handle: menu.handle, items: menu.items }])) as Record<string, RuntimeMenuV4> : menus;
  const commerce: CommerceDataProvider = { initialProducts: config.products, async getProducts(input) { return config.products.slice(0, input?.limit ?? config.products.length); } };
  const pages: Record<PreviewTemplate, StorefrontPageContext> = {
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
  };
  const page = pages[template];
  const layout = pack.templates.find((item) => item.type === template)?.layout.sections ?? [];
  type Entry = { region: "header" | "template" | "footer"; section: SectionNode };
  const resolved: Entry[] = layout.flatMap((placement): Entry[] => {
    if (placement.kind === "inline") return [{ region: "template", section: previewLayout(placement.section, productLayout, collectionLayout, config) }];
    const global = pack.globalSections.find((entry) => entry.section.id === placement.globalSectionId);
    if (!global) return [];
    const section = global.key === "header" || global.key === "footer"
      ? { ...global.section, settings: { storeName: config.name, ...global.section.settings } } as SectionNode
      : global.section;
    return [{ region: global.key === "footer" ? "footer" : "header", section }];
  });
  const render = (entry: Entry) => <RegistrySectionRenderer key={entry.section.id} section={entry.section} mode="preview" commerce={commerce} region={entry.region} themeId={config.themeId} page={page} menus={previewMenus} storeSlug="preview" />;
  return <div className="jelly-storefront">
    {resolved.filter((entry) => entry.region === "header").map(render)}
    <main>{resolved.filter((entry) => entry.region === "template").map(render)}</main>
    {resolved.filter((entry) => entry.region === "footer").map(render)}
  </div>;
}
