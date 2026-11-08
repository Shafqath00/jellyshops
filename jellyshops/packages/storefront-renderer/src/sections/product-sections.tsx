import { StorefrontContainer } from "@jelly/storefront-ui";
import { PersonalisationFields } from "./personalisation-fields";
import { ProductCard } from "../product-card";
import { elementProps } from "../element-style";
import { useRef, useState, type CSSProperties } from "react";
import type { StorefrontRuntimeContext } from "../runtime-context";
import type { ProductPresentationContext } from "../types";
import { choice } from "./shared";
import { ProductGalleryViewer } from "../product-gallery-viewer";
import { normalizeRichTextDocument, productMediaSrcSet } from "@jelly/storefront-schema";
import { renderBlocks } from "./rich-text";
import { DiscountChip, FinanceLine, OptionTabs, OptionTileGroups, StickyPurchaseBar, useStickyBar } from "./product-showroom";

function productContext(context: StorefrontRuntimeContext): ProductPresentationContext | null {
  const candidate = context.page?.pageType === "product" ? context.page.resource.data.productPresentation : undefined;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const product = candidate as ProductPresentationContext;
  return typeof product.product?.title === "string" && typeof product.addToCart === "function" ? product : null;
}

/** Product page layouts (template programme P1 gallery-left, P2 gallery-right, P3 centred, P7 compact, P4 details-below). */
export const PRODUCT_PAGE_LAYOUTS = ["theme", "gallery-left", "gallery-right", "centred", "compact", "details-below"] as const;

export function ProductGallerySection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  const media = product?.product.media?.length ? product.product.media : product?.product.imageUrl ? [{ id: "primary", url: product.product.imageUrl, altText: product.product.title }] : [];
  if (!product) return null;
  const fit = section.settings.imageFit === "contain" ? "contain" : "cover";
  // The whole product page's arrangement (storefront-base.css "Product page layouts"); "theme" leaves it to the theme.
  const pageLayout = choice(section.settings, "pageLayout", PRODUCT_PAGE_LAYOUTS, "theme");
  const page = pageLayout === "theme" ? {} : { "data-page-layout": pageLayout };
  if (product.product.galleryEnabled && section.settings.layout !== "stacked" && section.settings.layout !== "grid") return <section className="jelly-section jelly-product-gallery" data-layout="thumbnails" {...page}><StorefrontContainer><ProductGalleryViewer media={media} title={product.product.title} fit={fit} /></StorefrontContainer></section>;
  return <section className="jelly-section jelly-product-gallery" data-layout={choice(section.settings, "layout", ["stacked", "grid"] as const, "stacked")} data-count={media.length} {...page}>
    <StorefrontContainer>
      {media.map((item, index) => <figure key={item.id} className="jelly-product-gallery-item">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} srcSet={productMediaSrcSet(item)} sizes="(min-width: 1024px) 50vw, 100vw" width={"width" in item ? item.width ?? undefined : undefined} height={"height" in item ? item.height ?? undefined : undefined} alt={item.altText ?? product.product.title} style={{ objectFit: fit }} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} />
      </figure>)}
    </StorefrontContainer>
  </section>;
}

export function ProductInformationSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  const part = (id: string) => elementProps({ type: "product-information", settings: section.settings }, id, context.mode === "editor");
  if (!product) {
    const title = context.page?.pageType === "product" ? context.page.resource.data.title : undefined;
    return typeof title === "string" ? <section className="jelly-section jelly-product-information"><StorefrontContainer><h1 {...part("title")}>{title}</h1></StorefrontContainer></section> : null;
  }
  const show = (key: string) => section.settings[key] !== false;
  const specifications = show("showSpecifications") ? Object.entries(product.product.specifications ?? {}) : [];
  const state = product.availability.state;
  return <section className="jelly-section jelly-product-information"><StorefrontContainer>
    {show("showVendor") && product.product.vendor && <p className="jelly-eyebrow" {...part("vendor")}>{product.product.vendor}</p>}
    <h1 {...part("title")}>{product.product.title}</h1>
    <p className="jelly-product-price" {...part("price")}>
      <strong>{product.pricing.price}</strong>
      {show("showCompareAtPrice") && product.pricing.compareAtPrice && <s aria-label={`Was ${product.pricing.compareAtPrice}`}>{product.pricing.compareAtPrice}</s>}
      <DiscountChip pricing={product.pricing} kind={section.settings.discountChip} />
    </p>
    <FinanceLine pricing={product.pricing} settings={section.settings} storeSlug={context.storeSlug} />
    {show("showAvailability") && <p className="jelly-product-availability" data-state={state}>{product.availability.message}</p>}
    {show("showSku") && product.product.sku && <p className="jelly-product-sku">SKU: {product.product.sku}</p>}
    {product.product.shippingCopy && <p className="jelly-product-shipping">{product.product.shippingCopy}</p>}
    {specifications.length > 0 && <details className="jelly-product-details"><summary>Product details</summary><dl>{specifications.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>}
  </StorefrontContainer></section>;
}

/** A colour or image swatch for a value, or null (plain button) when the choice isn't a swatch or the value has no safe colour or image. */
export function swatchFor(display: "color" | "image" | undefined, value: { color?: string; image?: string }): { kind: "color" | "image"; value: string } | null {
  if (display === "color" && typeof value.color === "string" && /^#[0-9a-fA-F]{6}$/.test(value.color)) return { kind: "color", value: value.color };
  if (display === "image" && typeof value.image === "string" && /^(https:\/\/|\/api\/public\/media\/)[^\s"'<>]+$/.test(value.image)) return { kind: "image", value: value.image };
  return null;
}

export function ProductOptionsSection({ context, section }: { context: StorefrontRuntimeContext; section?: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  if (!product || product.product.options.length === 0) return null;
  const setting = section?.settings.style;
  const style = setting === "select" || setting === "tiles" || setting === "tabs" ? setting : "buttons";
  const columns = typeof section?.settings.tileColumns === "number" ? Math.min(4, Math.max(2, Math.round(section.settings.tileColumns))) : 3;
  if (style === "tiles" || style === "tabs") return <section className="jelly-section jelly-product-options" data-style={style} style={{ "--jelly-tile-columns": columns } as CSSProperties}><StorefrontContainer>
    {style === "tabs" && product.product.options.length > 1 ? <OptionTabs product={product} /> : <OptionTileGroups product={product} />}
  </StorefrontContainer></section>;
  return <section className="jelly-section jelly-product-options" data-style={style}><StorefrontContainer>
    {product.product.options.map((option) => {
      const chosen = option.values.filter((value) => value.selected);
      const selected = chosen[0];
      // A dropdown can only hold one value, so choices that take several always render as buttons.
      if (style === "select" && !option.multiple) return <label key={option.id} className="jelly-product-option-select">
        <span>{option.name}{option.missing && <span className="jelly-product-option-required"> (required)</span>}</span>
        <select value={selected?.id ?? ""} onChange={(event) => product.selectOption(option.id, event.target.value)}>
          {!selected && <option value="" disabled>Choose {option.name.toLowerCase()}</option>}
          {option.values.map((value) => <option key={value.id} value={value.id} disabled={!value.available}>{value.label}{value.available ? "" : " — sold out"}</option>)}
        </select>
      </label>;
      return <fieldset key={option.id} aria-invalid={option.missing || undefined} data-missing={option.missing || undefined}>
        <legend>{option.name}{chosen.length > 0 && <span>: {chosen.map((value) => value.label).join(", ")}</span>}{!option.required && chosen.length === 0 && <span> (optional)</span>}{option.missing && <span className="jelly-product-option-required" role="note"> (required)</span>}</legend>
        <div className="jelly-product-option-values" data-display={option.display}>{option.values.map((value) => {
          const swatch = swatchFor(option.display, value);
          return <button key={value.id} type="button" aria-pressed={value.selected} disabled={!value.available} onClick={() => product.selectOption(option.id, value.id)} {...(swatch ? { "data-swatch": swatch.kind, "aria-label": `${value.label}${value.priceAdjustment ? `, +${value.priceAdjustment}` : ""}${value.available ? "" : ", sold out"}`, title: value.label } : {})}>
            {swatch?.kind === "color" && <span className="jelly-swatch" style={{ "--swatch": swatch.value } as CSSProperties} aria-hidden="true" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- merchant media may be served by the API, not as Next Image assets */}
            {swatch?.kind === "image" && <img className="jelly-swatch" src={swatch.value} alt="" loading="lazy" />}
            {!swatch && <>{value.label}{value.priceAdjustment && <span className="jelly-product-option-price"> +{value.priceAdjustment}</span>}</>}
          </button>;
        })}</div>
      </fieldset>;
    })}
  </StorefrontContainer></section>;
}

export function ProductPurchaseSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string>(); const [error, setError] = useState<string>();
  const actions = useRef<HTMLDivElement>(null);
  const showBar = useStickyBar(section.settings.stickyBar === true, actions);
  const product = productContext(context);
  if (!product) return null;
  async function purchase(now = false) {
    if (!product || busy || context.mode !== "published") return;
    setBusy(true); setMessage(undefined); setError(undefined);
    try { const result = await (now ? product.buyNow?.() : product.addToCart()); if (!result?.ok) throw new Error(result?.message ?? "Unable to add this product."); if (!now) { setMessage("Added to your bag."); window.dispatchEvent(new CustomEvent("jelly:cart-added")); } }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add this product."); }
    finally { setBusy(false); }
  }
  const disabled = !product.canAddToCart || busy || context.mode !== "published";
  const max = product.availability.maxQuantity === undefined ? undefined : Math.max(1, product.availability.maxQuantity);
  const label = typeof section.settings.label === "string" && section.settings.label.trim() ? section.settings.label : "Add to cart";
  return <section className="jelly-section jelly-product-purchase"><StorefrontContainer>
    {product.personalisation && <PersonalisationFields personalisation={product.personalisation} />}
    {section.settings.showQuantity !== false && <div className="jelly-quantity">
      <span aria-hidden="true">Quantity</span>
      <div className="jelly-quantity-stepper">
        <button type="button" aria-label="Decrease quantity" disabled={product.quantity <= 1} onClick={() => product.setQuantity(product.quantity - 1)}>−</button>
        <input aria-label="Quantity" type="number" min={1} {...(max === undefined ? {} : { max })} value={product.quantity} onChange={(event) => product.setQuantity(Number(event.target.value))} />
        <button type="button" aria-label="Increase quantity" disabled={max !== undefined && product.quantity >= max} onClick={() => product.setQuantity(product.quantity + 1)}>+</button>
      </div>
    </div>}
    <div className="jelly-purchase-actions" ref={actions}>
      <button type="button" className="jelly-button" disabled={disabled} onClick={() => { void purchase(); }} {...elementProps({ type: "product-purchase", settings: section.settings }, "addToCart", context.mode === "editor")}>{busy ? "Please wait…" : label}</button>
      {product.buyNow && <button type="button" className="jelly-button jelly-button--secondary" disabled={disabled} onClick={() => void purchase(true)}>Buy now</button>}
      {product.wishlistControl}
    </div>
    {message && <p role="status" className="jelly-purchase-message">{message}</p>}
    {error && <p role="alert" className="jelly-purchase-error">{error}</p>}
    {section.settings.stickyBar === true && <StickyPurchaseBar product={product} visible={showBar} label={label} busy={busy} disabled={disabled} onAdd={() => { void purchase(); }} anchor={actions} message={message ?? error} />}
  </StorefrontContainer></section>;
}

export function ProductDescriptionSection({ context, section }: { context: StorefrontRuntimeContext; section?: { settings: Record<string, unknown> } }) {
  const product = productContext(context);
  const descriptionDoc = product?.product.descriptionDoc ? normalizeRichTextDocument(product.product.descriptionDoc) : null;
  if (!product || (!product.product.description && !descriptionDoc?.content.length)) return null;
  const heading = typeof section?.settings.heading === "string" ? section.settings.heading.trim() : "";
  const paragraphs = product.product.description.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>);
  const body = descriptionDoc?.content.length ? <div className="jelly-rich-description">{renderBlocks(descriptionDoc.content)}</div> : paragraphs;
  // "Expandable panel" shows the description as a fold-out panel, open to start with unless the merchant closes it.
  if (section?.settings.layout === "expandable") return <section className="jelly-section jelly-product-description" data-layout="expandable"><StorefrontContainer>
    <details open={section.settings.startOpen !== false ? true : undefined}><summary {...elementProps({ type: "product-description", settings: section.settings }, "heading", context.mode === "editor")}>{heading || "Description"}</summary>{body}</details>
  </StorefrontContainer></section>;
  return <section className="jelly-section jelly-product-description"><StorefrontContainer>
    {heading && <h2 {...elementProps({ type: "product-description", settings: section?.settings ?? {} }, "heading", context.mode === "editor")}>{heading}</h2>}
    {body}
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
    <h2 {...elementProps({ type: "related-products", settings: section.settings }, "heading", context.mode === "editor")}>{heading}</h2>
    <div className="jelly-product-grid-items">{items.map((item) => <ProductCard key={item.id} product={item} editorProps={context.mode === "editor" ? elementProps({ type: "related-products", settings: section.settings }, "productCard", true) as Record<string, string> : undefined} />)}</div>
  </StorefrontContainer></section>;
}
