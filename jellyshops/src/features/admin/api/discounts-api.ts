"use client";

import { useCallback } from "react";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";

export type DiscountKind = "percent" | "fixed" | "free_shipping";

export interface MerchantDiscount {
  id: string;
  code: string;
  kind: DiscountKind;
  /** Percent 1-100, or minor units for "fixed"; 0 for free delivery. */
  value: number;
  minimumSubtotalMinor: number | null;
  usageLimit: number | null;
  oncePerCustomer: boolean;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  /** Orders placed with the code that were not cancelled. */
  uses: number;
  createdAt: string;
}

export type DiscountInput = Omit<MerchantDiscount, "id" | "uses" | "createdAt">;

export type DiscountState = "active" | "scheduled" | "expired" | "used-up" | "off";

/** Where a code stands today, for the list's status column. */
export function discountState(discount: MerchantDiscount, now = new Date()): DiscountState {
  if (!discount.active) return "off";
  if (discount.endsAt && new Date(discount.endsAt) <= now) return "expired";
  if (discount.usageLimit !== null && discount.uses >= discount.usageLimit) return "used-up";
  if (discount.startsAt && new Date(discount.startsAt) > now) return "scheduled";
  return "active";
}

/** The merchant's discount codes for the active store (`/api/stores/:storeId/discounts`). */
export function useAdminDiscounts() {
  const { activeStore, session } = useAuth();
  const storeId = activeStore?.id, token = session?.access_token;
  const call = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!storeId || !token) throw new Error("Select a store and sign in to continue.");
    const response = await fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/discounts${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message ?? (response.status === 404 ? "Discount codes aren't available yet. Try again after the next update." : "Could not load discount codes."));
    return body as T;
  }, [storeId, token]);
  const list = useCallback(async () => (await call<{ discounts: MerchantDiscount[] }>("")).discounts, [call]);
  const create = useCallback(async (input: DiscountInput) => (await call<{ discount: MerchantDiscount }>("", { method: "POST", body: JSON.stringify(input) })).discount, [call]);
  const update = useCallback(async (id: string, input: DiscountInput) => (await call<{ discount: MerchantDiscount }>(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) })).discount, [call]);
  const remove = useCallback((id: string) => call<void>(`/${encodeURIComponent(id)}`, { method: "DELETE" }), [call]);
  return { list, create, update, remove, ready: Boolean(storeId && token), storeId, currency: activeStore?.currency ?? "GBP" };
}
