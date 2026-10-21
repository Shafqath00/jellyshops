import type { CSSProperties } from "react";
import type { MediaReference, SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import type { RendererMode } from "../types";
import { choice, imageValue, numberValue, sectionData, visibleBlocks } from "./shared";

function stringSetting(settings: Record<string, unknown>, key: string, fallback = ""): string {
  const value = settings[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function imageSetting(settings: Record<string, unknown>): MediaReference | undefined {
  const image = settings.image;
  return image && typeof image === "object" && "url" in image ? image as MediaReference : undefined;
}

function copy(section: SectionNode, fallbackHeading: string) {
  const visible = section.blocks.filter((block) => block.enabled);
  const heading = visible.find((block) => block.type === "heading");
  const body = visible.find((block) => block.type === "text");
  const button = visible.find((block) => block.type === "button");
  return {
    heading: stringSetting(heading?.settings ?? section.settings, "text", stringSetting(section.settings, "heading", fallbackHeading)),
    body: stringSetting(body?.settings ?? section.settings, "text", stringSetting(section.settings, "text")),
    button: stringSetting(button?.settings ?? section.settings, "label"),
    href: stringSetting(button?.settings ?? section.settings, "href", "/shop"),
  };
}

function SectionIntro({ section, fallback }: { section: SectionNode; fallback: string }) {
  const content = copy(section, fallback);
  return <div className="jelly-section-intro">
    <h2>{content.heading}</h2>
    {content.body && <p>{content.body}</p>}
    {content.button && <a className="jelly-button" href={content.href}>{content.button}</a>}
  </div>;
}

export function CategoryGridSection({ section, context }: { section: SectionNode; context?: StorefrontRuntimeContext }) {
  const shopHref = context?.storeSlug ? `/${context.storeSlug}/shop` : "#shop";
  const cards = visibleBlocks(section, "collection-card").flatMap((block) => {
    const label = stringSetting(block.settings, "label");
    return label ? [{ id: block.id, label, image: imageValue(block.settings), href: resolveStorefrontHref(block.settings.link, context?.storeSlug) ?? shopHref }] : [];
  });
  // Until the merchant adds collection cards, show neutral placeholders that link to the shop.
  const items = cards.length ? cards : ["New arrivals", "Best sellers", "For the home", "Gifts"].map((label) => ({ id: label, label, image: undefined, href: shopHref }));
  const columns = numberValue(section.settings, "columns", 4, 2, 4);
  return <section className="jelly-section jelly-category-grid" {...sectionData(section, { "data-image-ratio": choice(section.settings, "imageRatio", ["portrait", "square"] as const, "portrait") })}><StorefrontContainer>
    <SectionIntro section={section} fallback="Shop by collection" />
    <div className="jelly-category-grid-items" style={{ "--jelly-columns": columns } as CSSProperties}>{items.map((item) => <a href={item.href} className="jelly-category-card" key={item.id}>
      <span className="jelly-category-card-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.image ? <img src={item.image.url} alt="" loading="lazy" /> : null}
      </span>
      <strong>{item.label}</strong>
    </a>)}</div>
  </StorefrontContainer></section>;
}

export function TestimonialsSection({ section, mode = "published" }: { section: SectionNode; mode?: RendererMode }) {
  const reviews = visibleBlocks(section, "testimonial").flatMap((block) => {
    const quote = stringSetting(block.settings, "quote");
    return quote ? [{ id: block.id, quote, author: stringSetting(block.settings, "author") }] : [];
  });
  // Never invent reviews: with no testimonials the section only shows an editing hint outside the live store.
  if (!reviews.length && mode === "published") return null;
  return <section className="jelly-section jelly-testimonials" {...sectionData(section)}><StorefrontContainer>
    <SectionIntro section={section} fallback="What customers say" />
    {reviews.length
      ? <div className="jelly-testimonial-grid">{reviews.map((review) => <blockquote key={review.id}><p>{review.quote}</p>{review.author && <cite>{review.author}</cite>}</blockquote>)}</div>
      : <p className="jelly-editor-hint">Add a testimonial block with a real customer quote. This section stays hidden on your live store until you do.</p>}
  </StorefrontContainer></section>;
}

export function TrustStripSection({ section }: { section: SectionNode }) {
  const promises = visibleBlocks(section).map((block) => stringSetting(block.settings, "text")).filter(Boolean);
  const items = promises.length ? promises : ["Secure checkout", "Carefully packed", "Friendly support"];
  return <section className="jelly-trust-strip" {...sectionData(section)}><StorefrontContainer><ul>{items.slice(0, 4).map((item) => <li key={item}>
    <svg className="jelly-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
    {item}
  </li>)}</ul></StorefrontContainer></section>;
}

export function ImageMosaicSection({ section }: { section: SectionNode }) {
  const image = imageSetting(section.settings);
  const content = copy(section, "A closer look");
  const imageStyle: CSSProperties | undefined = image ? { backgroundImage: `url(${image.url})` } : undefined;
  return <section className="jelly-section jelly-image-mosaic"><StorefrontContainer><div className="jelly-image-mosaic-grid">
    <div className="jelly-mosaic-panel jelly-mosaic-copy"><h2>{content.heading}</h2>{content.body && <p>{content.body}</p>}{content.button && <a className="jelly-button" href={content.href}>{content.button}</a>}</div>
    <div className="jelly-mosaic-panel jelly-mosaic-image" style={imageStyle}>{!image && <span>Our process, in detail</span>}</div>
    <div className="jelly-mosaic-panel jelly-mosaic-note"><span>Made for slow moments</span></div>
  </div></StorefrontContainer></section>;
}

export function JournalTeaserSection({ section, context }: { section: SectionNode; context?: StorefrontRuntimeContext }) {
  return <section className="jelly-section jelly-journal"><StorefrontContainer><SectionIntro section={section} fallback="From the journal" />
    <div className="jelly-journal-grid">{["The ritual of everyday objects", "A guide to thoughtful gifting", "Notes from our makers"].map((title, index) => <article key={title}><span>Journal · 0{index + 1}</span><h3>{title}</h3><a href={context?.storeSlug ? `/${context.storeSlug}/shop` : "#shop"}>Read story →</a></article>)}</div>
  </StorefrontContainer></section>;
}

interface CartLineView { id: string; name: string; productName?: string; variantName?: string; imageUrl?: string; options?: string[]; quantity: number; unitPrice?: string; total: string; canIncrease?: boolean; onDecrease?: () => void; onIncrease?: () => void; onRemove?: () => void }

export function CartSummarySection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const content = copy(section, "Your bag");
  const data = context?.page?.pageType === "cart" ? context.page.data ?? {} : {};
  const lines = Array.isArray(data.lines) ? data.lines as CartLineView[] : [];
  const subtotal = typeof data.subtotal === "string" ? data.subtotal : undefined;
  const checkoutHref = typeof data.checkoutHref === "string" ? data.checkoutHref : undefined;
  const shopHref = typeof data.shopHref === "string" ? data.shopHref : resolveStorefrontHref(content.href, context?.storeSlug) ?? "#";
  const shippingNote = typeof data.shippingNote === "string" ? data.shippingNote : "Shipping is calculated at checkout.";
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (!lines.length) return <section className="jelly-section jelly-cart-summary" data-empty="true"><StorefrontContainer><div className="jelly-cart-empty">
    <h1>{content.heading}</h1>
    <p>{content.body || "Your bag is empty. Find something you love and it will appear here."}</p>
    <a className="jelly-button" href={shopHref}>Continue shopping</a>
  </div></StorefrontContainer></section>;
  return <section className="jelly-section jelly-cart-summary"><StorefrontContainer>
    <header className="jelly-cart-header"><h1>{content.heading}</h1><p>{count === 1 ? "1 item" : `${count} items`}</p></header>
    <div className="jelly-cart-layout">
      <ul className="jelly-cart-lines">{lines.map((line) => <li key={line.id} className="jelly-cart-line">
        <span className="jelly-cart-line-media">{/* eslint-disable-next-line @next/next/no-img-element */}{line.imageUrl ? <img src={line.imageUrl} alt="" loading="lazy" /> : null}</span>
        <div className="jelly-cart-line-details">
          <strong>{line.productName ?? line.name}</strong>
          {line.variantName && line.variantName !== "Standard" && <span>{line.variantName}</span>}
          {line.options?.map((option) => <span key={option}>{option}</span>)}
          {line.unitPrice && <span>{line.unitPrice} each</span>}
          <div className="jelly-cart-line-controls">
            <div className="jelly-quantity-stepper">
              <button type="button" aria-label={`Decrease quantity of ${line.productName ?? line.name}`} onClick={line.onDecrease}>−</button>
              <span aria-live="polite" aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
              <button type="button" aria-label={`Increase quantity of ${line.productName ?? line.name}`} disabled={line.canIncrease === false} onClick={line.onIncrease}>+</button>
            </div>
            {line.onRemove && <button type="button" className="jelly-button jelly-button--link" onClick={line.onRemove}>Remove</button>}
          </div>
        </div>
        <strong className="jelly-cart-line-total">{line.total}</strong>
      </li>)}</ul>
      <aside className="jelly-cart-totals" aria-label="Order summary">
        <h2>Order summary</h2>
        <dl><div><dt>Subtotal</dt><dd>{subtotal}</dd></div></dl>
        <p>{shippingNote}</p>
        {checkoutHref && <a className="jelly-button" href={checkoutHref}>Checkout</a>}
        <a className="jelly-button jelly-button--link" href={shopHref}>Continue shopping</a>
      </aside>
    </div>
  </StorefrontContainer></section>;
}

export function SearchResultsSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const search = context.page?.pageType === "search" ? context.page.data : null;
  const content = copy(section, "Search");
  const query = search?.query ?? "";
  const results = search?.results ?? [];
  const action = search?.searchHref ?? (context.storeSlug ? `/${context.storeSlug}/search` : "/search");
  return <section className="jelly-section jelly-search-results"><StorefrontContainer><div className="jelly-search-shell">
    <h1>{content.heading}</h1>
    {content.body && <p>{content.body}</p>}
    <form action={action} role="search"><label htmlFor="storefront-search">Search products</label><div><input id="storefront-search" type="search" name="q" defaultValue={query} placeholder="What are you looking for?" /><button type="submit">Search</button></div></form>
    {search?.state === "empty" && <p className="jelly-search-status">Enter a word or two to find products.</p>}
    {search?.state === "none" && <p className="jelly-search-status">No products match “{query}”. Check the spelling or try a broader word.</p>}
    {search?.state === "results" && <p className="jelly-search-status">{search.resultCount === 1 ? "1 result" : `${search.resultCount} results`} for “{query}”</p>}
    {search?.state === "results" && <h2 className="jelly-visually-hidden">Search results</h2>}
    {search?.state === "results" && <div className="jelly-product-grid-items">{results.map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>}
  </div></StorefrontContainer></section>;
}

export function NotFoundMessageSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const content = copy(section, "We couldn't find that page");
  const href = resolveStorefrontHref(content.href, context.storeSlug);
  return <section className="jelly-section jelly-not-found"><StorefrontContainer><div><p className="jelly-eyebrow">404</p><h1>{content.heading}</h1><p>{content.body || "The page may have moved, but there is plenty more to discover."}</p>{href && <a className="jelly-button" href={href}>{content.button || "Back to the shop"}</a>}</div></StorefrontContainer></section>;
}
