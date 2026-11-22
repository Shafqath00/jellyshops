import type { CSSProperties, ReactNode } from "react";

/** One colour or pattern a product comes in, drawn as a dot on its card. */
export interface StorefrontProductSwatch { label: string; color?: string; image?: string }

export interface StorefrontProductCardData {
  name: string;
  href: string;
  imageUrl: string;
  price: string;
  compareAtPrice?: string;
  badge?: string;
  saving?: string;
  discountPercent?: number;
  chip?: string;
  /** The brand (product vendor); shown when the theme's "Show the brand" setting is on. */
  vendor?: string;
  /** Up to five colours of the product's colour option; shown when the theme's "Colour swatches" setting is on. */
  swatches?: StorefrontProductSwatch[];
  /** How many more colours there are beyond `swatches`. */
  moreSwatches?: number;
  /** Average star rating and number of published reviews; shown when the theme's "Show star ratings" setting is on. */
  rating?: { average: number; count: number };
  /** Second photo; shown when the shopper points at the card, if the theme's "Second photo on hover" setting is on. */
  hoverImageUrl?: string;
  /** Resized copies of the photo the media API has (from the upload); the srcset then lists exactly these. */
  imageWidths?: number[];
  /** Tiny blurred copy (a data URL) painted behind the photo until it loads. */
  imagePlaceholder?: string;
}

/**
 * The product card is a fixed set of parts, in this order: photo (with badges), brand, name, price, savings, colour
 * swatches, label chip and button (docs/design-contract.md §2.5). Every product list (product grids, collection
 * pages, related products, search, recipes) draws this one card, so a theme setting changes all of them. Each part
 * carries `data-card-part`; the theme's Product cards settings show, hide or reorder parts through `--jelly-card-*`
 * tokens (theme-style-settings.ts), and parts that are off by default are hidden by `storefront-base.css`.
 */
export const PRODUCT_CARD_PARTS = ["media", "vendor", "title", "rating", "price", "savings", "swatches", "chip", "button"] as const;
export type ProductCardPart = (typeof PRODUCT_CARD_PARTS)[number];

const HEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_IMAGE = /^(https:\/\/|\/api\/public\/media\/)[^\s"'<>()]+$/;

/**
 * Store photos (served by the media API) come in 320, 640 and 1280px copies (`?w=`), so a card downloads the copy that
 * fits it instead of the 1536px original. Other addresses (sample photos, outside images) are used as they are.
 */
const MEDIA_PHOTO = /\/api\/public\/media\/[^/?#]+\/[^/?#]+(?:[?#]|$)/;
/**
 * Theme photos that ship with smaller copies (name-640.webp, name-1024.webp, written next to the original by
 * scripts/generate-theme-assets.mjs). Only built-in themes listed here have them, and every original is 1536px wide
 * (a test keeps the list, the copies and the width in step); uploaded themes' photos are used as they are.
 */
export const THEME_PHOTOS_WITH_COPIES = ["jelly-resthaven"] as const;
export const THEME_PHOTO_ORIGINAL_WIDTH = 1536;
const THEME_PHOTO = new RegExp(`^/themes/(${THEME_PHOTOS_WITH_COPIES.join("|")})/([a-z0-9-]+)\\.webp$`);
/** Widths the media API makes; a photo's own list (when known) says which of these exist for it. */
const MEDIA_WIDTHS = [320, 640, 960, 1280, 1920];
const LEGACY_WIDTHS = [320, 640, 1280];
export function cardPhotoSrcSet(url: string, widths?: readonly number[]): string | undefined {
  const theme = THEME_PHOTO.exec(url);
  if (theme && !/-(640|1024)$/.test(theme[2])) {
    const base = `/themes/${theme[1]}/${theme[2]}`;
    return `${base}-640.webp 640w, ${base}-1024.webp 1024w, ${url} ${THEME_PHOTO_ORIGINAL_WIDTH}w`;
  }
  if (!MEDIA_PHOTO.test(url)) return undefined;
  // Without a list (photos uploaded before copies were recorded) only the three oldest sizes are asked for.
  const list = widths?.filter((width) => MEDIA_WIDTHS.includes(width)) ?? [];
  return (list.length ? list : LEGACY_WIDTHS).map((width) => `${url}${url.includes("?") ? "&" : "?"}w=${width} ${width}w`).join(", ");
}
/** How wide a card shows: a quarter of the page on desktop, a third on tablets, half on phones. */
export const CARD_PHOTO_SIZES = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

function CardMedia({ product, priority }: { product: StorefrontProductCardData; priority?: boolean }) {
  const photo = (url: string, widths?: number[]) => { const srcSet = cardPhotoSrcSet(url, widths); return { src: url, srcSet, sizes: srcSet ? CARD_PHOTO_SIZES : undefined }; };
  // The blur sits behind the photo and is covered once the photo has loaded.
  const blur = product.imagePlaceholder?.startsWith("data:image/webp;base64,") ? { backgroundImage: `url("${product.imagePlaceholder}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;
  return <div className="jelly-product-card-media" data-card-part="media">
    {/* The first cards on screen load at once and first in line (they are often the largest thing in view). */}
    {product.imageUrl ? <img {...photo(product.imageUrl, product.imageWidths)} style={blur} alt={product.name} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" /> : <span className="jelly-product-card-placeholder" aria-hidden="true" />}
    {/* Decorative: the name is already on the first photo. Hidden unless the theme setting is on. */}
    {product.imageUrl && product.hoverImageUrl && <img className="jelly-product-card-hover-image" {...photo(product.hoverImageUrl)} alt="" aria-hidden="true" loading="lazy" decoding="async" />}
    {product.badge && <span className="jelly-product-card-badge">{product.badge}</span>}
    {/* Hidden unless the theme's "Sale badge" setting is on. */}
    {!product.badge && product.compareAtPrice && <span className="jelly-product-card-badge" data-badge="sale">Sale</span>}
  </div>;
}

function CardVendor({ product }: { product: StorefrontProductCardData }) {
  return product.vendor ? <p className="jelly-product-card-vendor" data-card-part="vendor">{product.vendor}</p> : null;
}

function CardTitle({ product }: { product: StorefrontProductCardData }) {
  return <h3 data-card-part="title">{product.name}</h3>;
}

/** Five stars filled to the average (one decimal), and the review count. Hidden unless the theme shows ratings. */
function CardRating({ product }: { product: StorefrontProductCardData }) {
  const rating = product.rating;
  if (!rating || rating.count <= 0 || !Number.isFinite(rating.average)) return null;
  const average = Math.max(0, Math.min(5, rating.average));
  return <p className="jelly-product-card-rating" data-card-part="rating">
    <span className="jelly-stars" style={{ "--jelly-stars": average } as CSSProperties} aria-hidden="true">★★★★★</span>
    <span className="jelly-visually-hidden">{`Rated ${average.toFixed(1)} out of 5 from ${rating.count} ${rating.count === 1 ? "review" : "reviews"}`}</span>
    <span className="jelly-product-card-rating-count" aria-hidden="true">({rating.count})</span>
  </p>;
}

function CardPrice({ product }: { product: StorefrontProductCardData }) {
  return <p className="jelly-product-card-price" data-card-part="price">
    <span>{product.price}</span>
    {product.compareAtPrice && <s aria-label={`Was ${product.compareAtPrice}`}>{product.compareAtPrice}</s>}
  </p>;
}

function CardSavings({ product }: { product: StorefrontProductCardData }) {
  if (!product.saving && !product.discountPercent) return null;
  return <p className="jelly-product-card-saving" data-card-part="savings">
    {product.saving && <span data-saving="amount">Save {product.saving}</span>}
    {product.discountPercent ? <span data-saving="percent">{product.discountPercent}% off</span> : null}
  </p>;
}

function CardSwatches({ product }: { product: StorefrontProductCardData }) {
  const swatches = (product.swatches ?? []).filter((swatch) => (swatch.color && HEX.test(swatch.color)) || (swatch.image && SAFE_IMAGE.test(swatch.image))).slice(0, 5);
  if (!swatches.length) return null;
  const total = swatches.length + Math.max(0, product.moreSwatches ?? 0);
  return <p className="jelly-product-card-swatches" data-card-part="swatches">
    <span className="jelly-visually-hidden">{`Available in ${total} ${total === 1 ? "colour" : "colours"}`}</span>
    {swatches.map((swatch) => <span
      key={swatch.label}
      className="jelly-product-card-swatch"
      aria-hidden="true"
      title={swatch.label}
      style={swatch.color && HEX.test(swatch.color) ? { background: swatch.color } : { backgroundImage: `url("${swatch.image}")` }}
    />)}
    {total > swatches.length && <span className="jelly-product-card-swatch-more" aria-hidden="true">+{total - swatches.length}</span>}
  </p>;
}

function CardChip({ product }: { product: StorefrontProductCardData }) {
  return product.chip ? <span className="jelly-product-card-chip" data-card-part="chip">{product.chip}</span> : null;
}

/** Hidden unless the theme's card "Button" setting is on; the label comes from the theme (the link already names the product). */
function CardButton() {
  return <span className="jelly-product-card-button" data-card-part="button" aria-hidden="true" />;
}

/**
 * `editorProps` are the editor preview's selection data (data-* attributes only); the live store passes none.
 * `actions` (quick add) sit after the link, because a button may not be inside a link.
 */
export function StorefrontProductCard({ product, editorProps, actions, priority }: { product: StorefrontProductCardData; editorProps?: Record<string, string>; actions?: ReactNode; /** One of the first cards on screen: its photo loads at once. */ priority?: boolean }) {
  return <article className="jelly-product-card" {...editorProps}>
    <a href={product.href}>
      <CardMedia product={product} priority={priority} />
      <div className="jelly-product-card-body">
        <CardVendor product={product} />
        <CardTitle product={product} />
        <CardRating product={product} />
        <CardPrice product={product} />
        <CardSavings product={product} />
        <CardSwatches product={product} />
        <CardChip product={product} />
        <CardButton />
      </div>
    </a>
    {actions && <div className="jelly-product-card-actions" data-card-part="actions">{actions}</div>}
  </article>;
}
