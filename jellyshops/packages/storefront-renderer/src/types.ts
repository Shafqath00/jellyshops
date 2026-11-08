import type { GlobalSettings, PageType, ProductMediaLike, RichTextDocument, StoreDesignDocument, StorefrontDocument } from "@jelly/storefront-schema";
import type { ReactNode } from "react";

/** A product on a card. `saving` ("£20.00"), `discountPercent` and `chip` ("More colours") are optional extras themes can show. */
/** A product as every product list draws it (the shared card in @jelly/storefront-ui). */
export interface PublicProduct { id: string; name: string; href: string; imageUrl: string; price: string; compareAtPrice?: string; badge?: string; saving?: string; discountPercent?: number; chip?: string; vendor?: string; swatches?: Array<{ label: string; color?: string; image?: string }>; moreSwatches?: number; /** Exact price in minor units, used to sort and filter product lists. */ priceMinor?: number; /** False when no variant can be bought; product list filters use it. */ available?: boolean; /** Set when the product can go straight into the cart from its card (one variant, no options, in stock). */ quickAdd?: { variantId: string; max: number } }
export interface CollectionPresentationContext {
  interactiveGrid?: ReactNode;
  collection: { id: string; title: string; description: string; descriptionDoc?: RichTextDocument | null; imageUrl?: string };
  products: PublicProduct[];
  totalProducts: number;
}
export interface ProductPresentationContext {
  product: { id: string; title: string; description: string; descriptionDoc?: RichTextDocument | null; imageUrl: string; galleryEnabled?: boolean; specifications?: Record<string, string>; shippingCopy?: string; media?: ProductMediaLike[]; sku?: string; vendor?: string; options: Array<{ id: string; name: string; required: boolean; /** "color" or "image" draws swatches instead of text buttons. */ display?: "color" | "image"; multiple?: boolean; missing?: boolean; values: Array<{ id: string; label: string; selected: boolean; available: boolean; priceAdjustment?: string; previewImageUrl?: string; color?: string; image?: string }> }> };
  selection: Array<{ optionId: string; valueId: string }>;
  quantity: number;
  /** Formatted prices; the optional minor amounts and `format` let themes show "% off", "Save £X" and a monthly finance amount. */
  pricing: { price: string; compareAtPrice?: string; priceMinor?: number; compareAtPriceMinor?: number; format?(minor: number): string };
  availability: { state: "available" | "out-of-stock" | "selection-required" | "unavailable"; message: string; maxQuantity?: number };
  canAddToCart: boolean;
  selectOption(optionId: string, valueId: string): void;
  setQuantity(quantity: number): void;
  addToCart(): Promise<{ ok: boolean; message?: string }>;
  buyNow?(): Promise<{ ok: boolean; message?: string }>;
  wishlistControl?: ReactNode;
  relatedProducts: PublicProduct[];
}
export type StorefrontPageContext =
  | { pageType: "home"; resource: null }
  | { pageType: "cart"; resource: null; data?: Record<string, unknown> }
  | { pageType: "not-found"; resource: null }
  | { pageType: "search"; resource: null; data: { query: string; state: "empty" | "results" | "none"; resultCount: number; results: PublicProduct[]; searchHref?: string } }
  | { pageType: "product" | "collection" | "page" | "blog" | "article"; resource: { id: string; handle: string; data: Record<string, unknown> } };
/** A metaobject's entries as shoppers see them (visible fields only), from the public metaobjects route. */
export interface PublicMetaobjectList {
  definition: { handle: string; name: string; fields: Array<{ handle: string; name: string; type: string }> };
  entries: Array<{ handle: string; displayName: string; values: Record<string, string | number | boolean> }>;
}
export interface CommerceDataProvider { initialProducts?: PublicProduct[]; getProducts(input?: { featured?: boolean; limit?: number; sort?: string; collectionId?: string }): Promise<PublicProduct[]>; subscribeNewsletter?: (email: string, source: string) => Promise<void>; getMetaobjects?: (handle: string) => Promise<PublicMetaobjectList | null>; /** The shopper's cart, for quick add on product cards. Absent in the editor. */ cart?: StorefrontCartAccess }
/** What product cards may do with the cart: read and set the quantity of one variant. */
export interface StorefrontCartAccess { quantity(variantId: string): number; setQuantity(variantId: string, quantity: number): Promise<{ ok: boolean; message?: string }> }
export interface AssetResolver { resolve(assetId: string): Promise<string | null> }
export type RendererMode = "preview" | "editor" | "published";
export interface RendererSelection { kind: "theme" | "section" | "block"; region?: "header" | "template" | "footer"; sectionId?: string; blockId?: string; fieldKey?: string; /** A part of the section drawn from its settings (section-elements.ts). */ elementId?: string; /** Which copy of a repeated element (the nth product card). */ elementIndex?: number }
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
