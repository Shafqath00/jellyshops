import type { StorefrontDocument } from "@jelly/storefront-schema";
import { StoreEditorApiError, type DemoCatalog, type DraftRecord, type MediaRecord, type PublicationRecord } from "./types";

export interface StoreEditorApi {
  loadDraft(storeId: string): Promise<DraftRecord>;
  saveDraft(storeId: string, expectedRevision: number, document: StorefrontDocument): Promise<DraftRecord>;
  publish(storeId: string, expectedRevision: number): Promise<PublicationRecord>;
  getPublic(storeId: string): Promise<PublicationRecord>;
  listCatalog(): Promise<DemoCatalog>;
  uploadMedia(storeId: string, file: File, onProgress?: (percent: number) => void): Promise<MediaRecord>;
  deleteMedia(storeId: string, mediaId: string): Promise<void>;
}

interface ClientOptions { baseUrl: string; token: string; fetch?: typeof fetch }

export function createStoreEditorApi({ baseUrl, token, fetch: fetcher = fetch }: ClientOptions): StoreEditorApi {
  const origin = baseUrl.replace(/\/$/, "");
  const url = (path: string) => `${origin}${path}`;
  const request = async <T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> => {
    const response = await fetcher(url(path), {
      ...init,
      headers: {
        ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string; issues?: never[]; currentRevision?: number } };
      throw new StoreEditorApiError(response.status, body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? "Request failed", body.error?.issues, body.error?.currentRevision);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  };

  return {
    loadDraft: (storeId) => request(`/api/stores/${storeId}/storefront/draft`),
    saveDraft: (storeId, expectedRevision, document) => request(`/api/stores/${storeId}/storefront/draft`, { method: "PUT", body: JSON.stringify({ expectedRevision, document }) }),
    publish: (storeId, expectedRevision) => request(`/api/stores/${storeId}/storefront/publish`, { method: "POST", body: JSON.stringify({ expectedRevision }) }),
    getPublic: (storeId) => request(`/api/stores/${storeId}/storefront/public`, {}, false),
    listCatalog: () => request("/api/demo/catalog", {}, false),
    uploadMedia: async (storeId, file, onProgress) => {
      onProgress?.(0);
      const form = new FormData(); form.append("file", file);
      const result = await request<MediaRecord>(`/api/stores/${storeId}/media`, { method: "POST", body: form });
      onProgress?.(100);
      return { ...result, url: result.url.startsWith("/") ? `${origin}${result.url}` : result.url };
    },
    deleteMedia: (storeId, mediaId) => request(`/api/stores/${storeId}/media/${mediaId}`, { method: "DELETE" }),
  };
}
