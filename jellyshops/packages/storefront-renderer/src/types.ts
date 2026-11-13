import type { GlobalSettings, PageType, ProductMediaLike, RichTextDocument, StoreDesignDocument, StorefrontDocument } from "@jelly/storefront-schema";
import type { ReactNode } from "react";

/** A product on a card. `saving` ("£20.00"), `discountPercent` and `chip` ("More colours") are optional extras themes can show. */
/** A product as every product list draws it (the shared card in @jelly/storefront-ui). */
export interface PublicProduct { /** Filters the product belongs to (options, Name:Value tags, brand, type), for product list filters. */ filters?: import("@jelly/storefront-schema").ProductFilterValues[]; /** Second photo, shown when the shopper points at the card. */ hoverImageUrl?: string; id: string; name: string; href: string; imageUrl: string; price: string; compareAtPrice?: string; badge?: string; saving?: string; discountPercent?: number; chip?: string; vendor?: string; swatches?: Array<{ label: string; color?: string; image?: string }>; moreSwatches?: number; /** Exact price in minor units, used to sort and filter product lists. */ priceMinor?: number; /** False when no variant can be bought; product list filters use it. */ available?: boolean; /** Set when the product can go straight into the cart from its card (one variant, no options, in stock). */ quickAdd?: { variantId: string; max: number }; /** Average star rating and number of published reviews. */ rating?: { average: number; count: number } }
export interface CollectionPresentationContext {
  collection: { id: string; title: string; description: string; descriptionDoc?: RichTextDocument | null; imageUrl?: string };
  products: PublicProduct[];
  totalProducts: number;
}
export interface ProductPresentationContext {
  product: { id: string; title: string; description: string; descriptionDoc?: RichTextDocument | null; imageUrl: string; galleryEnabled?: boolean; specifications?: Record<string, string>; shippingCopy?: string; media?: ProductMediaLike[]; sku?: string; vendor?: string; options: Array<{ id: string; name: string; required: boolean; /** "color" or "image" draws swatches instead of text buttons. */ display?: "color" | "image"; multiple?: boolean; missing?: boolean; values: Array<{ id: string; label: string; selected: boolean; /** False when no variant has this value with the other choices (it cannot be chosen). */ available: boolean; /** The value exists but is out of stock: it can still be chosen (price, back-in-stock), shown as sold out. */ soldOut?: boolean; priceAdjustment?: string; previewImageUrl?: string; color?: string; image?: string }> }> };
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
  /** "Email me when it's back" for the chosen variant while it is sold out; absent where the store cannot send it. */
  notifyWhenAvailable?(email: string, website?: string): Promise<{ ok: boolean; message?: string }>;
  /** Text fields the shopper fills in for this line (engraving, gift message); absent when the product has none. */
  /** Quantity rules (minimum order, steps, most per order): the stepper moves in steps and the rule is shown. */
  quantityRule?: { min: number; step: number; max?: number; text: string };
  personalisation?: {
    fields: Array<{ id: string; label: string; required: boolean; maxLength: number; multiline?: boolean; helpText?: string; /** Formatted extra price, "£5.00". */ priceAdjustment?: string }>;
    values: Record<string, string>;
    setValue(fieldId: string, value: string): void;
    /** Problems by field, shown after the shopper tried to add to the bag. */
    problems?: Record<string, string>;
  };
  wishlistControl?: ReactNode;
  relatedProducts: PublicProduct[];
  /** Other products of the same family (tag `family:<name>`), usually one per colour; the product page links them as swatches. */
  family?: { label: string; members: Array<{ id: string; label: string; href: string; current: boolean; color?: string; image?: string }> };
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
export interface ListAddress { /** The page address's query ("?sort=price-asc&f.size=king"), as the server saw it. */ search: string; /** Replaces the address's query with `next(current)`, without a new history entry. */ update(next: (search: string) => string): void }
export interface CommerceDataProvider { /** The page address, for product lists that keep their filters in it (live store only). */ listAddress?: ListAddress; /** How many items are in the shopper's bag (the header shows it on the bag icon). */ bagCount?: number; /** Products matching what the shopper is typing in the header search (predictive search). Absent in the editor. */ suggestProducts?: (query: string, limit: number) => Promise<PublicProduct[]> | PublicProduct[]; initialProducts?: PublicProduct[]; getProducts(input?: { featured?: boolean; limit?: number; sort?: string; collectionId?: string }): Promise<PublicProduct[]>; subscribeNewsletter?: (email: string, source: string) => Promise<void>; getMetaobjects?: (handle: string) => Promise<PublicMetaobjectList | null>; /** The shopper's cart, for quick add on product cards. Absent in the editor. */ cart?: StorefrontCartAccess; /** Star ratings by product id, for product cards. */ ratings?: Record<string, { average: number; count: number }>; /** Reading and writing product reviews (the product page's Reviews section). */ reviews?: StorefrontReviewAccess; /** The compare list, when the theme lets shoppers compare products. Absent in the editor. */ compare?: StorefrontCompareAccess; /** Products this shopper opened before, newest first (the Recently viewed section). Absent in the editor. */ recentlyViewed?: StorefrontRecentlyViewedAccess; /** One page of a collection (or the whole store, or a search) filtered, counted and sorted by the store's backend. Live store only. */ browseProducts?: (input: import("@jelly/storefront-schema").CatalogQuery & { collectionId?: string; query?: string }) => Promise<CatalogBrowsePage> }
/** A published review as shoppers see it. */
export interface StorefrontReview { id: string; rating: number; title: string; body: string; authorName: string; verifiedPurchase: boolean; createdAt: string }
export interface StorefrontReviewPage { summary: { average: number; count: number; distribution: [number, number, number, number, number] }; reviews: StorefrontReview[] }
/** What the Reviews section may do: read a product's published reviews and send a new one (it waits for the merchant). */
export interface StorefrontReviewAccess {
  list(productId: string, page?: { limit?: number; offset?: number }): Promise<StorefrontReviewPage>;
  submit(productId: string, review: { rating: number; title?: string; body?: string; authorName: string; email?: string }): Promise<{ ok: boolean; message?: string }>;
}
/** What product cards may do with the cart: read and set the quantity of one variant. */
export interface StorefrontCartAccess { quantity(variantId: string): number; setQuantity(variantId: string, quantity: number): Promise<{ ok: boolean; message?: string }> }
/** The shopper's compare list (theme setting Product cards > "Let shoppers compare products"); ids of up to `max` products. */
/** One page of a product list from the backend, with its filters and counts. */
export interface CatalogBrowsePage { products: PublicProduct[]; total: number; facets: import("@jelly/storefront-schema").CatalogFacet[]; price: { minMinor: number; maxMinor: number } | null; filtered: boolean }
/** Ids of products the shopper opened, newest first, kept in their own browser. */
export interface StorefrontRecentlyViewedAccess { ids(): readonly string[]; subscribe(listener: () => void): () => void }
export interface StorefrontCompareAccess { ids(): readonly string[]; toggle(productId: string): { ok: boolean; message?: string }; max: number; subscribe(listener: () => void): () => void }
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
