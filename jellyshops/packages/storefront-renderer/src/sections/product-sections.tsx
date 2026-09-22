import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import type { ProductPresentationContext } from "../types";

function productContext(context: StorefrontRuntimeContext): ProductPresentationContext | null {
  const candidate = context.page?.pageType === "product" ? context.page.resource.data.productPresentation : undefined;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const product = candidate as ProductPresentationContext;
  return typeof product.product?.title === "string" && typeof product.addToCart === "function" ? product : null;
}

export function ProductGallerySection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  const media = product?.product.media?.length ? product.product.media : product?.product.imageUrl ? [{ id: "primary", url: product.product.imageUrl, altText: product.product.title }] : [];
  if (!product || media.length === 0) return null;
  return <section className="jelly-section jelly-product-gallery"><StorefrontContainer>{media.map((item) => <img key={item.id} src={item.url} alt={item.altText ?? product.product.title} style={{ objectFit: section.settings.imageFit === "contain" ? "contain" : "cover" }} />)}</StorefrontContainer></section>;
}

export function ProductInformationSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  if (!product) {
    const title = context.page?.pageType === "product" ? context.page.resource.data.title : undefined;
    return typeof title === "string" ? <section className="jelly-section jelly-product-information"><StorefrontContainer><h1>{title}</h1></StorefrontContainer></section> : null;
  }
  const show = (key: string) => section.settings[key] !== false;
  return <section className="jelly-section jelly-product-information"><StorefrontContainer><h1>{product.product.title}</h1>{show("showVendor") && product.product.vendor && <p>{product.product.vendor}</p>}<p><strong>{product.pricing.price}</strong>{show("showCompareAtPrice") && product.pricing.compareAtPrice && <s>{product.pricing.compareAtPrice}</s>}</p>{show("showSku") && product.product.sku && <p>SKU: {product.product.sku}</p>}{show("showAvailability") && <p>{product.availability.message}</p>}</StorefrontContainer></section>;
}

export function ProductOptionsSection({ context }: { context: StorefrontRuntimeContext }) {
  const product = productContext(context);
  if (!product) return null;
  return <section className="jelly-section jelly-product-options"><StorefrontContainer>{product.product.options.map((option) => <fieldset key={option.id}><legend>{option.name}</legend>{option.values.map((value) => <button key={value.id} type="button" aria-pressed={value.selected} disabled={!value.available} onClick={() => product.selectOption(option.id, value.id)}>{value.label}</button>)}</fieldset>)}</StorefrontContainer></section>;
}

export function ProductPurchaseSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  if (!product) return null;
  return <section className="jelly-section jelly-product-purchase"><StorefrontContainer>{section.settings.showQuantity !== false && <label>Quantity<input aria-label="Quantity" type="number" min={1} {...(product.availability.maxQuantity === undefined ? {} : { max: Math.max(1, product.availability.maxQuantity) })} value={product.quantity} onChange={(event) => product.setQuantity(Number(event.target.value))} /></label>}<button type="button" disabled={!product.canAddToCart} onClick={() => { void product.addToCart(); }}>{typeof section.settings.label === "string" ? section.settings.label : "Add to cart"}</button></StorefrontContainer></section>;
}

export function ProductDescriptionSection({ context }: { context: StorefrontRuntimeContext }) {
  const product = productContext(context);
  return product?.product.description ? <section className="jelly-section jelly-product-description"><StorefrontContainer><p>{product.product.description}</p></StorefrontContainer></section> : null;
}

export function RelatedProductsSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  if (!product) return null;
  const limit = typeof section.settings.limit === "number" ? section.settings.limit : 4;
  return <section className="jelly-section jelly-related-products"><StorefrontContainer>{product.relatedProducts.slice(0, limit).map((item) => <StorefrontProductCard key={item.id} product={item} />)}</StorefrontContainer></section>;
}
