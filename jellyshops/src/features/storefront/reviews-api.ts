"use client";

import { useEffect, useMemo, useState } from "react";
import type { StorefrontReviewAccess, StorefrontReviewPage } from "@jelly/storefront-renderer";

type Ratings = Record<string, { average: number; count: number }>;

function apiOrigin(): string {
  return process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
}

function reviewsUrl(storeId: string, path: string): string {
  return `${apiOrigin()}/api/public/stores/${encodeURIComponent(storeId)}/reviews${path}`;
}

/** Star ratings for up to 100 products per request; products without published reviews are left out. */
export async function fetchReviewSummaries(storeId: string, productIds: readonly string[], fetcher: typeof fetch = fetch): Promise<Ratings> {
  const ids = [...new Set(productIds)].filter(Boolean);
  const result: Ratings = {};
  for (let start = 0; start < ids.length; start += 100) {
    const response = await fetcher(reviewsUrl(storeId, `/summary?productIds=${ids.slice(start, start + 100).map(encodeURIComponent).join(",")}`));
    if (!response.ok) continue;
    const data = await response.json().catch(() => null) as { summaries?: Ratings } | null;
    Object.assign(result, data?.summaries ?? {});
  }
  return result;
}

/** The storefront's reviews connection for the product page's Reviews section. */
export function storefrontReviewAccess(storeId: string, fetcher: typeof fetch = fetch): StorefrontReviewAccess {
  return {
    async list(productId, page = {}) {
      const params = new URLSearchParams();
      if (page.limit) params.set("limit", String(page.limit));
      if (page.offset) params.set("offset", String(page.offset));
      const response = await fetcher(reviewsUrl(storeId, `/products/${encodeURIComponent(productId)}?${params}`));
      if (!response.ok) throw new Error("Reviews could not be loaded.");
      return await response.json() as StorefrontReviewPage;
    },
    async submit(productId, review) {
      const response = await fetcher(reviewsUrl(storeId, `/products/${encodeURIComponent(productId)}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(review) });
      if (response.ok) return { ok: true };
      const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
      return { ok: false, message: data.error?.message };
    },
  };
}

/** Star ratings of the given products, loaded once per store and list of products. Empty until loaded or without a store. */
export function useReviewSummaries(storeId: string | undefined, productIds: readonly string[]): Ratings {
  const key = productIds.join(",");
  const [ratings, setRatings] = useState<{ key: string; value: Ratings }>({ key: "", value: {} });
  useEffect(() => {
    if (!storeId || !key) return;
    let live = true;
    fetchReviewSummaries(storeId, key.split(",")).then((value) => { if (live) setRatings({ key: `${storeId}:${key}`, value }); }).catch(() => undefined);
    return () => { live = false; };
  }, [storeId, key]);
  return ratings.key === `${storeId}:${key}` ? ratings.value : {};
}

/** The reviews connection for a store, kept stable between renders. */
export function useStorefrontReviewAccess(storeId: string | undefined): StorefrontReviewAccess | undefined {
  return useMemo(() => storeId ? storefrontReviewAccess(storeId) : undefined, [storeId]);
}
