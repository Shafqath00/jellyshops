import type { CSSProperties } from "react";
import type { MediaReference, SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";

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

export function CategoryGridSection({ section }: { section: SectionNode }) {
  const labels = section.blocks.filter((block) => block.enabled).map((block) => stringSetting(block.settings, "text")).filter(Boolean);
  const categories = labels.length ? labels : ["Fresh produce", "Pantry essentials", "Good-for-you snacks", "Seasonal favourites"];
  return <section className="jelly-section jelly-category-grid"><StorefrontContainer>
    <SectionIntro section={section} fallback="Shop by category" />
    <div className="jelly-category-grid-items">{categories.slice(0, 4).map((label, index) => <a href="/shop" className="jelly-category-card" key={label}>
      <span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><small>Explore collection</small>
    </a>)}</div>
  </StorefrontContainer></section>;
}

export function TestimonialsSection({ section }: { section: SectionNode }) {
  const reviews = section.blocks.filter((block) => block.enabled).map((block) => stringSetting(block.settings, "text")).filter(Boolean);
  const content = copy(section, "Loved by regulars");
  const messages = reviews.length ? reviews : ["Beautifully made, thoughtfully packed, and a joy to receive.", "The small details feel so personal. I come back every season.", "A genuinely lovely shopping experience from start to finish."];
  return <section className="jelly-section jelly-testimonials"><StorefrontContainer><SectionIntro section={section} fallback="Loved by regulars" />
    <div className="jelly-testimonial-grid">{messages.slice(0, 3).map((message, index) => <blockquote key={message}><p>“{message}”</p><cite>{["Maya R.", "Jordan L.", "Casey T."][index]}</cite></blockquote>)}</div>
    {content.button && <a className="jelly-text-link" href={content.href}>{content.button} →</a>}
  </StorefrontContainer></section>;
}

export function TrustStripSection({ section }: { section: SectionNode }) {
  const promises = section.blocks.filter((block) => block.enabled).map((block) => stringSetting(block.settings, "text")).filter(Boolean);
  const items = promises.length ? promises : ["Thoughtfully sourced", "Secure checkout", "Made with care"];
  return <section className="jelly-trust-strip"><StorefrontContainer><div>{items.slice(0, 4).map((item, index) => <p key={item}><span aria-hidden="true">{["✦", "◌", "✚", "↗"][index]}</span>{item}</p>)}</div></StorefrontContainer></section>;
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

export function JournalTeaserSection({ section }: { section: SectionNode }) {
  const content = copy(section, "From the journal");
  return <section className="jelly-section jelly-journal"><StorefrontContainer><SectionIntro section={section} fallback="From the journal" />
    <div className="jelly-journal-grid">{["The ritual of everyday objects", "A guide to thoughtful gifting", "Notes from our makers"].map((title, index) => <article key={title}><span>Journal · 0{index + 1}</span><h3>{title}</h3><a href="/shop">Read story →</a></article>)}</div>
  </StorefrontContainer></section>;
}

export function CartSummarySection({ section }: { section: SectionNode }) {
  const content = copy(section, "Your bag");
  return <section className="jelly-section jelly-cart-summary"><StorefrontContainer><div className="jelly-cart-card"><div><h1>{content.heading}</h1><p>{content.body || "Your selected pieces will appear here when you add them to your bag."}</p></div><a className="jelly-button" href={content.href}>Continue shopping</a></div></StorefrontContainer></section>;
}

export function SearchResultsSection({ section }: { section: SectionNode }) {
  const content = copy(section, "Search the shop");
  return <section className="jelly-section jelly-search-results"><StorefrontContainer><div className="jelly-search-shell"><h1>{content.heading}</h1><p>{content.body || "Find a product, collection, or story."}</p><form action="/shop"><label htmlFor="storefront-search">Search catalog</label><div><input id="storefront-search" name="q" placeholder="What are you looking for?" /><button type="submit">Search</button></div></form></div></StorefrontContainer></section>;
}

export function NotFoundMessageSection({ section }: { section: SectionNode }) {
  const content = copy(section, "We couldn't find that page");
  return <section className="jelly-section jelly-not-found"><StorefrontContainer><div><p className="jelly-eyebrow">404</p><h1>{content.heading}</h1><p>{content.body || "The page may have moved, but there is plenty more to discover."}</p><a className="jelly-button" href={content.href}>{content.button || "Back to the shop"}</a></div></StorefrontContainer></section>;
}
