import type { GlobalSettings, PageType, StoreDesignDocument, StorefrontDocument } from "@jelly/storefront-schema";

export interface PublicProduct { id: string; name: string; href: string; imageUrl: string; price: string }
export type StorefrontPageContext =
  | { pageType: "home"; resource: null }
  | { pageType: "cart"; resource: null; data?: Record<string, unknown> }
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
