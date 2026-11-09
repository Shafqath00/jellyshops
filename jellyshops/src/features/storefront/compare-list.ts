"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { StorefrontCompareAccess } from "@jelly/storefront-renderer";

/** Most products a shopper can compare side by side. */
export const MAX_COMPARE = 4;
const EVENT = "jelly:compare-changed";
const key = (storeSlug: string) => `jelly-compare:${storeSlug}`;

/**
 * The shopper's compare list for one store: product ids kept in this browser (localStorage, falling back to memory
 * when storage is blocked). Every access to the same store shares one list and is told about changes, including
 * changes made in another tab.
 */
const memory = new Map<string, readonly string[]>();

function read(storeSlug: string): readonly string[] {
  try {
    const raw = window.localStorage.getItem(key(storeSlug));
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200).slice(0, MAX_COMPARE);
    }
  } catch { /* blocked or broken storage: use memory */ }
  return memory.get(storeSlug) ?? [];
}

function write(storeSlug: string, ids: readonly string[]) {
  memory.set(storeSlug, ids);
  try { window.localStorage.setItem(key(storeSlug), JSON.stringify(ids)); } catch { /* memory only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: storeSlug }));
}

export function createCompareAccess(storeSlug: string): StorefrontCompareAccess & { remove(productId: string): void; clear(): void } {
  let snapshot: readonly string[] | null = null;
  const ids = () => {
    if (typeof window === "undefined") return [];
    const next = read(storeSlug);
    // useSyncExternalStore needs the same array back until the list really changes.
    if (!snapshot || snapshot.length !== next.length || snapshot.some((id, index) => id !== next[index])) snapshot = next;
    return snapshot;
  };
  return {
    max: MAX_COMPARE,
    ids,
    toggle(productId) {
      const current = read(storeSlug);
      if (current.includes(productId)) { write(storeSlug, current.filter((id) => id !== productId)); return { ok: true }; }
      if (current.length >= MAX_COMPARE) return { ok: false, message: `You can compare up to ${MAX_COMPARE} products. Remove one first.` };
      write(storeSlug, [...current, productId]);
      return { ok: true };
    },
    remove(productId) { write(storeSlug, read(storeSlug).filter((id) => id !== productId)); },
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

const EMPTY: readonly string[] = [];

/** The compare list for a store and its current ids (empty during server rendering). */
export function useCompareList(storeSlug: string) {
  const access = useMemo(() => createCompareAccess(storeSlug), [storeSlug]);
  const ids = useSyncExternalStore(access.subscribe, access.ids, () => EMPTY);
  return { access, ids };
}
