"use client";
import { useEffect } from "react";

/**
 * Tells the backend "this store had a shopper today", at most once a day per store and browser, after the page has
 * loaded. Store pages are cached, so without this the backend never sees visits; it feeds the inactive-store stages.
 * Sends nothing but the store id (in the address): no cookie, no shopper data.
 */
export function useVisitBeacon(storeId: string, apiUrl = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001") {
  useEffect(() => {
    if (!storeId) return;
    const key = `jelly-visit:${storeId}`;
    const today = new Date().toISOString().slice(0, 10);
    try { if (window.localStorage.getItem(key) === today) return; } catch { return; }
    const send = () => {
      try {
        const url = `${apiUrl.replace(/\/$/, "")}/api/public/stores/${encodeURIComponent(storeId)}/visit`;
        const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url);
        if (!sent) void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
        window.localStorage.setItem(key, today);
      } catch { /* a missed visit only makes the store look a day older */ }
    };
    const timer = window.setTimeout(send, 3000);
    return () => window.clearTimeout(timer);
  }, [storeId, apiUrl]);
}

export function VisitBeacon({ storeId }: { storeId: string }) {
  useVisitBeacon(storeId);
  return null;
}
