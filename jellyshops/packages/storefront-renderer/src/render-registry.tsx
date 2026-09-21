import type { ComponentType } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import { FooterSection } from "./sections/footer";
import { HeaderSection } from "./sections/header";
import { HeroSection } from "./sections/hero";
import { ProductGridSection } from "./sections/product-grid";
import { RichTextSection } from "./sections/rich-text";
import {
  AnnouncementBarSection,
  ImageWithTextSection,
  MulticolumnSection,
  NewsletterSection,
  SpacerDividerSection,
} from "./sections/home-sections";
import {
  CartSummarySection,
  CategoryGridSection,
  ImageMosaicSection,
  JournalTeaserSection,
  NotFoundMessageSection,
  SearchResultsSection,
  TestimonialsSection,
  TrustStripSection,
} from "./sections/theme-pack-sections";
import type { StorefrontRuntimeContext } from "./runtime-context";
import type { CommerceDataProvider, PublicProduct, RendererMode } from "./types";

export interface SectionRenderProps {
  section: SectionNode;
  mode: RendererMode;
  commerce: CommerceDataProvider;
  context: StorefrontRuntimeContext;
}

export type SectionRenderComponent = ComponentType<SectionRenderProps>;

export class SectionRenderRegistry {
  private readonly renderers = new Map<string, SectionRenderComponent>();

  register(type: string, component: SectionRenderComponent): this {
    if (!type.trim()) throw new Error("Section renderer type is required");
    this.renderers.set(type, component);
    return this;
  }

  unregister(type: string): void {
    this.renderers.delete(type);
  }

  get(type: string): SectionRenderComponent | undefined {
    return this.renderers.get(type);
  }

  has(type: string): boolean {
    return this.renderers.has(type);
  }
}

function collectionContext(context: StorefrontRuntimeContext): { name: string; products: PublicProduct[] } | null {
  if (context.page?.pageType !== "collection") return null;
  const collection = context.page.resource.data.collection;
  const products = context.page.resource.data.products;
  if (!collection || typeof collection !== "object" || Array.isArray(collection)) return null;
  const name = (collection as Record<string, unknown>).name;
  return {
    name: typeof name === "string" ? name : "Collection",
    products: Array.isArray(products) ? products.filter((product): product is PublicProduct => (
      Boolean(product) && typeof product === "object" && typeof (product as PublicProduct).id === "string"
    )) : [],
  };
}

function builtInRegistry(): SectionRenderRegistry {
  const registry = new SectionRenderRegistry();
  registry.register("announcement-bar", ({ section }) => <AnnouncementBarSection section={section} />);
  registry.register("header", ({ section }) => <HeaderSection section={section} />);
  registry.register("footer", ({ section }) => <FooterSection section={section} />);
  registry.register("hero", ({ section, mode }) => <HeroSection section={section} editor={mode === "editor"} />);
  registry.register("rich-text", ({ section, mode }) => <RichTextSection section={section} editor={mode === "editor"} />);
  registry.register("product-grid", ({ commerce }) => <ProductGridSection commerce={commerce} />);
  registry.register("product-information", ({ context }) => {
    const title = context.page?.pageType === "product" ? context.page.resource.data.title : undefined;
    return <section className="jelly-section jelly-product-information"><StorefrontContainer><h1>{typeof title === "string" ? title : "Product"}</h1></StorefrontContainer></section>;
  });
  registry.register("collection-header", ({ context }) => {
    const collection = collectionContext(context);
    return <section className="jelly-section jelly-collection-header"><StorefrontContainer><h1>{collection?.name ?? "Collection"}</h1></StorefrontContainer></section>;
  });
  registry.register("collection-product-grid", ({ context }) => {
    const collection = collectionContext(context);
    const products = collection?.products ?? [];
    return <section className="jelly-section jelly-collection-product-grid"><StorefrontContainer>{products.length
      ? <div className="jelly-product-grid-items">{products.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>
      : <p>No products are available in this collection yet.</p>
    }</StorefrontContainer></section>;
  });
  registry.register("featured-collection", ({ commerce }) => <ProductGridSection commerce={commerce} />);
  registry.register("image-with-text", ({ section }) => <ImageWithTextSection section={section} />);
  registry.register("image-text", ({ section }) => <ImageWithTextSection section={section} />);
  registry.register("multicolumn", ({ section }) => <MulticolumnSection section={section} />);
  registry.register("newsletter", ({ section }) => <NewsletterSection section={section} />);
  registry.register("category-grid", ({ section }) => <CategoryGridSection section={section} />);
  registry.register("testimonials", ({ section }) => <TestimonialsSection section={section} />);
  registry.register("trust-strip", ({ section }) => <TrustStripSection section={section} />);
  registry.register("image-mosaic", ({ section }) => <ImageMosaicSection section={section} />);
  registry.register("journal-teaser", ({ section }) => <JournalTeaserSection section={section} />);
  registry.register("cart-summary", ({ section, context }) => <CartSummarySection section={section} context={context} />);
  registry.register("search-results", ({ section }) => <SearchResultsSection section={section} />);
  registry.register("not-found-message", ({ section }) => <NotFoundMessageSection section={section} />);
  registry.register("spacer-divider", () => <SpacerDividerSection />);
  registry.register("spacer", () => <SpacerDividerSection />);
  registry.register("divider", () => <SpacerDividerSection />);
  return registry;
}

export const defaultSectionRenderRegistry = builtInRegistry();
