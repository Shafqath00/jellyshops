export interface MetafieldDefinition {
  id: string;
  ownerType: "product" | "variant" | "store" | "collection" | "page" | "blog" | "article";
  namespace: string;
  key: string;
  name: string;
  description?: string | null;
  type: string;
  validations?: Record<string, unknown> | null;
  storefrontVisible: boolean;
  archivedAt?: string | null;
}

export interface OwnerValue { ownerId: string; definitionId: string; value: unknown }
export interface NewDefinition { ownerType: "product" | "variant"; namespace: string; key: string; name: string; description?: string; type: string; validations?: Record<string, unknown>; storefrontVisible: boolean }
export interface IssueByField { [definitionId: string]: string }

export class MetafieldApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string, public readonly issues: IssueByField = {}) { super(message); }
}

export interface MetafieldsApi {
  listDefinitions(storeId: string, ownerType: "product" | "variant"): Promise<MetafieldDefinition[]>;
  listValues(storeId: string, ownerType: "product" | "variant", ownerIds: string[]): Promise<OwnerValue[]>;
  saveValues(storeId: string, ownerType: "product" | "variant", ownerId: string, values: Record<string, unknown>): Promise<{ saved: number; cleared: number }>;
  createDefinition(storeId: string, input: NewDefinition): Promise<MetafieldDefinition>;
}

/** The custom data endpoints the product editor uses. Errors carry the server's message and any per-field reasons. */
export function createMetafieldsApi({ baseUrl, token, fetch: fetcher = fetch }: { baseUrl: string; token: string; fetch?: typeof fetch }): MetafieldsApi {
  const origin = baseUrl.replace(/\/$/, "");
  const path = (storeId: string, rest: string) => `${origin}/api/stores/${encodeURIComponent(storeId)}/custom-data${rest}`;

  async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetcher(url, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers } });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string; code?: string; issues?: Array<{ path: string; message: string }> } } | null;
      const issues: IssueByField = {};
      for (const issue of body?.error?.issues ?? []) issues[issue.path] = issue.message;
      throw new MetafieldApiError(body?.error?.message ?? "Custom data could not be reached.", response.status, body?.error?.code, issues);
    }
    return await response.json() as T;
  }

  return {
    listDefinitions: (storeId, ownerType) => request<MetafieldDefinition[]>(path(storeId, `/metafields?ownerType=${ownerType}`)),
    listValues: async (storeId, ownerType, ownerIds) => ownerIds.length === 0 ? [] : (await request<{ values: OwnerValue[] }>(path(storeId, `/metafield-values?ownerType=${ownerType}&ownerIds=${ownerIds.map(encodeURIComponent).join(",")}`))).values,
    saveValues: (storeId, ownerType, ownerId, values) => request(path(storeId, "/metafield-values"), { method: "PUT", body: JSON.stringify({ ownerType, ownerId, values }) }),
    createDefinition: (storeId, input) => request<MetafieldDefinition>(path(storeId, "/metafields"), { method: "POST", body: JSON.stringify({ ...input, origin: "jelly" }) }),
  };
}
