import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import { useState } from "react";
import type { StorefrontRuntimeContext } from "../runtime-context";
import type { ProductPresentationContext } from "../types";
import { choice } from "./shared";

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
  const fit = section.settings.imageFit === "contain" ? "contain" : "cover";
  return <section className="jelly-section jelly-product-gallery" data-layout={choice(section.settings, "layout", ["stacked", "grid"] as const, "stacked")} data-count={media.length}>
    <StorefrontContainer>
      {media.map((item, index) => <figure key={item.id} className="jelly-product-gallery-item">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.altText ?? product.product.title} style={{ objectFit: fit }} loading={index === 0 ? "eager" : "lazy"} />
      </figure>)}
    </StorefrontContainer>
  </section>;
}

export function ProductInformationSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  if (!product) {
    const title = context.page?.pageType === "product" ? context.page.resource.data.title : undefined;
    return typeof title === "string" ? <section className="jelly-section jelly-product-information"><StorefrontContainer><h1>{title}</h1></StorefrontContainer></section> : null;
  }
  const show = (key: string) => section.settings[key] !== false;
  const specifications = Object.entries(product.product.specifications ?? {});
  const state = product.availability.state;
  return <section className="jelly-section jelly-product-information"><StorefrontContainer>
    {show("showVendor") && product.product.vendor && <p className="jelly-eyebrow">{product.product.vendor}</p>}
    <h1>{product.product.title}</h1>
    <p className="jelly-product-price">
      <strong>{product.pricing.price}</strong>
      {show("showCompareAtPrice") && product.pricing.compareAtPrice && <s aria-label={`Was ${product.pricing.compareAtPrice}`}>{product.pricing.compareAtPrice}</s>}
    </p>
    {show("showAvailability") && <p className="jelly-product-availability" data-state={state}>{product.availability.message}</p>}
    {show("showSku") && product.product.sku && <p className="jelly-product-sku">SKU: {product.product.sku}</p>}
    {product.product.shippingCopy && <p className="jelly-product-shipping">{product.product.shippingCopy}</p>}
    {specifications.length > 0 && <details className="jelly-product-details"><summary>Product details</summary><dl>{specifications.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>}
  </StorefrontContainer></section>;
}

export function ProductOptionsSection({ context, section }: { context: StorefrontRuntimeContext; section?: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  if (!product || product.product.options.length === 0) return null;
  const style = section?.settings.style === "select" ? "select" : "buttons";
  return <section className="jelly-section jelly-product-options" data-style={style}><StorefrontContainer>
    {product.product.options.map((option) => {
      const selected = option.values.find((value) => value.selected);
      if (style === "select") return <label key={option.id} className="jelly-product-option-select">
        <span>{option.name}</span>
        <select value={selected?.id ?? ""} onChange={(event) => product.selectOption(option.id, event.target.value)}>
          {!selected && <option value="" disabled>Choose {option.name.toLowerCase()}</option>}
          {option.values.map((value) => <option key={value.id} value={value.id} disabled={!value.available}>{value.label}{value.available ? "" : " — sold out"}</option>)}
        </select>
      </label>;
      return <fieldset key={option.id}>
        <legend>{option.name}{selected && <span>: {selected.label}</span>}</legend>
        <div className="jelly-product-option-values">{option.values.map((value) => <button key={value.id} type="button" aria-pressed={value.selected} disabled={!value.available} onClick={() => product.selectOption(option.id, value.id)}>{value.label}</button>)}</div>
      </fieldset>;
    })}
  </StorefrontContainer></section>;
}

export function ProductPurchaseSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string>(); const [error, setError] = useState<string>();
  const product = productContext(context);
  if (!product) return null;
  async function purchase(now = false) {
    if (!product || busy || context.mode !== "published") return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try { const result = await (now ? product.buyNow?.() : product.addToCart()); if (!result?.ok) throw new Error(result?.message ?? "Unable to add this product."); if (!now) setMessage("Added to your bag."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add this product."); }
    finally { setBusy(false); }
  }
  const disabled = !product.canAddToCart || busy || context.mode !== "published";
  const max = product.availability.maxQuantity === undefined ? undefined : Math.max(1, product.availability.maxQuantity);
  const label = typeof section.settings.label === "string" && section.settings.label.trim() ? section.settings.label : "Add to cart";
  return <section className="jelly-section jelly-product-purchase"><StorefrontContainer>
    {section.settings.showQuantity !== false && <div className="jelly-quantity">
      <span aria-hidden="true">Quantity</span>
      <div className="jelly-quantity-stepper">
        <button type="button" aria-label="Decrease quantity" disabled={product.quantity <= 1} onClick={() => product.setQuantity(product.quantity - 1)}>−</button>
        <input aria-label="Quantity" type="number" min={1} {...(max === undefined ? {} : { max })} value={product.quantity} onChange={(event) => product.setQuantity(Number(event.target.value))} />
        <button type="button" aria-label="Increase quantity" disabled={max !== undefined && product.quantity >= max} onClick={() => product.setQuantity(product.quantity + 1)}>+</button>
      </div>
    </div>}
    <div className="jelly-purchase-actions">
      <button type="button" className="jelly-button" disabled={disabled} onClick={() => { void purchase(); }}>{busy ? "Please wait…" : label}</button>
      {product.buyNow && <button type="button" className="jelly-button jelly-button--secondary" disabled={disabled} onClick={() => void purchase(true)}>Buy now</button>}
      {product.wishlistControl}
    </div>
    {message && <p role="status" className="jelly-purchase-message">{message}</p>}
    {error && <p role="alert" className="jelly-purchase-error">{error}</p>}
  </StorefrontContainer></section>;
}

export function ProductDescriptionSection({ context, section }: { context: StorefrontRuntimeContext; section?: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  if (!product?.product.description) return null;
  const heading = typeof section?.settings.heading === "string" ? section.settings.heading.trim() : "";
  return <section className="jelly-section jelly-product-description"><StorefrontContainer>
    {heading && <h2>{heading}</h2>}
    {product.product.description.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
  </StorefrontContainer></section>;
}

export function RelatedProductsSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  if (!product) return null;
  const limit = typeof section.settings.limit === "number" ? section.settings.limit : 4;
  const items = product.relatedProducts.slice(0, limit);
  if (!items.length) return null;
  const heading = typeof section.settings.heading === "string" && section.settings.heading.trim() ? section.settings.heading : "You may also like";
  return <section className="jelly-section jelly-related-products"><StorefrontContainer>
    <h2>{heading}</h2>
    <div className="jelly-product-grid-items">{items.map((item) => <StorefrontProductCard key={item.id} product={item} />)}</div>
  </StorefrontContainer></section>;
}
