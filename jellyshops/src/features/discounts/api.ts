"use client";

import { useCallback } from "react";
import type { DiscountDefinition, DiscountInput, DiscountStatus } from "@jelly/storefront-schema";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";

/** A discount as the admin receives it (dates as ISO text) with how it is doing. */
export interface MerchantDiscount extends Omit<DiscountDefinition, "startsAt" | "endsAt" | "createdAt"> {
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: DiscountStatus;
  /** Orders that used it and were not cancelled (what usage limits count). */
  uses: number;
  codeCount: number;
  /** Paid orders that used it, what they came to and what the discount took off. */
  paidOrders: number;
  salesMinor: number;
  givenMinor: number;
}

export interface DiscountList {
  discounts: MerchantDiscount[];
  timeZone: string;
  totals: { active: number; uses: number; paidOrders: number; salesMinor: number; givenMinor: number };
}

/** A failed request, with the server's plain message and the fields it was about. */
export class DiscountRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly issues: Array<{ path: string; message: string }> = []) {
    super(message);
  }
}

export type BulkDiscountAction = "enable" | "disable" | "delete";

/** The merchant's discounts for the active store (`/api/stores/:storeId/discounts`). */
export function useDiscountsApi() {
  const { activeStore, session } = useAuth();
  const storeId = activeStore?.id;
  const token = session?.access_token;
  const call = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!storeId || !token) throw new DiscountRequestError("Select a store and sign in to continue.", 0, "NOT_READY");
    const response = await fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/discounts${path}`, {
      ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = body.error ?? {};
      const fallback = response.status === 403 ? "Only the shop owner and admins can change discounts." : response.status === 404 ? "That discount no longer exists." : "Discounts couldn't be loaded. Try again.";
      throw new DiscountRequestError(error.message ?? fallback, response.status, error.code ?? "", error.issues ?? []);
    }
    return body as T;
  }, [storeId, token]);

  const list = useCallback(() => call<DiscountList>(""), [call]);
  const get = useCallback(async (id: string) => (await call<{ discount: MerchantDiscount }>(`/${encodeURIComponent(id)}`)).discount, [call]);
  const create = useCallback(async (input: DiscountInput) => (await call<{ discount: MerchantDiscount }>("", { method: "POST", body: JSON.stringify(input) })).discount, [call]);
  const update = useCallback(async (id: string, input: DiscountInput) => (await call<{ discount: MerchantDiscount }>(`/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) })).discount, [call]);
  const remove = useCallback((id: string) => call<void>(`/${encodeURIComponent(id)}`, { method: "DELETE" }), [call]);
  const bulk = useCallback(async (ids: string[], action: BulkDiscountAction) => (await call<{ changed: number }>("/bulk", { method: "POST", body: JSON.stringify({ ids, action }) })).changed, [call]);
  const duplicate = useCallback(async (id: string) => (await call<{ discount: MerchantDiscount }>(`/${encodeURIComponent(id)}/duplicate`, { method: "POST" })).discount, [call]);
  const codeCheck = useCallback((code: string, except?: string) => call<{ code: string | null; available: boolean; message: string | null }>(`/code-check?code=${encodeURIComponent(code)}${except ? `&except=${encodeURIComponent(except)}` : ""}`), [call]);
  const generateCode = useCallback(async (prefix = "") => (await call<{ code: string }>("/generate-code", { method: "POST", body: JSON.stringify({ prefix }) })).code, [call]);
  const canManage = activeStore?.role === "OWNER" || activeStore?.role === "ADMIN";
  return { list, get, create, update, remove, bulk, duplicate, codeCheck, generateCode, ready: Boolean(storeId && token), storeId, currency: activeStore?.currency ?? "GBP", canManage };
}
