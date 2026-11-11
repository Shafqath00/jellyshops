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

function CardMedia({ product }: { product: StorefrontProductCardData }) {
  return <div className="jelly-product-card-media" data-card-part="media">
    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" /> : <span className="jelly-product-card-placeholder" aria-hidden="true" />}
    {/* Decorative: the name is already on the first photo. Hidden unless the theme setting is on. */}
    {product.imageUrl && product.hoverImageUrl && <img className="jelly-product-card-hover-image" src={product.hoverImageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" />}
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
export function StorefrontProductCard({ product, editorProps, actions }: { product: StorefrontProductCardData; editorProps?: Record<string, string>; actions?: ReactNode }) {
  return <article className="jelly-product-card" {...editorProps}>
    <a href={product.href}>
      <CardMedia product={product} />
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
