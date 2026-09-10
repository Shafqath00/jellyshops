import type { GlobalSettings, PageType, StoreDesignDocument, StorefrontDocument } from "@jelly/storefront-schema";

export interface PublicProduct { id: string; name: string; href: string; imageUrl: string; price: string }
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
