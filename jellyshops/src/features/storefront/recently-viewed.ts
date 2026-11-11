"use client";

import { useEffect, useMemo } from "react";
import type { StorefrontRecentlyViewedAccess } from "@jelly/storefront-renderer";

/** How many products the list remembers (the section shows up to 12). */
export const MAX_RECENTLY_VIEWED = 12;
const EVENT = "jelly:recently-viewed-changed";
const key = (storeSlug: string) => `jelly-recent:${storeSlug}`;

/**
 * Products a shopper opened in one store, newest first: ids kept in this browser only (localStorage, falling back to
 * memory when storage is blocked). Nothing is sent to the server.
 */
const memory = new Map<string, readonly string[]>();

function read(storeSlug: string): readonly string[] {
  try {
    const raw = window.localStorage.getItem(key(storeSlug));
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200).slice(0, MAX_RECENTLY_VIEWED);
    }
  } catch { /* blocked or broken storage: use memory */ }
  return memory.get(storeSlug) ?? [];
}

function write(storeSlug: string, ids: readonly string[]) {
  memory.set(storeSlug, ids);
  try { window.localStorage.setItem(key(storeSlug), JSON.stringify(ids)); } catch { /* memory only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: storeSlug }));
}

/** Puts a product at the front of the list (moving it if it was already there). */
export function recordRecentlyViewed(storeSlug: string, productId: string): void {
  if (typeof window === "undefined" || !productId) return;
  const current = read(storeSlug);
  if (current[0] === productId) return;
  write(storeSlug, [productId, ...current.filter((id) => id !== productId)].slice(0, MAX_RECENTLY_VIEWED));
}

export function createRecentlyViewedAccess(storeSlug: string): StorefrontRecentlyViewedAccess & { clear(): void } {
  let snapshot: readonly string[] | null = null;
  return {
    ids() {
      if (typeof window === "undefined") return [];
      const next = read(storeSlug);
      // useSyncExternalStore needs the same array back until the list really changes.
      if (!snapshot || snapshot.length !== next.length || snapshot.some((id, index) => id !== next[index])) snapshot = next;
      return snapshot;
    },
    clear() { write(storeSlug, []); },
    subscribe(listener) {
      const onChange = (event: Event) => { if ((event as CustomEvent).detail === storeSlug) listener(); };
      const onStorage = (event: StorageEvent) => { if (event.key === key(storeSlug)) listener(); };
      window.addEventListener(EVENT, onChange);
      window.addEventListener("storage", onStorage);
      return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onStorage); };
    },
  };
}

/** The store's recently viewed list; on a product page it also records that product (after it is shown). */
export function useRecentlyViewed(storeSlug: string, productId?: string): StorefrontRecentlyViewedAccess {
  const access = useMemo(() => createRecentlyViewedAccess(storeSlug), [storeSlug]);
  useEffect(() => { if (productId) recordRecentlyViewed(storeSlug, productId); }, [storeSlug, productId]);
  return access;
}
