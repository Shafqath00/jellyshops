import { cache } from "react";
import { migrateStorefrontDocument, runtimeStorefrontSnapshotV4Schema } from "@jelly/storefront-schema";
import { catalogProductToStorefrontProduct, type PublicCatalogResponse, type PublicStoreDetails } from "@/features/commerce/api/client";
import type { Collection, Product, Store } from "@/lib/domain";
import type { PublicStorefrontPublication } from "./public-storefront-api";

export interface StorefrontBootstrapData { store: Store; products: Product[]; collections: Collection[]; publication: PublicStorefrontPublication }
const origin = (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
export async function loadServerStorefront(slug: string, fetcher: typeof fetch = fetch): Promise<StorefrontBootstrapData | null> {
  async function read<T>(path: string): Promise<T | null> {
    const response = await fetcher(`${origin}${path}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("The storefront service is temporarily unavailable.");
    return response.json() as Promise<T>;
  }
  const details = await read<{ store: PublicStoreDetails }>(`/api/public/storefronts/${encodeURIComponent(slug)}`);
  if (!details) return null;
  const id = details.store.id;
  const published = await read<{ id: string; document: unknown }>(`/api/stores/${encodeURIComponent(id)}/storefront/public`);
  if (!published) return null;
  const v4 = runtimeStorefrontSnapshotV4Schema.safeParse(published.document);
  let publication: PublicStorefrontPublication;
  if (v4.success && v4.data.storeId === id) publication = { kind: "v4", publicationId: published.id, snapshot: v4.data };
  else {
    const document = migrateStorefrontDocument(published.document, id);
    if (document.storeId !== id) throw new Error("Invalid storefront publication.");
    publication = { kind: "v3", publicationId: published.id, document };
  }
  const products: Product[] = []; const visited = new Set<string>(); let cursor: string | null = null;
  do {
    const page: PublicCatalogResponse | null = await read(`/api/public/stores/${encodeURIComponent(id)}/catalog/products?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    if (!page) throw new Error("The storefront catalog is unavailable.");
    products.push(...page.nodes.map(catalogProductToStorefrontProduct));
    cursor = page.nextCursor;
    if (cursor && visited.has(cursor)) throw new Error("The storefront catalog returned an invalid cursor.");
    if (cursor) visited.add(cursor);
  } while (cursor);
  for (const product of products) {
    if (product.imageUrl.startsWith("/")) product.imageUrl = `${origin}${product.imageUrl}`;
    for (const media of product.media ?? []) if (media.url.startsWith("/")) media.url = `${origin}${media.url}`;
  }
  const collections: Array<{ id: string; title: string; handle: string; description: string }> = [];
  const collectionCursors = new Set<string>(); let collectionCursor: string | null = null;
  do {
    const page: { nodes: Array<{ id: string; title: string; handle: string; description: string }>; nextCursor: string | null } | null = await read(`/api/public/stores/${encodeURIComponent(id)}/catalog/collections?limit=100${collectionCursor ? `&cursor=${encodeURIComponent(collectionCursor)}` : ""}`);
    if (!page) throw new Error("The storefront collections are unavailable.");
    collections.push(...page.nodes); collectionCursor = page.nextCursor;
    if (collectionCursor && collectionCursors.has(collectionCursor)) throw new Error("The storefront collections returned an invalid cursor.");
    if (collectionCursor) collectionCursors.add(collectionCursor);
  } while (collectionCursor);
  const store: Store = { id, businessId: id, name: details.store.name, slug: details.store.slug, country: details.store.country, tagline: details.store.name, description: `Welcome to ${details.store.name}.`, currency: details.store.currency as Store["currency"], published: true, bannerUrl: products[0]?.imageUrl ?? "", shippingMinor: details.store.shippingMinor ?? 0, shippingCopy: details.store.shippingCopy ?? "", theme: { accent: "#172a1b", accentSoft: "#e8f3d6", background: "#fffdf8", surface: "#ffffff", text: "#172a1b", displayFont: "serif" } };
  return { store, products, collections: collections.map((collection) => ({ id: collection.id, storeId: id, name: collection.title, slug: collection.handle, description: collection.description })), publication };
}
// Request-scoped deduplication only. Published HTML/data never fall back to drafts.
export const getServerStorefront = cache((slug: string) => loadServerStorefront(slug));
