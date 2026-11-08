"use client";

import { useCallback } from "react";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";

export type ReviewStatus = "pending" | "published" | "hidden";
export interface MerchantReview {
  id: string; productId: string; productTitle: string; rating: number; title: string; body: string;
  authorName: string; authorEmail: string | null; status: ReviewStatus; verifiedPurchase: boolean; createdAt: string; publishedAt: string | null;
}
export interface MerchantReviewList { reviews: MerchantReview[]; counts: Record<ReviewStatus, number> }

/** The merchant's reviews API for the active store (`/api/stores/:storeId/reviews`). */
export function useAdminReviews() {
  const { activeStore, session } = useAuth();
  const storeId = activeStore?.id, token = session?.access_token;
  const call = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!storeId || !token) throw new Error("Select a store and sign in to continue.");
    const response = await fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/reviews${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error?.message ?? "Could not load reviews.");
    return body as T;
  }, [storeId, token]);
  const list = useCallback((status: ReviewStatus | "", offset = 0) => call<MerchantReviewList>(`?limit=50&offset=${offset}${status ? `&status=${status}` : ""}`), [call]);
  const setStatus = useCallback((id: string, status: ReviewStatus) => call<{ ok: true }>(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }), [call]);
  const remove = useCallback((id: string) => call<void>(`/${encodeURIComponent(id)}`, { method: "DELETE" }), [call]);
  return { list, setStatus, remove, ready: Boolean(storeId && token), storeId };
}
