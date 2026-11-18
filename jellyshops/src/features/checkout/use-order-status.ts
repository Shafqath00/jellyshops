"use client";

import { useEffect, useMemo, useState } from "react";
import { createCommerceApi } from "@/features/commerce/api/client";
import type { PublicOrderResult } from "@/features/commerce/api/types";

/**
 * Waits between checks while a payment is being confirmed: quick at first (the
 * Stripe webhook usually lands within a few seconds), then slower. The server
 * allows 30 order lookups a minute per shop and address; this stays well under.
 */
export const CONFIRMING_DELAYS_MS = [1500, 2000, 3000, 4000, 5000, 8000, 10000];
const SLOW_DELAY_MS = 15000;
const MAX_FAILURE_DELAY_MS = 60000;

export function nextCheckDelay(checksSoFar: number): number {
  return CONFIRMING_DELAYS_MS[checksSoFar] ?? SLOW_DELAY_MS;
}

/** True while the order still needs watching: payment not confirmed yet, or a balance is due. */
export function needsWatching(result: PublicOrderResult): boolean {
  return result.order.status === "PENDING_PAYMENT" || result.payment?.status === "PROCESSING" || Number(result.order.balanceDueMinor ?? 0) > 0;
}

interface OrderStatusOptions {
  storeSlug: string;
  publicToken: string;
  /** Known on the server; when missing it is looked up from the shop address first. */
  storeId?: string;
}

/**
 * The order as our server sees it. The page never trusts the Stripe redirect or
 * `?paid=1`: an order shows as paid only when the server says so (the webhook set it).
 */
export function useOrderStatus({ storeSlug, publicToken, storeId: knownStoreId }: OrderStatusOptions) {
  const [result, setResult] = useState<PublicOrderResult | null>(null);
  const [missing, setMissing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const api = useMemo(() => createCommerceApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }), []);

  useEffect(() => {
    let active = true;
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let storeId = knownStoreId;
    let inFlight = false;
    let retryNotBefore = 0;
    let failures = 0;
    let checks = 0;

    async function refresh() {
      if (!active || inFlight || Date.now() < retryNotBefore) return;
      inFlight = true;
      const request = ++sequence;
      try {
        if (!storeId) storeId = (await api.getPublicStoreBySlug(storeSlug)).store.id;
        const next = await api.getPublicOrder(storeId, publicToken);
        if (!active || request !== sequence) return;
        setResult(next); setMissing(false); setRefreshError(false);
        failures = 0;
        retryNotBefore = 0;
        if (needsWatching(next)) timer = setTimeout(refresh, nextCheckDelay(checks++));
      } catch (error) {
        if (!active || request !== sequence) return;
        const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
        if (status === 404) { setMissing(true); return; }
        setRefreshError(true);
        failures++;
        const delay = status === 429 ? MAX_FAILURE_DELAY_MS : Math.min(SLOW_DELAY_MS * 2 ** (failures - 1), MAX_FAILURE_DELAY_MS);
        retryNotBefore = Date.now() + delay;
        timer = setTimeout(refresh, delay);
      } finally {
        inFlight = false;
      }
    }

    const focus = () => { if (inFlight || Date.now() < retryNotBefore) return; if (timer) clearTimeout(timer); void refresh(); };
    void refresh();
    window.addEventListener("focus", focus);
    return () => { active = false; if (timer) clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [api, publicToken, storeSlug, knownStoreId]);

  return { result, missing, refreshError };
}
