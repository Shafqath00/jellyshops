"use client";

import { useMemo } from "react";
import type { CommerceDataProvider } from "@jelly/storefront-renderer";
import type { Currency } from "@/lib/domain";
import { fetchCatalogPage, type BrowseInput } from "./catalog-browse-fetch";

export { browseUrl, fetchCatalogPage } from "./catalog-browse-fetch";

/** A stable `browseProducts` for the live store's commerce provider (the same function until the store changes). */
export function useCatalogBrowse(storeId: string | undefined, storeSlug: string, currency: Currency): CommerceDataProvider["browseProducts"] {
  return useMemo(() => storeId ? (input: BrowseInput) => fetchCatalogPage(storeId, storeSlug, currency, input) : undefined, [storeId, storeSlug, currency]);
}
