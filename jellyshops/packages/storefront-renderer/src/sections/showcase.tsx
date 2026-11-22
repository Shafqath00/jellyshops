/**
 * Showcase sections: Shop the look (a room photo with product pins), Featured product (one product told as a
 * story), the rotating announcement bar and the reviews carousel. Any theme can use them; Resthaven's home page
 * is built from them (RESEARCH.md).
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { CommerceDataProvider, PublicProduct, RendererMode } from "../types";
import { resolveStorefrontHref, type StorefrontRuntimeContext } from "../runtime-context";
import { elementProps, blockElementProps } from "../element-style";
import { blockEditorData } from "./block-content";
import { imageValue, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";
import { mediaPhoto } from "../media-photo";
import { Stars } from "./product-reviews";
import { SliderControls, useSlider } from "../slider";

const reducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function subscribeMotion(listener: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener?.("change", listener);
  return () => query.removeEventListener?.("change", listener);
}

/** The store's products for a section: the page's own list first, then the full list once loaded. */
export function useStoreProducts(commerce: CommerceDataProvider, wanted: boolean): PublicProduct[] {
  const [loaded, setLoaded] = useState<{ source: CommerceDataProvider; products: PublicProduct[] }>();
  useEffect(() => {
    if (!wanted) return;
    let active = true;
    void Promise.resolve(commerce.getProducts({ limit: 200 })).then((products) => { if (active) setLoaded({ source: commerce, products }); }).catch(() => { if (active) setLoaded({ source: commerce, products: [] }); });
    return () => { active = false; };
  }, [commerce, wanted]);
  return loaded?.source === commerce && loaded.products.length ? loaded.products : commerce.initialProducts ?? [];
}

/** A chosen product, else the product at `fallbackIndex` (so a new store's pins and spotlight show its own products). */
export function pickProduct(products: readonly PublicProduct[], id: unknown, fallbackIndex: number): PublicProduct | undefined {
  if (typeof id === "string" && id) {
    const chosen = products.find((product) => product.id === id);
    if (chosen) return chosen;
  }
  return products.length ? products[fallbackIndex % products.length] : undefined;
}

function ratingFor(product: PublicProduct, commerce: CommerceDataProvider) {
  const rating = commerce.ratings?.[product.id] ?? product.rating;
  return rating && rating.count > 0 ? rating : undefined;
}

function Price({ product }: { product: PublicProduct }) {
  return <p className="jelly-showcase-price">
    <span className={product.compareAtPrice ? "is-sale" : undefined}>{product.price}</span>
    {product.compareAtPrice && <s><span className="jelly-visually-hidden">Was </span>{product.compareAtPrice}</s>}
  </p>;
}

/* ── Shop the look ───────────────────────────────────────────────────────────── */

export function ShopTheLookSection({ section, commerce, context }: { section: SectionNode; commerce: CommerceDataProvider; context: StorefrontRuntimeContext }) {
  const editor = context.mode === "editor";
  const products = useStoreProducts(commerce, true);
  const image = imageValue(section.settings);
  const hotspots = visibleBlocks(section, "hotspot");
  // Pins without a chosen product take the store's other products in order, never one another pin already shows.
  const chosen = new Set(hotspots.map((block) => block.settings.productId).filter((id): id is string => typeof id === "string" && products.some((product) => product.id === id)));
  const spare = products.filter((product) => !chosen.has(product.id));
  let nextSpare = 0;
  const pins = hotspots.flatMap((block) => {
    const id = block.settings.productId;
    const product = typeof id === "string" && chosen.has(id) ? products.find((item) => item.id === id) : spare[nextSpare++];
    return product ? [{ block, product, x: numberValue(block.settings, "x", 50, 0, 100), y: numberValue(block.settings, "y", 50, 0, 100) }] : [];
  });
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", close); };
  }, [open]);
  if (!image && !editor) return null;
  const heading = stringValue(section.settings, "heading");
  const text = stringValue(section.settings, "text");
  const eyebrow = stringValue(section.settings, "eyebrow");
  const position = section.settings.imagePosition === "right" ? "right" : "left";
  return <section className="jelly-section jelly-shop-look" {...sectionData(section, { "data-image-position": position })}><StorefrontContainer>
    <div className="jelly-shop-look-layout">
      <div className="jelly-shop-look-media" ref={root} {...elementProps(section, "image", editor)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img src={image.url} {...mediaPhoto(image.url, "(min-width: 900px) 60vw, 100vw")} alt={typeof image.alt === "string" ? image.alt : ""} loading="lazy" /> : <div className="jelly-shop-look-placeholder">Add a room photo</div>}
        {pins.map(({ block, product, x, y }, index) => {
          const id = `${baseId}-${block.id}`;
          const isOpen = open === block.id;
          return <div key={block.id} className="jelly-hotspot" style={{ "--x": `${x}%`, "--y": `${y}%` } as CSSProperties} data-open={isOpen || undefined} data-side={x > 60 ? "left" : "right"} {...blockEditorData(block, editor, "Pin")}>
            <button type="button" className="jelly-hotspot-pin" aria-expanded={isOpen} aria-controls={id} onClick={() => setOpen(isOpen ? null : block.id)}>
              <span aria-hidden="true">{index + 1}</span><span className="jelly-visually-hidden">Show {product.name}</span>
            </button>
            <div className="jelly-hotspot-card" id={id} hidden={!isOpen}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {product.imageUrl && <img src={product.imageUrl} {...mediaPhoto(product.imageUrl, "96px")} alt="" loading="lazy" />}
              <div><a href={product.href}>{product.name}</a><Price product={product} /></div>
            </div>
          </div>;
        })}
      </div>
      <div className="jelly-shop-look-copy">
        {eyebrow && <p className="jelly-eyebrow" {...elementProps(section, "eyebrow", editor)}>{eyebrow}</p>}
        {heading && <h2 {...elementProps(section, "heading", editor)}>{heading}</h2>}
        {text && <p {...elementProps(section, "text", editor)}>{text}</p>}
        {/* The same products as a list: readable without the photo and easy to tap on phones. */}
        {pins.length > 0 && <ol className="jelly-shop-look-list">{pins.map(({ block, product }, index) => <li key={block.id}>
          <span className="jelly-shop-look-number" aria-hidden="true">{index + 1}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {product.imageUrl && <img src={product.imageUrl} {...mediaPhoto(product.imageUrl, "72px")} alt="" loading="lazy" />}
          <div><a href={product.href}>{product.name}</a><Price product={product} /></div>
        </li>)}</ol>}
        {editor && pins.length === 0 && <p className="jelly-editor-hint">Add pin blocks and choose a product for each.</p>}
      </div>
    </div>
  </StorefrontContainer></section>;
}

/* ── Featured product ─────────────────────────────────────────────────────────── */

export function FeaturedProductSection({ section, commerce, context }: { section: SectionNode; commerce: CommerceDataProvider; context: StorefrontRuntimeContext }) {
  const editor = context.mode === "editor";
  const products = useStoreProducts(commerce, true);
  const product = pickProduct(products, section.settings.productId, 0);
  if (!product) return editor ? <section className="jelly-section jelly-featured-product" {...sectionData(section)}><StorefrontContainer><p className="jelly-editor-hint">Add a product to your store to show it here.</p></StorefrontContainer></section> : null;
  const image = imageValue(section.settings);
  const photo = image?.url ?? product.imageUrl;
  const rating = ratingFor(product, commerce);
  const eyebrow = stringValue(section.settings, "eyebrow");
  const text = stringValue(section.settings, "text");
  const label = stringValue(section.settings, "buttonLabel", "View details");
  const position = section.settings.imagePosition === "right" ? "right" : "left";
  return <section className="jelly-section jelly-featured-product" {...sectionData(section, { "data-image-position": position })}><StorefrontContainer>
    <div className="jelly-featured-product-layout">
      <a className="jelly-featured-product-media" href={product.href} tabIndex={-1} aria-hidden="true" {...elementProps(section, "image", editor)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} {...mediaPhoto(photo, "(min-width: 900px) 50vw, 100vw")} alt="" loading="lazy" />}
        {product.compareAtPrice && <span className="jelly-featured-product-badge">{product.saving ?? "Sale"}</span>}
      </a>
      <div className="jelly-featured-product-copy">
        {eyebrow && <p className="jelly-eyebrow" {...elementProps(section, "eyebrow", editor)}>{eyebrow}</p>}
        {product.vendor && <p className="jelly-featured-product-vendor">{product.vendor}</p>}
        <h2><a href={product.href}>{product.name}</a></h2>
        {rating && <p className="jelly-featured-product-rating"><Stars value={rating.average} label={`${rating.average.toFixed(1)} out of 5 stars`} /> <span>{rating.count} {rating.count === 1 ? "review" : "reviews"}</span></p>}
        <Price product={product} />
        {text && <p className="jelly-featured-product-text" {...elementProps(section, "text", editor)}>{text}</p>}
        {product.swatches && product.swatches.length > 0 && <ul className="jelly-featured-product-swatches" aria-label="Colours">{product.swatches.slice(0, 6).map((swatch) => <li key={swatch.label} title={swatch.label} style={swatch.color ? { background: swatch.color } : undefined}><span className="jelly-visually-hidden">{swatch.label}</span></li>)}</ul>}
        <a className="jelly-button" href={product.href} {...elementProps(section, "button", editor)}>{label}</a>
      </div>
    </div>
  </StorefrontContainer></section>;
}

/* ── Rotating announcement ───────────────────────────────────────────────────── */

interface Message { id: string; text: string; href: string | null; block?: SectionNode["blocks"][number] }

export function announcementMessages(section: SectionNode, storeSlug?: string): Message[] {
  const blocks = visibleBlocks(section, "announcement-message").flatMap((block) => {
    const text = stringValue(block.settings, "text");
    const link = stringValue(block.settings, "link");
    return text ? [{ id: block.id, text, href: link ? resolveStorefrontHref(link, storeSlug) : null, block }] : [];
  });
  return blocks;
}

/** Two or more messages take turns; the shopper can pause them, and reduced motion never moves them on its own. */
export function RotatingAnnouncement({ section, messages, editor }: { section: SectionNode; messages: Message[]; editor: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const seconds = numberValue(section.settings, "rotateSeconds", 5, 3, 12);
  // Still on the server and until the browser says motion is fine.
  const still = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
  useEffect(() => {
    if (paused || still || editor || messages.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % messages.length), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [paused, still, editor, messages.length, seconds]);
  const current = messages[index % messages.length];
  const step = (by: number) => setIndex((value) => (value + by + messages.length) % messages.length);
  const props = current.block ? blockEditorData(current.block, editor, "Message") : {};
  return <aside className="jelly-announcement jelly-announcement--rotating" aria-label="Store news" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <button type="button" className="jelly-announcement-step" onClick={() => step(-1)} aria-label="Previous message">‹</button>
    <p className="jelly-announcement-message" aria-live={paused || still ? "polite" : "off"} key={current.id} {...props}>{current.href ? <a href={current.href}>{current.text}</a> : current.text}</p>
    <button type="button" className="jelly-announcement-step" onClick={() => step(1)} aria-label="Next message">›</button>
  </aside>;
}

/**
 * Every message in one slow line that scrolls sideways (announcement style "Scroll sideways"). The second copy keeps
 * the loop seamless and is hidden from screen readers; pointing at or focusing the line stops it, and reduced motion
 * shows the messages still, wrapped.
 */
export function MarqueeAnnouncement({ messages }: { messages: Message[] }) {
  const items = (copy: boolean) => messages.map((message) => <li key={message.id}>{message.href ? <a href={message.href} tabIndex={copy ? -1 : undefined}>{message.text}</a> : message.text}</li>);
  return <aside className="jelly-announcement jelly-announcement--marquee" aria-label="Store news" style={{ "--jelly-marquee-items": messages.length } as CSSProperties}>
    <div className="jelly-marquee">
      <ul className="jelly-marquee-track" role="list">{items(false)}</ul>
      <ul className="jelly-marquee-track" aria-hidden="true">{items(true)}</ul>
    </div>
  </aside>;
}

/* ── Reviews carousel ─────────────────────────────────────────────────────────── */

interface Review { id: string; block: SectionNode["blocks"][number]; quote: string; author: string; detail: string; rating: number; avatar?: string; verified?: boolean }

export function TestimonialCards({ reviews, mode, layout }: { reviews: Review[]; mode: RendererMode; layout: "grid" | "carousel" }) {
  const track = useRef<HTMLDivElement>(null);
  const slider = useSlider(track, reviews.length);
  const editor = mode === "editor";
  // Each card: stars, the quote, then the name with what they bought and an optional "Verified buyer" label, kept at
  // the foot so cards of different lengths line up.
  const cards = reviews.map((review) => <blockquote key={review.id} className="jelly-testimonial-card" {...blockEditorData(review.block, editor, "Testimonial")}>
    {review.rating > 0 && <Stars value={review.rating} label={`${review.rating} out of 5 stars`} />}
    <p {...blockElementProps(review.block, "quote", editor)}>{review.quote}</p>
    {(review.author || review.detail || review.verified) && <footer>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {review.avatar && <img src={review.avatar} {...mediaPhoto(review.avatar, "48px")} alt="" loading="lazy" />}
      <span>{review.author && <cite {...blockElementProps(review.block, "author", editor)}>{review.author}</cite>}{review.detail && <small>{review.detail}</small>}</span>
      {review.verified && <span className="jelly-testimonial-verified"><span aria-hidden="true">✓</span> Verified buyer</span>}
    </footer>}
  </blockquote>);
  if (layout === "grid") return <div className="jelly-testimonial-grid">{cards}</div>;
  return <div className="jelly-testimonial-carousel">
    <div className="jelly-testimonial-track" data-slider-track="" ref={track} role="region" aria-label="Customer reviews" tabIndex={0}>{cards}</div>
    <SliderControls slider={slider} label="Customer reviews" />
  </div>;
}

export function testimonialReviews(section: SectionNode): Review[] {
  return visibleBlocks(section, "testimonial").flatMap((block) => {
    const quote = stringValue(block.settings, "quote");
    if (!quote) return [];
    const avatar = imageValue(block.settings, "avatar");
    return [{ id: block.id, block, quote, author: stringValue(block.settings, "author"), detail: stringValue(block.settings, "detail"), rating: numberValue(block.settings, "rating", 0, 0, 5), avatar: avatar?.url, verified: block.settings.verified === true }];
  });
}
