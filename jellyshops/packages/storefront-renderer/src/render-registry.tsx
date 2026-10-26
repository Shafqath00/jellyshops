import type { ComponentType } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import { FooterSection } from "./sections/footer";
import { HeaderSection } from "./sections/header";
import { HeroSection } from "./sections/hero";
import { SlideshowSection } from "./sections/slideshow";
import { ProductStockCounterSection, ProductTabsSection } from "./sections/product-extras";
import { ProductGridSection } from "./sections/product-grid";
import { RichTextSection } from "./sections/rich-text";
import { ProductDescriptionSection, ProductGallerySection, ProductInformationSection, ProductOptionsSection, ProductPurchaseSection, RelatedProductsSection } from "./sections/product-sections";
import { CollectionDescriptionSection, CollectionHeaderSection, CollectionProductGridSection } from "./sections/collection-sections";
import { ArticleContentSection, ArticleHeaderSection, ArticleListSection, BlogHeaderSection, PageContentSection } from "./sections/content-pages";
import {
  AnnouncementBarSection,
  FaqSection,
  ImageBannerSection,
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
import type { CommerceDataProvider, RendererMode } from "./types";

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

function builtInRegistry(): SectionRenderRegistry {
  const registry = new SectionRenderRegistry();
  registry.register("announcement-bar", ({ section }) => <AnnouncementBarSection section={section} />);
  registry.register("header", ({ section, context }) => <HeaderSection section={section} context={context} />);
  registry.register("footer", ({ section, context, commerce, mode }) => <FooterSection section={section} context={context} subscribe={commerce.subscribeNewsletter} mode={mode} />);
  registry.register("hero", ({ section, mode, context }) => <HeroSection section={section} editor={mode === "editor"} context={context} />);
  registry.register("slideshow", ({ section, mode, context }) => <SlideshowSection section={section} context={context} editor={mode === "editor"} />);
  registry.register("rich-text", ({ section }) => <RichTextSection section={section} />);
  registry.register("page-content", ({ context }) => <PageContentSection context={context} />);
  registry.register("blog-header", ({ context }) => <BlogHeaderSection context={context} />);
  registry.register("article-list", ({ context }) => <ArticleListSection context={context} />);
  registry.register("article-header", ({ context }) => <ArticleHeaderSection context={context} />);
  registry.register("article-content", ({ context }) => <ArticleContentSection context={context} />);
  registry.register("product-grid", ({ commerce, section, context }) => <ProductGridSection commerce={commerce} section={section} storeSlug={context.storeSlug} />);
  registry.register("product-gallery", ({ context, section }) => <ProductGallerySection context={context} section={section} />);
  registry.register("product-information", ({ context, section }) => <ProductInformationSection context={context} section={section} />);
  registry.register("product-options", ({ context, section }) => <ProductOptionsSection context={context} section={section} />);
  registry.register("product-purchase", ({ context, section }) => <ProductPurchaseSection context={context} section={section} />);
  registry.register("product-description", ({ context, section }) => <ProductDescriptionSection context={context} section={section} />);
  registry.register("product-tabs", ({ section }) => <ProductTabsSection section={section} />);
  registry.register("product-stock-counter", ({ section, context }) => <ProductStockCounterSection section={section} context={context} />);
  registry.register("related-products", ({ context, section }) => <RelatedProductsSection context={context} section={section} />);
  registry.register("collection-header", ({ context, section }) => <CollectionHeaderSection context={context} section={section} />);
  registry.register("collection-product-grid", ({ context, section }) => <CollectionProductGridSection context={context} section={section} />);
  registry.register("collection-description", ({ context, section }) => <CollectionDescriptionSection context={context} section={section} />);
  registry.register("featured-collection", ({ commerce, section, context }) => <ProductGridSection commerce={commerce} section={section} storeSlug={context.storeSlug} />);
  registry.register("image-with-text", ({ section, context }) => <ImageWithTextSection section={section} context={context} />);
  registry.register("image-text", ({ section, context }) => <ImageWithTextSection section={section} context={context} />);
  registry.register("multicolumn", ({ section, context }) => <MulticolumnSection section={section} context={context} />);
  registry.register("image-banner", ({ section, context }) => <ImageBannerSection section={section} context={context} />);
  registry.register("faq", ({ section }) => <FaqSection section={section} />);
  registry.register("newsletter", ({ section, commerce, mode }) => <NewsletterSection section={section} subscribe={commerce.subscribeNewsletter} mode={mode} />);
  registry.register("category-grid", ({ section, context }) => <CategoryGridSection section={section} context={context} />);
  registry.register("testimonials", ({ section, mode }) => <TestimonialsSection section={section} mode={mode} />);
  registry.register("trust-strip", ({ section }) => <TrustStripSection section={section} />);
  registry.register("image-mosaic", ({ section }) => <ImageMosaicSection section={section} />);
  registry.register("journal-teaser", ({ section }) => <JournalTeaserSection section={section} />);
  registry.register("cart-summary", ({ section, context }) => <CartSummarySection section={section} context={context} />);
  registry.register("search-results", ({ section, context }) => <SearchResultsSection section={section} context={context} />);
  registry.register("not-found-message", ({ section, context }) => <NotFoundMessageSection section={section} context={context} />);
  registry.register("spacer-divider", () => <SpacerDividerSection />);
  registry.register("spacer", () => <SpacerDividerSection />);
  registry.register("divider", () => <SpacerDividerSection />);
  return registry;
}

export const defaultSectionRenderRegistry = builtInRegistry();
