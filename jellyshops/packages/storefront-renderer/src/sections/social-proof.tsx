import type { CSSProperties } from "react";
import { elementProps } from "../element-style";
import type { SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { resolveStorefrontHref, type StorefrontRuntimeContext } from "../runtime-context";
import type { RendererMode } from "../types";
import { blockEditorData } from "./block-content";
import { choice, imageValue, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";

/** "4.8" for 4.8, "5" for 5: one decimal at most. */
function ratingText(value: number): string { return String(Math.round(value * 10) / 10); }

/** Five stars filled to the rating (to the nearest tenth). The text beside them carries the meaning. */
function Stars({ rating }: { rating: number }) {
  const percent = `${Math.round((rating / 5) * 1000) / 10}%`;
  const row = (className: string) => <span className={className} aria-hidden="true">{"★★★★★"}</span>;
  return <span className="jelly-rating-stars" style={{ "--jelly-rating-fill": percent } as CSSProperties}>{row("jelly-rating-stars-empty")}{row("jelly-rating-stars-full")}</span>;
}

/**
 * A star rating line ("4.8 out of 5 from 1,240 reviews") with an optional link to the reviews.
 * The numbers are typed by the merchant from their review service; nothing is invented, so with no
 * rating it stays hidden on the live store.
 */
/**
 * The rating to show when the section uses the store's reviews: the product's own on a product page, otherwise every
 * product's published reviews together (weighted by how many each has).
 */
export function storeReviewRating(ratings: Record<string, { average: number; count: number }> | undefined, productId?: string): { rating: number; count: number } {
  if (!ratings) return { rating: 0, count: 0 };
  const entries = productId ? [ratings[productId]].filter(Boolean) : Object.values(ratings);
  const count = entries.reduce((sum, entry) => sum + (entry && entry.count > 0 ? entry.count : 0), 0);
  if (!count) return { rating: 0, count: 0 };
  const total = entries.reduce((sum, entry) => sum + (entry && entry.count > 0 ? entry.average * entry.count : 0), 0);
  return { rating: Math.round((total / count) * 10) / 10, count };
}

export function RatingSummarySection({ section, context, mode = "published" }: { section: SectionNode; context?: StorefrontRuntimeContext; mode?: RendererMode }) {
  const settings = section.settings;
  const fromReviews = settings.source === "reviews";
  const productId = context?.page?.pageType === "product" ? context.page.resource.id : undefined;
  const live = fromReviews ? storeReviewRating(context?.commerce?.ratings, productId) : undefined;
  const rating = live ? live.rating : typeof settings.rating === "number" && Number.isFinite(settings.rating) ? Math.min(5, Math.max(0, settings.rating)) : 0;
  if (rating <= 0 && mode !== "editor") return null;
  const count = live ? live.count : numberValue(settings, "reviewCount", 0, 0, 10_000_000);
  const countText = count.toLocaleString("en-GB");
  const after = stringValue(settings, "text").trim();
  const afterText = count > 0 ? after.replaceAll("{count}", countText) : after.includes("{count}") ? "" : after;
  const heading = stringValue(settings, "heading").trim();
  const href = resolveStorefrontHref(settings.link, context?.storeSlug);
  const linkLabel = stringValue(settings, "linkLabel", "Read reviews").trim();
  const align = choice(settings, "contentAlignment", ["left", "center"] as const, "center");
  return <section className="jelly-section jelly-rating-summary" {...sectionData(section, { "data-align": align })}><StorefrontContainer>
    {heading && <h2 className="jelly-rating-summary-heading" {...elementProps(section, "heading", mode === "editor")}>{heading}</h2>}
    <p className="jelly-rating-line">
      <Stars rating={rating} />
      <strong>{ratingText(rating)} out of 5</strong>
      {afterText && <span>{afterText}</span>}
      {href && linkLabel && <a href={href}>{linkLabel}</a>}
    </p>
    {rating <= 0 && <p className="jelly-editor-hint">{fromReviews ? "Shows once your store has a published review." : "Type your average rating (from your review service) to show this on your live store."}</p>}
  </StorefrontContainer></section>;
}

/** Photos in a grid or a sideways-scrolling row, each with an optional caption and link. Hidden on the live store until it has a photo. */
export function ImageGallerySection({ section, context, mode = "published", selectedBlockId }: { section: SectionNode; context?: StorefrontRuntimeContext; mode?: RendererMode; selectedBlockId?: string }) {
  const editor = mode === "editor";
  const photos = visibleBlocks(section, "gallery-image").flatMap((block) => {
    const image = imageValue(block.settings);
    return image ? [{ block, image, caption: stringValue(block.settings, "caption").trim(), href: resolveStorefrontHref(block.settings.link, context?.storeSlug) }] : [];
  });
  if (!photos.length && !editor) return null;
  const heading = stringValue(section.settings, "heading").trim();
  const text = stringValue(section.settings, "text").trim();
  const layout = choice(section.settings, "layout", ["grid", "scroll"] as const, "grid");
  const columns = numberValue(section.settings, "columns", 4, 2, 6);
  const ratio = choice(section.settings, "ratio", ["square", "portrait", "landscape"] as const, "square");
  return <section className="jelly-section jelly-image-gallery" {...sectionData(section, { "data-layout": layout, "data-ratio": ratio })}><StorefrontContainer>
    {(heading || text) && <div className="jelly-image-gallery-intro">{heading && <h2 {...elementProps(section, "heading", editor)}>{heading}</h2>}{text && <p {...elementProps(section, "text", editor)}>{text}</p>}</div>}
    {photos.length
      ? <ul className="jelly-image-gallery-items" style={{ "--jelly-columns": columns } as CSSProperties} {...(layout === "scroll" ? { tabIndex: 0, "aria-label": heading || "Photos" } : {})}>{photos.map(({ block, image, caption, href }) => {
          // Merchant media URLs may be served by the local API and are not Next Image assets.
          // eslint-disable-next-line @next/next/no-img-element
          const content = <figure><img src={image.url} alt={image.alt || caption || ""} loading="lazy" decoding="async" />{caption && <figcaption>{caption}</figcaption>}</figure>;
          return <li key={block.id} {...blockEditorData(block, editor, "Photo", selectedBlockId)}>{href ? <a href={href}>{content}</a> : content}</li>;
        })}</ul>
      : <p className="jelly-editor-hint">Add photo blocks and upload your photos. This section stays hidden on your live store until you do.</p>}
  </StorefrontContainer></section>;
}
