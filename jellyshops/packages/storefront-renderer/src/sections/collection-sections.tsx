import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { elementProps } from "../element-style";
import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import type { CollectionPresentationContext, PublicProduct } from "../types";
import { choice } from "./shared";
import { normalizeRichTextDocument } from "@jelly/storefront-schema";
import { renderBlocks } from "./rich-text";

/** The merchant's formatted description when there is one, otherwise the plain text. */
function CollectionDescriptionText({ collection }: { collection: CollectionPresentationContext["collection"] }) {
  const document = collection.descriptionDoc ? normalizeRichTextDocument(collection.descriptionDoc) : null;
  if (document?.content.length) return <div className="jelly-rich-description">{renderBlocks(document.content)}</div>;
  return collection.description ? <p>{collection.description}</p> : null;
}

/**
 * A description cut to `lines` lines with a Read more / Read less button. The button only appears
 * when the text is actually longer than that, and the full text stays in the page for search engines.
 */
function ClampedText({ lines, children }: { lines: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setLong(element.scrollHeight > element.clientHeight + 1);
    measure();
    const view = element.ownerDocument.defaultView;
    if (!view || typeof view.ResizeObserver !== "function") return;
    const observer = new view.ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div className="jelly-clamped-text" data-open={open ? "true" : undefined}>
    <div ref={ref} id={id} className="jelly-clamped-text-body" style={open ? undefined : { "--jelly-clamp-lines": lines } as CSSProperties}>{children}</div>
    {(long || open) && <button type="button" className="jelly-read-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>{open ? "Read less" : "Read more"}</button>}
  </div>;
}

function collectionContext(context: StorefrontRuntimeContext): CollectionPresentationContext | null {
  if (context.page?.pageType !== "collection") return null;
  const data = context.page.resource.data;
  const presentation = data.collectionPresentation as CollectionPresentationContext | undefined;
  if (presentation?.collection && Array.isArray(presentation.products)) return presentation;

  // Existing V4 snapshots may still supply the original loose Collection context.
  const legacy = data.collection as { id?: string; name?: string; description?: string; imageUrl?: string } | undefined;
  if (!legacy || typeof legacy.name !== "string") return null;
  const products = Array.isArray(data.products) ? data.products as PublicProduct[] : [];
  return { collection: { id: legacy.id ?? context.page.resource.id, title: legacy.name, description: legacy.description ?? "", imageUrl: legacy.imageUrl }, products, totalProducts: products.length };
}

export function CollectionHeaderSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const presentation = collectionContext(context);
  if (!presentation) return null;
  const { collection } = presentation;
  const showImage = section.settings.showImage !== false && Boolean(collection.imageUrl);
  const layout = showImage ? choice(section.settings, "layout", ["simple", "banner"] as const, "simple") : "simple";
  const part = (id: string) => elementProps({ type: "collection-header", settings: section.settings }, id, context.mode === "editor");
  return <section className="jelly-section jelly-collection-header" data-layout={layout} data-align={choice(section.settings, "contentAlignment", ["left", "center"] as const, "left")}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {showImage && layout === "banner" && <img className="jelly-collection-header-media" src={collection.imageUrl} alt="" {...part("image")} />}
    <StorefrontContainer>
      <div className="jelly-collection-header-copy">
        {section.settings.showTitle !== false && <h1 {...part("title")}>{collection.title}</h1>}
        {section.settings.showDescription === true && (["2", "3", "4"].includes(String(section.settings.descriptionLines))
          ? <ClampedText lines={Number(section.settings.descriptionLines)}><CollectionDescriptionText collection={collection} /></ClampedText>
          : <CollectionDescriptionText collection={collection} />)}
        <p className="jelly-collection-count">{presentation.totalProducts === 1 ? "1 product" : `${presentation.totalProducts} products`}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {showImage && layout === "simple" && <img className="jelly-collection-header-image" src={collection.imageUrl} alt={collection.title} {...part("image")} />}
    </StorefrontContainer>
  </section>;
}

export function CollectionProductGridSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const presentation = collectionContext(context);
  if (!presentation) return null;
  if (presentation.interactiveGrid) return <section className="jelly-section jelly-collection-product-grid"><StorefrontContainer><h2 className="jelly-visually-hidden">Products</h2>{presentation.interactiveGrid}</StorefrontContainer></section>;
  const columns = typeof section.settings.columns === "number" && Number.isInteger(section.settings.columns) ? Math.max(2, Math.min(4, section.settings.columns)) : 3;
  const limit = typeof section.settings.limit === "number" && Number.isInteger(section.settings.limit) ? Math.max(1, Math.min(24, section.settings.limit)) : 12;
  const emptyMessage = typeof section.settings.emptyMessage === "string" ? section.settings.emptyMessage : "No products are available in this collection yet.";
  return <section className="jelly-section jelly-collection-product-grid"><StorefrontContainer><h2 className="jelly-visually-hidden">Products</h2>{presentation.products.length
    ? <div className="jelly-product-grid-items" data-testid="collection-product-grid-items" data-columns={columns} style={{ "--jelly-columns": columns } as CSSProperties}>{presentation.products.slice(0, limit).map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>
    : <p className="jelly-empty-state">{emptyMessage}</p>
  }</StorefrontContainer></section>;
}

export function CollectionDescriptionSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const collection = collectionContext(context)?.collection;
  if (!collection || (!collection.description && !collection.descriptionDoc)) return null;
  const spacing = ["compact", "standard", "spacious"].includes(String(section.settings.spacing)) ? String(section.settings.spacing) : "standard";
  return <section className="jelly-section jelly-collection-description" data-spacing={spacing}><StorefrontContainer><CollectionDescriptionText collection={collection} /></StorefrontContainer></section>;
}
