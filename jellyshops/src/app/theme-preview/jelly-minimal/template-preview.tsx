"use client";

import { useState } from "react";
import { RegistrySectionRenderer, type CommerceDataProvider, type PublicProduct, type StorefrontPageContext } from "@jelly/storefront-renderer";
import { getV4StarterPack } from "@jelly/storefront-registry";
import type { RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";

/**
 * Renders a Jelly Minimal starter template (home, product or collection) with
 * sample catalogue data, exactly as the published storefront composes it.
 */
export type PreviewTemplate = "home" | "product" | "collection" | "cart" | "search" | "page" | "not-found";

const THEME_ID = "jelly-signature";
const image = (photo: string) => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&q=80`;
const sampleProducts: PublicProduct[] = [
  { id: "p1", name: "Linen tote bag", price: "£28.00", href: "#", imageUrl: image("photo-1544816155-12df9643f363") },
  { id: "p2", name: "Stoneware mug", price: "£18.00", href: "#", imageUrl: image("photo-1514228742587-6b1558fcca3d") },
  { id: "p3", name: "Organic cotton tee", price: "£32.00", href: "#", imageUrl: image("photo-1521572163474-6864f9cf17ab") },
  { id: "p4", name: "Ceramic vase", price: "£42.00", href: "#", imageUrl: image("photo-1578500494198-246f612d3b3d") },
  { id: "p5", name: "Cream knit top", price: "£64.00", href: "#", imageUrl: image("photo-1434389677669-e08b4cac3105") },
  { id: "p6", name: "Insulated bottle", price: "£24.00", href: "#", imageUrl: image("photo-1602143407151-7111542de6e8") },
  { id: "p7", name: "Everyday shirt", price: "£48.00", href: "#", imageUrl: image("photo-1512436991641-6745cdb1723f") },
  { id: "p8", name: "Weekend rail edit", price: "£36.00", href: "#", imageUrl: image("photo-1490481651871-ab68de25d43d") },
];
const commerce: CommerceDataProvider = { initialProducts: sampleProducts, async getProducts(input) { return sampleProducts.slice(0, input?.limit ?? sampleProducts.length); } };
const menus: Record<string, RuntimeMenuV4> = {
  main: { id: "preview-main", handle: "main", items: [
    { id: "home", label: "Home", target: { kind: "home" }, children: [] },
    { id: "shop", label: "Shop all", target: { kind: "search" }, children: [] },
    { id: "about", label: "About", target: { kind: "home" }, children: [] },
  ] },
};

function useProductContext(): StorefrontPageContext {
  const [size, setSize] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const sizes = [{ id: "s", label: "Small" }, { id: "m", label: "Medium" }, { id: "l", label: "Large", soldOut: true }];
  return {
    pageType: "product",
    resource: { id: "p3", handle: "organic-cotton-tee", data: { title: "Organic cotton tee", productPresentation: {
      product: {
        id: "p3", title: "Organic cotton tee", vendor: "Jelly Minimal",
        description: "A relaxed, everyday tee cut from soft organic cotton. Pre-washed for a lived-in feel from the first wear.\n\nMachine wash cold and dry flat to keep its shape.",
        imageUrl: image("photo-1521572163474-6864f9cf17ab"),
        media: [
          { id: "m1", url: image("photo-1521572163474-6864f9cf17ab"), altText: "Organic cotton tee, front" },
          { id: "m2", url: image("photo-1512436991641-6745cdb1723f"), altText: "Organic cotton tee on a clothing rail" },
          { id: "m3", url: image("photo-1490481651871-ab68de25d43d"), altText: "The tee alongside other neutral basics" },
        ],
        specifications: { Material: "100% organic cotton", Fit: "Relaxed", Care: "Machine wash cold" },
        shippingCopy: "Free delivery on orders over £50. Returns within 30 days.",
        options: [{ id: "size", name: "Size", required: true, values: sizes.map((value) => ({ id: value.id, label: value.label, selected: size === value.id, available: !value.soldOut })) }],
      },
      selection: size ? [{ optionId: "size", valueId: size }] : [],
      quantity,
      pricing: { price: "£32.00", compareAtPrice: "£40.00" },
      availability: size ? { state: "available", message: "In stock", maxQuantity: 10 } : { state: "selection-required", message: "Choose a size" },
      canAddToCart: Boolean(size),
      selectOption: (_option: string, value: string) => setSize(value),
      setQuantity: (next: number) => setQuantity(Math.max(1, Math.min(10, next))),
      addToCart: async () => ({ ok: true }),
      buyNow: async () => ({ ok: true }),
      relatedProducts: sampleProducts.filter((product) => product.id !== "p3").slice(0, 4),
    } } },
  } as unknown as StorefrontPageContext;
}

const collectionContext: StorefrontPageContext = {
  pageType: "collection",
  resource: { id: "c1", handle: "home", data: { collectionPresentation: {
    collection: { id: "c1", title: "For the home", description: "Ceramics, textiles and small objects that make a house feel lived in.", imageUrl: image("photo-1578500494198-246f612d3b3d") },
    products: sampleProducts,
    totalProducts: sampleProducts.length,
  } } },
} as StorefrontPageContext;

function useCartContext(): StorefrontPageContext {
  const [quantities, setQuantities] = useState<Record<string, number>>({ p1: 1, p3: 2 });
  const lines = sampleProducts.filter((product) => quantities[product.id]).map((product) => {
    const unit = Number(product.price.replace(/[^0-9.]/g, ""));
    const quantity = quantities[product.id];
    const update = (next: number) => setQuantities((current) => { const copy = { ...current }; if (next <= 0) delete copy[product.id]; else copy[product.id] = next; return copy; });
    return { id: product.id, name: product.name, productName: product.name, variantName: product.id === "p3" ? "Medium" : "Standard", imageUrl: product.imageUrl, quantity, unitPrice: product.price, total: `£${(unit * quantity).toFixed(2)}`, canIncrease: quantity < 5, onDecrease: () => update(quantity - 1), onIncrease: () => update(quantity + 1), onRemove: () => update(0), minor: unit * quantity * 100 };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.minor, 0) / 100;
  return { pageType: "cart", resource: null, data: { lines, subtotal: `£${subtotal.toFixed(2)}`, shippingNote: "Free delivery on orders over £50. Taxes included.", checkoutHref: "#checkout", shopHref: "#shop" } };
}

const searchContext: StorefrontPageContext = { pageType: "search", resource: null, data: { query: "linen", state: "results", resultCount: 2, results: [sampleProducts[0], sampleProducts[6]], searchHref: "#search" } };
const infoPageContext: StorefrontPageContext = {
  pageType: "page",
  resource: { id: "about", handle: "about", data: { title: "About us", content: { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "We started in a small studio with a simple idea: everyday things should be made well and last for years." }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What we care about" }] },
    { type: "paragraph", content: [{ type: "text", text: "Natural materials, honest prices and careful packaging. We work with a handful of makers we know by name." }] },
    { type: "bulletList", content: [
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Small batches, made to order where we can" }] }] },
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Plastic-free packaging" }] }] },
    ] },
  ] } } },
} as unknown as StorefrontPageContext;

export function TemplatePreview({ template }: { template: PreviewTemplate }) {
  const pack = getV4StarterPack("jelly-signature");
  const productPage = useProductContext();
  const cartPage = useCartContext();
  const pages: Record<PreviewTemplate, StorefrontPageContext> = {
    home: { pageType: "home", resource: null },
    product: productPage,
    collection: collectionContext,
    cart: cartPage,
    search: searchContext,
    page: infoPageContext,
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
      ? { ...global.section, settings: { storeName: "Jelly Minimal", ...global.section.settings } } as SectionNode
      : global.section;
    return [{ region: global.key === "footer" ? "footer" : "header", section }];
  });
  const render = (entry: Entry) => <RegistrySectionRenderer key={entry.section.id} section={entry.section} mode="preview" commerce={commerce} region={entry.region} themeId={THEME_ID} page={page} menus={menus} storeSlug="preview" />;
  return <div className="jelly-storefront">
    {resolved.filter((entry) => entry.region === "header").map(render)}
    <main>{resolved.filter((entry) => entry.region === "template").map(render)}</main>
    {resolved.filter((entry) => entry.region === "footer").map(render)}
  </div>;
}
