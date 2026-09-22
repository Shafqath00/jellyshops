import { StorefrontContainer, StorefrontProductCard } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import type { CollectionPresentationContext, PublicProduct } from "../types";

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
  return <section className="jelly-section jelly-collection-header"><StorefrontContainer>
    {section.settings.showImage !== false && collection.imageUrl && <img src={collection.imageUrl} alt={collection.title} />}
    {section.settings.showTitle !== false && <h1>{collection.title}</h1>}
    {section.settings.showDescription === true && collection.description && <p>{collection.description}</p>}
  </StorefrontContainer></section>;
}

export function CollectionProductGridSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const presentation = collectionContext(context);
  if (!presentation) return null;
  const columns = typeof section.settings.columns === "number" && Number.isInteger(section.settings.columns) ? Math.max(2, Math.min(4, section.settings.columns)) : 3;
  const limit = typeof section.settings.limit === "number" && Number.isInteger(section.settings.limit) ? Math.max(1, Math.min(24, section.settings.limit)) : 12;
  const emptyMessage = typeof section.settings.emptyMessage === "string" ? section.settings.emptyMessage : "No products are available in this collection yet.";
  return <section className="jelly-section jelly-collection-product-grid"><StorefrontContainer>{presentation.products.length
    ? <div className="jelly-product-grid-items" data-testid="collection-product-grid-items" data-columns={columns} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{presentation.products.slice(0, limit).map((product) => <StorefrontProductCard key={product.id} product={product} />)}</div>
    : <p>{emptyMessage}</p>
  }</StorefrontContainer></section>;
}

export function CollectionDescriptionSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const description = collectionContext(context)?.collection.description;
  if (!description) return null;
  const spacing = ["compact", "standard", "spacious"].includes(String(section.settings.spacing)) ? String(section.settings.spacing) : "standard";
  return <section className="jelly-section jelly-collection-description" data-spacing={spacing}><StorefrontContainer><p>{description}</p></StorefrontContainer></section>;
}
