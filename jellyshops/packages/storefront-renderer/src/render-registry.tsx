import type { ComponentType } from "react";
import { ProductReviewsSection } from "./sections/product-reviews";
import type { SectionNode } from "@jelly/storefront-schema";
import { FooterSection } from "./sections/footer";
import { HeaderSection } from "./sections/header";
import { HeroSection } from "./sections/hero";
import { SlideshowSection } from "./sections/slideshow";
import { ProductSpecificationsSection, ProductStockCounterSection, ProductTabsSection } from "./sections/product-extras";
import { StoreVisitSection } from "./sections/store-visit";
import { ProductGridSection } from "./sections/product-grid";
import { RecentlyViewedSection } from "./sections/recently-viewed";
import { ProductDimensionsSection } from "./sections/product-dimensions";
import { RichTextSection } from "./sections/rich-text";
import { CustomContentSection } from "./sections/custom-content";
import { LogoListSection } from "./sections/logo-list";
import { ImageGallerySection, RatingSummarySection } from "./sections/social-proof";
import { MetaobjectListSection } from "./sections/metaobject-list";
import { ProductDescriptionSection, ProductGallerySection, ProductInformationSection, ProductOptionsSection, ProductPurchaseSection, RelatedProductsSection, productContext } from "./sections/product-sections";
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
  selectedBlockId?: string;
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
  registry.register("announcement-bar", ({ section, mode }) => <AnnouncementBarSection section={section} editor={mode === "editor"} />);
  registry.register("header", ({ section, context }) => <HeaderSection section={section} context={context} />);
  registry.register("footer", ({ section, context, commerce, mode }) => <FooterSection section={section} context={context} subscribe={commerce.subscribeNewsletter} mode={mode} />);
  registry.register("hero", ({ section, mode, context, selectedBlockId }) => <HeroSection section={section} editor={mode === "editor"} context={context} selectedBlockId={selectedBlockId} />);
  registry.register("slideshow", ({ section, mode, context, selectedBlockId }) => <SlideshowSection section={section} context={context} editor={mode === "editor"} selectedBlockId={selectedBlockId} />);
  registry.register("rich-text", ({ section }) => <RichTextSection section={section} />);
  // The Apps section is a Custom content section that only takes app blocks.
  registry.register("apps", ({ section, context, mode, selectedBlockId }) => <CustomContentSection section={section} context={context} editor={mode === "editor"} selectedBlockId={selectedBlockId} />);
  registry.register("custom-content", ({ section, context, mode, selectedBlockId }) => <CustomContentSection section={section} context={context} editor={mode === "editor"} selectedBlockId={selectedBlockId} />);
  registry.register("page-content", ({ context }) => <PageContentSection context={context} />);
  registry.register("blog-header", ({ context, section }) => <BlogHeaderSection context={context} section={section} />);
  registry.register("article-list", ({ context, section }) => <ArticleListSection context={context} section={section} />);
  registry.register("article-header", ({ context, section }) => <ArticleHeaderSection context={context} section={section} />);
  registry.register("article-content", ({ context, section }) => <ArticleContentSection context={context} section={section} />);
  registry.register("product-grid", ({ commerce, section, context, mode }) => <ProductGridSection commerce={commerce} section={section} storeSlug={context.storeSlug} editor={mode === "editor"} />);
  registry.register("product-gallery", ({ context, section }) => <ProductGallerySection context={context} section={section} />);
  registry.register("product-information", ({ context, section }) => <ProductInformationSection context={context} section={section} />);
  registry.register("product-options", ({ context, section }) => <ProductOptionsSection context={context} section={section} />);
  registry.register("product-purchase", ({ context, section }) => <ProductPurchaseSection context={context} section={section} />);
  registry.register("product-description", ({ context, section }) => <ProductDescriptionSection context={context} section={section} />);
  registry.register("product-tabs", ({ section, mode }) => <ProductTabsSection section={section} editor={mode === "editor"} />);
  registry.register("product-stock-counter", ({ section, context }) => <ProductStockCounterSection section={section} context={context} />);
  registry.register("product-reviews", ({ context, section }) => <ProductReviewsSection context={context} section={section} />);
  registry.register("product-dimensions", ({ section, context }) => <ProductDimensionsSection section={section} context={context} product={productContext(context)} />);
  registry.register("product-specifications", ({ section, context }) => <ProductSpecificationsSection section={section} context={context} />);
  registry.register("contact-store-info", ({ section, mode }) => <StoreVisitSection section={section} editor={mode === "editor"} />);
  registry.register("recently-viewed", ({ commerce, context, section }) => <RecentlyViewedSection commerce={commerce} context={context} section={section} />);
  registry.register("related-products", ({ context, section }) => <RelatedProductsSection context={context} section={section} />);
  registry.register("collection-header", ({ context, section }) => <CollectionHeaderSection context={context} section={section} />);
  registry.register("collection-product-grid", ({ context, section }) => <CollectionProductGridSection context={context} section={section} />);
  registry.register("collection-description", ({ context, section }) => <CollectionDescriptionSection context={context} section={section} />);
  registry.register("featured-collection", ({ commerce, section, context, mode }) => <ProductGridSection commerce={commerce} section={section} storeSlug={context.storeSlug} editor={mode === "editor"} />);
  registry.register("image-with-text", ({ section, context }) => <ImageWithTextSection section={section} context={context} />);
  registry.register("image-text", ({ section, context }) => <ImageWithTextSection section={section} context={context} />);
  registry.register("multicolumn", ({ section, context }) => <MulticolumnSection section={section} context={context} />);
  registry.register("image-banner", ({ section, context }) => <ImageBannerSection section={section} context={context} />);
  registry.register("faq", ({ section, mode }) => <FaqSection section={section} editor={mode === "editor"} />);
  registry.register("newsletter", ({ section, commerce, mode }) => <NewsletterSection section={section} subscribe={commerce.subscribeNewsletter} mode={mode} />);
  registry.register("category-grid", ({ section, context }) => <CategoryGridSection section={section} context={context} />);
  registry.register("metaobject-list", ({ section, context, mode }) => <MetaobjectListSection section={section} context={context} mode={mode} />);
  registry.register("logo-list", ({ section, context, mode, selectedBlockId }) => <LogoListSection section={section} context={context} mode={mode} selectedBlockId={selectedBlockId} />);
  registry.register("testimonials", ({ section, mode }) => <TestimonialsSection section={section} mode={mode} />);
  registry.register("rating-summary", ({ section, context, mode }) => <RatingSummarySection section={section} context={context} mode={mode} />);
  registry.register("image-gallery", ({ section, context, mode, selectedBlockId }) => <ImageGallerySection section={section} context={context} mode={mode} selectedBlockId={selectedBlockId} />);
  registry.register("trust-strip", ({ section, context, mode, selectedBlockId }) => <TrustStripSection section={section} context={context} mode={mode} selectedBlockId={selectedBlockId} />);
  registry.register("image-mosaic", ({ section }) => <ImageMosaicSection section={section} />);
  registry.register("journal-teaser", ({ section }) => <JournalTeaserSection section={section} />);
  registry.register("cart-summary", ({ section, context }) => <CartSummarySection section={section} context={context} />);
  registry.register("search-results", ({ section, context }) => <SearchResultsSection section={section} context={context} />);
  registry.register("not-found-message", ({ section, context }) => <NotFoundMessageSection section={section} context={context} />);
  registry.register("spacer-divider", ({ section }) => <SpacerDividerSection section={section} kind="spacer-divider" />);
  registry.register("spacer", ({ section }) => <SpacerDividerSection section={section} kind="spacer" />);
  registry.register("divider", ({ section }) => <SpacerDividerSection section={section} kind="divider" />);
  return registry;
}

export const defaultSectionRenderRegistry = builtInRegistry();
