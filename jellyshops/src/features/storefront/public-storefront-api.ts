import {
  migrateStorefrontDocument,
  runtimeStorefrontSnapshotV4Schema,
  type RuntimeStorefrontSnapshotV4,
  type StorefrontDocument,
} from "@jelly/storefront-schema";

interface LoadOptions {
  baseUrl: string;
  storeId: string;
  fallback: StorefrontDocument;
  fetch?: typeof fetch;
}

interface PublicationLoadOptions {
  baseUrl: string;
  storeId: string;
  fetch?: typeof fetch;
}

export type PublicStorefrontPublication =
  | {
      kind: "v3";
      publicationId: string;
      document: StorefrontDocument;
    }
  | {
      kind: "v4";
      publicationId: string;
      snapshot: RuntimeStorefrontSnapshotV4;
    };

function endpoint(baseUrl: string, storeId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/stores/${encodeURIComponent(storeId)}/storefront/public`;
}

export async function loadPublicStorefrontPublication({
  baseUrl,
  storeId,
  fetch: fetcher = fetch,
}: PublicationLoadOptions): Promise<PublicStorefrontPublication | null> {
  try {
    const response = await fetcher(endpoint(baseUrl, storeId), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    const body = await response.json() as { id?: unknown; document?: unknown };
    if (typeof body.id !== "string") return null;

    const v4 = runtimeStorefrontSnapshotV4Schema.safeParse(body.document);
    if (v4.success && v4.data.storeId === storeId) {
      return { kind: "v4", publicationId: body.id, snapshot: v4.data };
    }

    try {
      const document = migrateStorefrontDocument(body.document, storeId);
      if (document.storeId !== storeId) return null;
      return { kind: "v3", publicationId: body.id, document };
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export async function loadPublicStorefrontDocument({ baseUrl, storeId, fallback, fetch: fetcher = fetch }: LoadOptions): Promise<StorefrontDocument> {
  const publication = await loadPublicStorefrontPublication({ baseUrl, storeId, fetch: fetcher });
  return publication?.kind === "v3" ? publication.document : fallback;
}
