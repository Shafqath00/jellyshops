import type { DynamicBinding } from "@jelly/storefront-schema";
import { bindingKey, type BindingValues } from "./dynamic-settings";

export interface BindingValuesRequest {
  storeId: string;
  resource?: { type: "product" | "collection" | "page" | "blog" | "article"; id: string };
  bindings: DynamicBinding[];
}

export type BindingValueLoader = (request: BindingValuesRequest) => Promise<BindingValues>;

function apiOrigin(): string {
  const server = typeof window === "undefined" ? process.env.STOREFRONT_API_URL : undefined;
  return (server ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

/** Media URLs come back API-relative ("/api/public/media/…"); the storefront runs on another origin. */
function absoluteMedia(value: unknown, origin: string): unknown {
  if (Array.isArray(value)) return value.map((item) => absoluteMedia(item, origin));
  if (value && typeof value === "object" && typeof (value as { url?: unknown }).url === "string") {
    const url = (value as { url: string }).url;
    return url.startsWith("/api/") ? { ...value, url: `${origin}${url}` } : value;
  }
  return value;
}

/** Fetches values from `path` and keys them by binding. Callers fall back to each setting's fallback when this fails. */
export function createBindingValueLoader(options: { path: (storeId: string) => string; origin?: string; headers?: () => Record<string, string>; fetch?: typeof fetch }): BindingValueLoader {
  return async ({ storeId, resource, bindings }) => {
    if (!bindings.length) return new Map();
    const origin = (options.origin ?? apiOrigin()).replace(/\/$/, "");
    const response = await (options.fetch ?? fetch)(`${origin}${options.path(storeId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...options.headers?.() },
      body: JSON.stringify({ ...(resource ? { resource } : {}), bindings }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Custom field values could not be loaded (${response.status})`);
    const body = await response.json() as { values?: Array<{ binding: DynamicBinding; value: unknown }> };
    return new Map((body.values ?? []).map(({ binding, value }) => [bindingKey(binding), absoluteMedia(value, origin)]));
  };
}

/** Values shoppers see: published resources and storefront-visible custom fields only. */
export const loadPublicBindingValues: BindingValueLoader = createBindingValueLoader({
  path: (storeId) => `/api/public/stores/${encodeURIComponent(storeId)}/storefront/binding-values`,
});
