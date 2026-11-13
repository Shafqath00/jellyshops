import { useMemo, type CSSProperties } from "react";
import { ProductCard } from "../product-card";
import { blockElementProps, elementProps } from "../element-style";
import { inlineSetting } from "./setting-text";
import type { CatalogQuery, MediaReference, SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import type { RendererMode } from "../types";
import { choice, headingHidden, imageValue, numberValue, sectionData, visibleBlocks } from "./shared";
import { blockStyle } from "../block-style";
import { blockEditorData, buttonProps } from "./block-content";
import { ProductListBrowser } from "./product-list-browser";
import { filterNamesSetting } from "./collection-sections";
import { useWords } from "../words";

function stringSetting(settings: Record<string, unknown>, key: string, fallback = ""): string {
  const value = settings[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function imageSetting(settings: Record<string, unknown>): MediaReference | undefined {
  const image = settings.image;
  return image && typeof image === "object" && "url" in image ? image as MediaReference : undefined;
}

/** `editor` adds the data the editor preview needs to select a block when it is clicked. */
function copy(section: SectionNode, fallbackHeading: string, editor = false) {
  const visible = section.blocks.filter((block) => block.enabled);
  const heading = visible.find((block) => block.type === "heading");
  const body = visible.find((block) => block.type === "text");
  const button = visible.find((block) => block.type === "button");
  return {
    // Without a heading block the heading is the section's own "heading" setting (never its "text", which is the intro).
    heading: heading ? stringSetting(heading.settings, "text", stringSetting(section.settings, "heading", fallbackHeading)) : stringSetting(section.settings, "heading", fallbackHeading),
    /** The heading with its formatting (bold, italic, links, colour, size) when the heading block has it. */
    headingContent: heading ? inlineSetting(heading.settings, "text", stringSetting(heading.settings, "text", stringSetting(section.settings, "heading", fallbackHeading))) : stringSetting(section.settings, "heading", fallbackHeading),
    body: stringSetting(body?.settings ?? section.settings, "text", stringSetting(section.settings, "text")),
    button: stringSetting(button?.settings ?? section.settings, "label"),
    href: stringSetting(button?.settings ?? section.settings, "href", "/shop"),
    // Without a heading or text block the copy comes from section settings: then it is the section's own element.
    headingProps: heading ? { ...blockStyle(heading), ...blockEditorData(heading, editor, "Heading", undefined, "text") } : elementProps(section, "heading", editor),
    bodyProps: body ? { ...blockStyle(body), ...blockEditorData(body, editor, "Text", undefined, "text") } : elementProps(section, "text", editor),
    buttonProps: { ...buttonProps(button?.settings ?? {}, 0, button?.responsive?.mobile), ...(button ? blockEditorData(button, editor, "Button", undefined, "label") : {}) },
  };
}

function SectionIntro({ section, fallback, editor = false }: { section: SectionNode; fallback: string; editor?: boolean }) {
  const content = copy(section, fallback, editor);
  return <div className="jelly-section-intro">
    <h2 {...content.headingProps}>{content.headingContent}</h2>
    {content.body && <p {...content.bodyProps}>{content.body}</p>}
    {content.button && <a href={content.href} {...content.buttonProps}>{content.button}</a>}
  </div>;
}

export function CategoryGridSection({ section, context }: { section: SectionNode; context?: StorefrontRuntimeContext }) {
  const shopHref = context?.storeSlug ? `/${context.storeSlug}/shop` : "#shop";
  const cards = visibleBlocks(section, "collection-card").flatMap((block) => {
    const label = stringSetting(block.settings, "label");
    return label ? [{ id: block.id, block, label, image: imageValue(block.settings), href: resolveStorefrontHref(block.settings.link, context?.storeSlug) ?? shopHref }] : [];
  });
  // Until the merchant adds collection cards, show neutral placeholders that link to the shop.
  const items = cards.length ? cards : ["New arrivals", "Best sellers", "For the home", "Gifts"].map((label) => ({ id: label, block: undefined, label, image: undefined, href: shopHref }));
  const editor = context?.mode === "editor";
  const columns = numberValue(section.settings, "columns", 4, 2, 4);
  // Grid, Bento (first collection large) or Carousel (scrolls sideways; focusable so keyboards can scroll it).
  const layout = choice(section.settings, "layout", ["grid", "bento", "carousel"] as const, "grid");
  return <section className="jelly-section jelly-category-grid" {...sectionData(section, { "data-image-ratio": choice(section.settings, "imageRatio", ["portrait", "square"] as const, "portrait"), "data-layout": layout })}><StorefrontContainer>
    {!headingHidden(section) && <SectionIntro section={section} fallback="Shop by collection" editor={context?.mode === "editor"} />}
    <div className="jelly-category-grid-items" style={{ "--jelly-columns": columns } as CSSProperties} {...(layout === "carousel" ? { role: "region", "aria-label": "Collections", tabIndex: 0 } : {})}>{items.map((item) => <a href={item.href} className="jelly-category-card" key={item.id} {...(item.block ? blockEditorData(item.block, editor, "Collection card") : {})}>
      <span className="jelly-category-card-media" {...(item.block ? blockElementProps(item.block, "image", editor) : {})}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.image ? <img src={item.image.url} alt="" loading="lazy" /> : null}
      </span>
      <strong {...(item.block ? blockElementProps(item.block, "label", editor) : {})}>{item.label}</strong>
    </a>)}</div>
  </StorefrontContainer></section>;
}

export function TestimonialsSection({ section, mode = "published" }: { section: SectionNode; mode?: RendererMode }) {
  const reviews = visibleBlocks(section, "testimonial").flatMap((block) => {
    const quote = stringSetting(block.settings, "quote");
    return quote ? [{ id: block.id, block, quote, author: stringSetting(block.settings, "author") }] : [];
  });
  // Never invent reviews: with no testimonials the section only shows an editing hint outside the live store.
  if (!reviews.length && mode === "published") return null;
  return <section className="jelly-section jelly-testimonials" {...sectionData(section)}><StorefrontContainer>
    <SectionIntro section={section} fallback="What customers say" editor={mode === "editor"} />
    {reviews.length
      ? <div className="jelly-testimonial-grid">{reviews.map((review) => <blockquote key={review.id} {...blockEditorData(review.block, mode === "editor", "Testimonial")}><p {...blockElementProps(review.block, "quote", mode === "editor")}>{review.quote}</p>{review.author && <cite {...blockElementProps(review.block, "author", mode === "editor")}>{review.author}</cite>}</blockquote>)}</div>
      : <p className="jelly-editor-hint">Add a testimonial block with a real customer quote. This section stays hidden on your live store until you do.</p>}
  </StorefrontContainer></section>;
}

export { TrustStripSection } from "./trust-points";

export function ImageMosaicSection({ section }: { section: SectionNode }) {
  const image = imageSetting(section.settings);
  const content = copy(section, "A closer look");
  const imageStyle: CSSProperties | undefined = image ? { backgroundImage: `url(${image.url})` } : undefined;
  return <section className="jelly-section jelly-image-mosaic"><StorefrontContainer><div className="jelly-image-mosaic-grid">
    <div className="jelly-mosaic-panel jelly-mosaic-copy"><h2 {...content.headingProps}>{content.headingContent}</h2>{content.body && <p {...content.bodyProps}>{content.body}</p>}{content.button && <a href={content.href} {...content.buttonProps}>{content.button}</a>}</div>
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
  const word = useWords();
  const content = copy(section, word("cart.title"), context.mode === "editor");
  const data = context?.page?.pageType === "cart" ? context.page.data ?? {} : {};
  const lines = Array.isArray(data.lines) ? data.lines as CartLineView[] : [];
  const subtotal = typeof data.subtotal === "string" ? data.subtotal : undefined;
  const checkoutHref = typeof data.checkoutHref === "string" ? data.checkoutHref : undefined;
  const shopHref = typeof data.shopHref === "string" ? data.shopHref : resolveStorefrontHref(content.href, context?.storeSlug) ?? "#";
  const shippingNote = typeof data.shippingNote === "string" ? data.shippingNote : word("cart.shippingNote");
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  // The bag is saved in the shopper's browser: the server-drawn page shows this until it is read.
  if (data.pending === true) return <section className="jelly-section jelly-cart-summary" data-pending="true"><StorefrontContainer><div className="jelly-cart-empty">
    <h1 {...content.headingProps}>{content.headingContent}</h1>
    <p role="status">{word("cart.loading")}</p>
  </div></StorefrontContainer></section>;
  if (!lines.length) return <section className="jelly-section jelly-cart-summary" data-empty="true"><StorefrontContainer><div className="jelly-cart-empty">
    <h1 {...content.headingProps}>{content.headingContent}</h1>
    <p {...content.bodyProps}>{content.body || "Your bag is empty. Find something you love and it will appear here."}</p>
    <a className="jelly-button" href={shopHref}>{word("cart.continue")}</a>
  </div></StorefrontContainer></section>;
  return <section className="jelly-section jelly-cart-summary"><StorefrontContainer>
    <header className="jelly-cart-header"><h1 {...content.headingProps}>{content.headingContent}</h1><p>{count === 1 ? "1 item" : `${count} items`}</p></header>
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
            {line.onRemove && <button type="button" className="jelly-button jelly-button--link" onClick={line.onRemove}>{word("cart.remove")}</button>}
          </div>
        </div>
        <strong className="jelly-cart-line-total">{line.total}</strong>
      </li>)}</ul>
      <aside className="jelly-cart-totals" aria-label={word("cart.summary")}>
        <h2>{word("cart.summary")}</h2>
        <dl><div><dt>{word("cart.subtotal")}</dt><dd>{subtotal}</dd></div></dl>
        <p>{shippingNote}</p>
        {checkoutHref && <a className="jelly-button" href={checkoutHref}>{word("cart.checkout")}</a>}
        <a className="jelly-button jelly-button--link" href={shopHref}>{word("cart.continue")}</a>
      </aside>
    </div>
  </StorefrontContainer></section>;
}

export function SearchResultsSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const word = useWords();
  const search = context.page?.pageType === "search" ? context.page.data : null;
  const content = copy(section, word("search.title"), context.mode === "editor");
  const query = search?.query ?? "";
  const results = search?.results ?? [];
  // On the live store the backend sorts, filters and pages the matches (the same browse as collection pages, with the words).
  const browse = context.mode === "published" ? context.commerce?.browseProducts : undefined;
  const remote = useMemo(() => browse && query.trim() ? (list: CatalogQuery) => browse({ ...list, query }) : undefined, [browse, query]);
  const action = search?.searchHref ?? (context.storeSlug ? `/${context.storeSlug}/search` : "/search");
  return <section className="jelly-section jelly-search-results"><StorefrontContainer><div className="jelly-search-shell">
    <h1 {...content.headingProps}>{content.headingContent}</h1>
    {content.body && <p {...content.bodyProps}>{content.body}</p>}
    <form action={action} role="search"><label htmlFor="storefront-search">{word("search.label")}</label><div><input id="storefront-search" type="search" name="q" defaultValue={query} placeholder={word("search.placeholder")} /><button type="submit">{word("search.button")}</button></div></form>
    {search?.state === "empty" && <p className="jelly-search-status">{word("search.enterWords")}</p>}
    {search?.state === "none" && <p className="jelly-search-status">{word("search.noResults", { query })}</p>}
    {search?.state === "results" && <p className="jelly-search-status">{search.resultCount === 1 ? word("search.oneResult", { query }) : word("search.results", { count: search.resultCount, query })}</p>}
    {search?.state === "results" && <h2 className="jelly-visually-hidden">{word("search.heading")}</h2>}
    {search?.state === "results" && (section.settings.showSort === true || section.settings.showFilters === true
      ? <ProductListBrowser products={results} columns={numberValue(section.settings, "columns", 4, 2, 4)} pageSize={24} showSort={section.settings.showSort !== false} showFilters={section.settings.showFilters !== false} filterNames={filterNamesSetting(section.settings.filterNames)} emptyMessage={word("search.noMatch")} remote={remote} address={context.mode === "published" ? context.commerce?.listAddress : undefined} />
      : <div className="jelly-product-grid-items">{results.map((product) => <ProductCard key={product.id} product={product} />)}</div>)}
  </div></StorefrontContainer></section>;
}

export function NotFoundMessageSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const word = useWords();
  const content = copy(section, word("notFound.heading"), context.mode === "editor");
  const href = resolveStorefrontHref(content.href, context.storeSlug);
  return <section className="jelly-section jelly-not-found"><StorefrontContainer><div><p className="jelly-eyebrow">404</p><h1 {...content.headingProps}>{content.headingContent}</h1><p {...content.bodyProps}>{content.body || word("notFound.body")}</p>{href && <a className="jelly-button" href={href}>{content.button || word("notFound.back")}</a>}</div></StorefrontContainer></section>;
}
