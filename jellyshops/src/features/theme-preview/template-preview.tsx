"use client";

import { useState } from "react";
import { RegistrySectionRenderer, type CommerceDataProvider, type StorefrontPageContext } from "@jelly/storefront-renderer";
import { getV4StarterPack } from "@jelly/storefront-registry";
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
    { id: "shop", label: "Shop all", target: { kind: "search" }, children: [] },
    { id: "about", label: "About", target: { kind: "home" }, children: [] },
  ] },
};

function useProductContext(config: ThemePreviewConfig): StorefrontPageContext {
  const [size, setSize] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const sizes = [{ id: "s", label: "Small" }, { id: "m", label: "Medium" }, { id: "l", label: "Large", soldOut: true }];
  const sample = config.product;
  return {
    pageType: "product",
    resource: { id: sample.id, handle: "sample-product", data: { title: sample.title, productPresentation: {
      product: {
        id: sample.id, title: sample.title, vendor: config.name,
        description: sample.description,
        imageUrl: sample.media[0]?.url,
        media: sample.media.map((item, index) => ({ id: `m${index + 1}`, url: item.url, altText: item.alt })),
        specifications: sample.specifications,
        shippingCopy: sample.shippingCopy,
        options: [{ id: "size", name: "Size", required: true, values: sizes.map((value) => ({ id: value.id, label: value.label, selected: size === value.id, available: !value.soldOut })) }],
      },
      selection: size ? [{ optionId: "size", valueId: size }] : [],
      quantity,
      pricing: { price: sample.price, compareAtPrice: sample.compareAtPrice },
      availability: size ? { state: "available", message: "In stock", maxQuantity: 10 } : { state: "selection-required", message: "Choose a size" },
      canAddToCart: Boolean(size),
      selectOption: (_option: string, value: string) => setSize(value),
      setQuantity: (next: number) => setQuantity(Math.max(1, Math.min(10, next))),
      addToCart: async () => ({ ok: true }),
      buyNow: async () => ({ ok: true }),
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
    return { id: product.id, name: product.name, productName: product.name, variantName: product.id === second ? "Medium" : "Standard", imageUrl: product.imageUrl, quantity, unitPrice: product.price, total: `£${(unit * quantity).toFixed(2)}`, canIncrease: quantity < 5, onDecrease: () => update(quantity - 1), onIncrease: () => update(quantity + 1), onRemove: () => update(0), minor: unit * quantity * 100 };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.minor, 0) / 100;
  return { pageType: "cart", resource: null, data: { lines, subtotal: `£${subtotal.toFixed(2)}`, shippingNote: "Free delivery on orders over £50. Taxes included.", checkoutHref: "#checkout", shopHref: "#shop" } };
}

export function TemplatePreview({ template, config }: { template: PreviewTemplate; config: ThemePreviewConfig }) {
  const pack = getV4StarterPack(config.packId);
  const productPage = useProductContext(config);
  const cartPage = useCartContext(config);
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
    if (placement.kind === "inline") return [{ region: "template", section: placement.section }];
    const global = pack.globalSections.find((entry) => entry.section.id === placement.globalSectionId);
    if (!global) return [];
    const section = global.key === "header" || global.key === "footer"
      ? { ...global.section, settings: { storeName: config.name, ...global.section.settings } } as SectionNode
      : global.section;
    return [{ region: global.key === "footer" ? "footer" : "header", section }];
  });
  const render = (entry: Entry) => <RegistrySectionRenderer key={entry.section.id} section={entry.section} mode="preview" commerce={commerce} region={entry.region} themeId={config.themeId} page={page} menus={menus} storeSlug="preview" />;
  return <div className="jelly-storefront">
    {resolved.filter((entry) => entry.region === "header").map(render)}
    <main>{resolved.filter((entry) => entry.region === "template").map(render)}</main>
    {resolved.filter((entry) => entry.region === "footer").map(render)}
  </div>;
}
