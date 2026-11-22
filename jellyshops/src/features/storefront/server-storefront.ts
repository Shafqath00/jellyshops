import { cache } from "react";
import { migrateStorefrontDocument, runtimeStorefrontSnapshotV4Schema } from "@jelly/storefront-schema";
import { catalogProductToStorefrontProduct, type PublicCatalogResponse, type PublicStoreDetails } from "@/features/commerce/api/client";
import type { Collection, Product, Store } from "@/lib/domain";
import type { PublicStorefrontPublication } from "./public-storefront-api";
import type { NavigationResource } from "@/features/navigation/resource-links";
import { resolveMediaUrls } from "@/lib/media-urls";
import { STOREFRONT_CACHE_SECONDS, storeCacheTag, storefrontCacheTag, storefrontFetchInit } from "./storefront-cache";

export interface StorefrontBootstrapData { store: Store; products: Product[]; collections: Collection[]; publication: PublicStorefrontPublication; /** Published pages, blogs and articles menus can link to; null when they could not be read. */ navigation?: NavigationResource[] | null }
const origin = (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
export { STOREFRONT_CACHE_SECONDS, storefrontCacheTag };

export async function loadServerStorefront(slug: string, fetcher: typeof fetch = fetch): Promise<StorefrontBootstrapData | null> {
  // Every read is cached on the server under the store tags, so a merchant change can refresh all of this store at once.
  let tags = [storefrontCacheTag(slug)];
  async function read<T>(path: string): Promise<T | null> {
    const response = await fetcher(`${origin}${path}`, { ...storefrontFetchInit(tags, undefined, "server"), headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("The storefront service is temporarily unavailable.");
    return resolveMediaUrls(await response.json() as T, origin);
  }
  const details = await read<{ store: PublicStoreDetails }>(`/api/public/storefronts/${encodeURIComponent(slug)}`);
  if (!details) return null;
  const id = details.store.id;
  tags = [storefrontCacheTag(slug), storeCacheTag(id)];
  // The design, the products and the collections only need the store id: fetch them side by side, not one after another.
  async function loadPublished() {
    return read<{ id: string; document: unknown }>(`/api/stores/${encodeURIComponent(id)}/storefront/public`);
  }
  async function loadProducts(): Promise<Product[]> {
    const products: Product[] = []; const visited = new Set<string>(); let cursor: string | null = null;
    do {
      const page: PublicCatalogResponse | null = await read(`/api/public/stores/${encodeURIComponent(id)}/catalog/products?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (!page) throw new Error("The storefront catalog is unavailable.");
      products.push(...page.nodes.map(catalogProductToStorefrontProduct));
      cursor = page.nextCursor;
      if (cursor && visited.has(cursor)) throw new Error("The storefront catalog returned an invalid cursor.");
      if (cursor) visited.add(cursor);
    } while (cursor);
    return products;
  }
  type CollectionNode = { id: string; title: string; handle: string; description: string; descriptionDoc?: Collection["descriptionDoc"] };
  async function loadCollections(): Promise<CollectionNode[]> {
    const collections: CollectionNode[] = [];
    const collectionCursors = new Set<string>(); let collectionCursor: string | null = null;
    do {
      const page: { nodes: CollectionNode[]; nextCursor: string | null } | null = await read(`/api/public/stores/${encodeURIComponent(id)}/catalog/collections?limit=100${collectionCursor ? `&cursor=${encodeURIComponent(collectionCursor)}` : ""}`);
      if (!page) throw new Error("The storefront collections are unavailable.");
      collections.push(...page.nodes); collectionCursor = page.nextCursor;
      if (collectionCursor && collectionCursors.has(collectionCursor)) throw new Error("The storefront collections returned an invalid cursor.");
      if (collectionCursor) collectionCursors.add(collectionCursor);
    } while (collectionCursor);
    return collections;
  }
  // Menu destinations (pages, blogs, articles) come with the page, so menus are complete in the first HTML. A failure here
  // only leaves those links for the browser to look up.
  async function loadNavigation(): Promise<NavigationResource[] | null> {
    try { return (await read<{ resources: NavigationResource[] }>(`/api/public/stores/${encodeURIComponent(id)}/storefront/context/navigation`))?.resources ?? null; } catch { return null; }
  }
  const [published, products, collections, navigation] = await Promise.all([loadPublished(), loadProducts(), loadCollections(), loadNavigation()]);
  if (!published) return null;
  const v4 = runtimeStorefrontSnapshotV4Schema.safeParse(published.document);
  let publication: PublicStorefrontPublication;
  if (v4.success && v4.data.storeId === id) publication = { kind: "v4", publicationId: published.id, snapshot: v4.data };
  else {
    const document = migrateStorefrontDocument(published.document, id);
    if (document.storeId !== id) throw new Error("Invalid storefront publication.");
    publication = { kind: "v3", publicationId: published.id, document };
  }
  for (const product of products) {
    if (product.imageUrl.startsWith("/")) product.imageUrl = `${origin}${product.imageUrl}`;
    for (const media of product.media ?? []) if (media.url.startsWith("/")) media.url = `${origin}${media.url}`;
  }
  const store: Store = { id, businessId: id, name: details.store.name, slug: details.store.slug, country: details.store.country, tagline: details.store.name, description: `Welcome to ${details.store.name}.`, currency: details.store.currency as Store["currency"], published: true, bannerUrl: products[0]?.imageUrl ?? "", shippingMinor: details.store.shippingMinor ?? 0, shippingCopy: details.store.shippingCopy ?? "", theme: { accent: "#172a1b", accentSoft: "#e8f3d6", background: "#fffdf8", surface: "#ffffff", text: "#172a1b", displayFont: "serif" } };
  return { store, products, collections: collections.map((collection) => ({ id: collection.id, storeId: id, name: collection.title, slug: collection.handle, description: collection.description, ...(collection.descriptionDoc ? { descriptionDoc: collection.descriptionDoc } : {}) })), publication, navigation };
}
// Request-scoped deduplication on top of the 30-second data cache. Published HTML/data never fall back to drafts.
export const getServerStorefront = cache((slug: string) => loadServerStorefront(slug));
