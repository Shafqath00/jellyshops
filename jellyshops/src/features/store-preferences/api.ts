"use client";

import { useCallback } from "react";
import type { PreferenceProblem, StorePreferences } from "@jelly/storefront-schema";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";

export interface StoredPreferences { available: boolean; preferences: StorePreferences; revision: number; updatedAt: string | null }
export interface PreferenceChange { id: string; at: string; actorName: string | null; sections: string[] }
export interface UrlRedirect { id: string; from: string; to: string; createdAt: string }
export interface RedirectPage { redirects: UrlRedirect[]; total: number; available: boolean }
export interface RedirectImportRow { line: number; from: string; to: string; problem: string | null; replaces: boolean }
export interface RedirectImportResult { rows: RedirectImportRow[]; added: number; replaced: number; skipped: number; applied: boolean }

/** A refused request, with the server's plain message, its code and any per-field problems. */
export class PreferencesRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null, readonly problems: PreferenceProblem[], readonly currentRevision?: number) {
    super(message);
  }
}

/** Store preferences and URL redirects for the active store (`/api/stores/:storeId/preferences|redirects`). */
export function useStorePreferencesApi() {
  const { activeStore, session } = useAuth();
  const storeId = activeStore?.id, token = session?.access_token;
  const call = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!storeId || !token) throw new PreferencesRequestError("Select a store and sign in to continue.", 0, null, []);
    let response: Response;
    try {
      response = await fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } });
    } catch {
      throw new PreferencesRequestError("We couldn't reach Jellyshop. Check your connection and try again.", 0, null, []);
    }
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = body.error ?? {};
      throw new PreferencesRequestError(error.message ?? "Something went wrong. Please try again.", response.status, error.code ?? null, Array.isArray(error.issues) ? error.issues : [], typeof error.currentRevision === "number" ? error.currentRevision : undefined);
    }
    return body as T;
  }, [storeId, token]);

  const get = useCallback(() => call<StoredPreferences>("/preferences"), [call]);
  const save = useCallback((revision: number, preferences: StorePreferences) => call<StoredPreferences>("/preferences", { method: "PUT", body: JSON.stringify({ revision, preferences }) }), [call]);
  const history = useCallback(() => call<{ changes: PreferenceChange[] }>("/preferences/history").then((result) => result.changes), [call]);

  const listRedirects = useCallback((query: { q?: string; offset?: number; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.offset) params.set("offset", String(query.offset));
    if (query.limit) params.set("limit", String(query.limit));
    const search = params.toString();
    return call<RedirectPage>(`/redirects${search ? `?${search}` : ""}`);
  }, [call]);
  const createRedirect = useCallback((from: string, to: string) => call<{ redirect: UrlRedirect }>("/redirects", { method: "POST", body: JSON.stringify({ from, to }) }).then((r) => r.redirect), [call]);
  const updateRedirect = useCallback((id: string, from: string, to: string) => call<{ redirect: UrlRedirect }>(`/redirects/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ from, to }) }).then((r) => r.redirect), [call]);
  const removeRedirects = useCallback((ids: string[]) => call<{ removed: number }>("/redirects/delete", { method: "POST", body: JSON.stringify({ ids }) }).then((r) => r.removed), [call]);
  const importRedirects = useCallback((csv: string, options: { apply: boolean; replace: boolean }) => call<RedirectImportResult>("/redirects/import", { method: "POST", body: JSON.stringify({ csv, ...options }) }), [call]);

  return { ready: Boolean(storeId && token), storeId, get, save, history, listRedirects, createRedirect, updateRedirect, removeRedirects, importRedirects };
}
