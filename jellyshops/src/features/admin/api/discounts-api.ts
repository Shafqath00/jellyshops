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

/** The server speaks the second discount model (types, methods); this page still edits plain order codes until the new admin (phase 3) replaces it. */
interface ServerDiscount { id: string; code: string | null; title: string; type: string; valueType: string | null; value: number; minimum: { type: string; amountMinor?: number }; usageLimit: number | null; oncePerCustomer: boolean; startsAt: string | null; endsAt: string | null; active: boolean; uses: number; createdAt: string }

function fromServer(raw: ServerDiscount): MerchantDiscount {
  return {
    id: raw.id, code: raw.code ?? raw.title, kind: raw.type === "free_shipping" ? "free_shipping" : raw.valueType === "fixed" ? "fixed" : "percent", value: raw.value,
    minimumSubtotalMinor: raw.minimum?.type === "amount" ? raw.minimum.amountMinor ?? null : null, usageLimit: raw.usageLimit, oncePerCustomer: raw.oncePerCustomer,
    startsAt: raw.startsAt, endsAt: raw.endsAt, active: raw.active, uses: raw.uses, createdAt: raw.createdAt,
  };
}

function toServer(input: DiscountInput) {
  return {
    method: "code", code: input.code, title: input.code, type: input.kind === "free_shipping" ? "free_shipping" : "order_amount",
    ...(input.kind === "free_shipping" ? {} : { valueType: input.kind, value: input.value }),
    minimum: input.minimumSubtotalMinor ? { type: "amount", amountMinor: input.minimumSubtotalMinor } : { type: "none" },
    usageLimit: input.usageLimit, oncePerCustomer: input.oncePerCustomer, startsAt: input.startsAt, endsAt: input.endsAt, active: input.active,
  };
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
  const list = useCallback(async () => (await call<{ discounts: ServerDiscount[] }>("")).discounts.map(fromServer), [call]);
  const create = useCallback(async (input: DiscountInput) => fromServer((await call<{ discount: ServerDiscount }>("", { method: "POST", body: JSON.stringify(toServer(input)) })).discount), [call]);
  const update = useCallback(async (id: string, input: DiscountInput) => fromServer((await call<{ discount: ServerDiscount }>(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(toServer(input)) })).discount), [call]);
  const remove = useCallback((id: string) => call<void>(`/${encodeURIComponent(id)}`, { method: "DELETE" }), [call]);
  return { list, create, update, remove, ready: Boolean(storeId && token), storeId, currency: activeStore?.currency ?? "GBP" };
}
