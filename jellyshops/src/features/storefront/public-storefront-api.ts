import { migrateStorefrontDocument, type StorefrontDocument } from "@jelly/storefront-schema";

interface LoadOptions {
  baseUrl: string;
  storeId: string;
  fallback: StorefrontDocument;
  fetch?: typeof fetch;
}

export async function loadPublicStorefrontDocument({ baseUrl, storeId, fallback, fetch: fetcher = fetch }: LoadOptions): Promise<StorefrontDocument> {
  try {
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/api/stores/${encodeURIComponent(storeId)}/storefront/public`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return fallback;
    const body = await response.json() as { document?: unknown };
    return migrateStorefrontDocument(
      body.document,
      storeId,
    );
  } catch {
    return fallback;
  }
}
