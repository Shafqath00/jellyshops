import type { GlobalSettings, PageType, StoreDesignDocument, StorefrontDocument } from "@jelly/storefront-schema";

export interface PublicProduct { id: string; name: string; href: string; imageUrl: string; price: string }
export interface CollectionPresentationContext {
  collection: { id: string; title: string; description: string; imageUrl?: string };
  products: PublicProduct[];
  totalProducts: number;
}
export interface ProductPresentationContext {
  product: { id: string; title: string; description: string; imageUrl: string; media?: Array<{ id: string; url: string; altText?: string }>; sku?: string; vendor?: string; options: Array<{ id: string; name: string; required: boolean; values: Array<{ id: string; label: string; selected: boolean; available: boolean }> }> };
  selection: Array<{ optionId: string; valueId: string }>;
  quantity: number;
  pricing: { price: string; compareAtPrice?: string };
  availability: { state: "available" | "out-of-stock" | "selection-required" | "unavailable"; message: string; maxQuantity?: number };
  canAddToCart: boolean;
  selectOption(optionId: string, valueId: string): void;
  setQuantity(quantity: number): void;
  addToCart(): Promise<{ ok: boolean; message?: string }>;
  relatedProducts: PublicProduct[];
}
export type StorefrontPageContext =
  | { pageType: "home"; resource: null }
  | { pageType: "cart"; resource: null; data?: Record<string, unknown> }
  | { pageType: "search"; resource: null; data: { query: string; state: "empty" | "results" | "none"; resultCount: number; results: PublicProduct[]; searchHref?: string } }
  | { pageType: "product" | "collection" | "page" | "blog" | "article"; resource: { id: string; handle: string; data: Record<string, unknown> } };
export interface CommerceDataProvider { getProducts(input?: { featured?: boolean; limit?: number }): Promise<PublicProduct[]> }
export interface AssetResolver { resolve(assetId: string): Promise<string | null> }
export type RendererMode = "preview" | "editor" | "published";
export interface RendererSelection { kind: "theme" | "section" | "block"; region?: "header" | "template" | "footer"; sectionId?: string; blockId?: string; fieldKey?: string }
export interface StorefrontRendererProps {
  document: StoreDesignDocument | StorefrontDocument;
  page?: PageType;
  pageId?: string;
  mode: RendererMode;
  commerce: CommerceDataProvider;
  assetResolver?: AssetResolver;
  selected?: RendererSelection | null;
  onSelect?: (selection: RendererSelection) => void;
  onSectionError?: (sectionId: string, error: unknown) => void;
}
export type { GlobalSettings };
