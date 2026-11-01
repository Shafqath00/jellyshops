export interface LookupOption { id: string; label: string; imageUrl?: string }

/** The things a custom field can point at, loaded once per kind and store when an editor first needs them. */
export interface Lookups {
  products(storeId: string): Promise<LookupOption[]>;
  collections(storeId: string): Promise<LookupOption[]>;
  media(storeId: string): Promise<LookupOption[]>;
}

type Row = { id: string; title?: string; name?: string; originalName?: string; url?: string };

export function createLookups({ baseUrl, token, fetch: fetcher = fetch }: { baseUrl: string; token: string; fetch?: typeof fetch }): Lookups {
  const origin = baseUrl.replace(/\/$/, "");
  const cache = new Map<string, Promise<LookupOption[]>>();

  function load(kind: string, storeId: string, path: string, toOption: (row: Row) => LookupOption): Promise<LookupOption[]> {
    const key = `${kind}:${storeId}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const promise = fetcher(`${origin}/api/stores/${encodeURIComponent(storeId)}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the choices.");
        const body = await response.json() as Row[] | { nodes: Row[] };
        return (Array.isArray(body) ? body : body.nodes).map(toOption);
      })
      // A failed load can be tried again the next time the field is shown.
      .catch((error: unknown) => { cache.delete(key); throw error; });
    cache.set(key, promise);
    return promise;
  }
  const absolute = (url?: string) => url && url.startsWith("/") ? `${origin}${url}` : url;

  return {
    products: (storeId) => load("products", storeId, "/catalog/products?limit=100", (row) => ({ id: row.id, label: row.title ?? row.id })),
    collections: (storeId) => load("collections", storeId, "/catalog/collections?limit=100", (row) => ({ id: row.id, label: row.title ?? row.id })),
    media: (storeId) => load("media", storeId, "/media?limit=100", (row) => ({ id: row.id, label: row.originalName ?? row.id, imageUrl: absolute(row.url) })),
  };
}
