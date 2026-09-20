"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { AlertCircle } from "lucide-react";
import { useShop } from "@/contexts/shop-context";
import { createCommerceApi } from "@/features/commerce/api/client";
import type { Store } from "@/lib/domain";

type CatalogStatus = "loading" | "ready" | "error";

const API_URL =
  process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

const FALLBACK_BANNER =
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=85";

const DEFAULT_THEME: Store["theme"] = {
  accent: "#172a1b",
  accentSoft: "#e8f3d6",
  background: "#fffdf8",
  surface: "#ffffff",
  text: "#172a1b",
  displayFont: "serif",
};

const CatalogStatusContext =
  createContext<CatalogStatus>("loading");

interface StorefrontCatalogSyncProps {
  storeSlug: string;
  children?: React.ReactNode;
}

export function StorefrontCatalogSync({
  storeSlug,
  children,
}: StorefrontCatalogSyncProps) {
  const { repository } = useShop();
  const [status, setStatus] =
    useState<CatalogStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function syncCatalog() {
      setStatus("loading");

      try {
        const api = createCommerceApi({ baseUrl: API_URL });
        const details = await api.getPublicStoreBySlug(storeSlug);
        const storeId = details.store.id;
        const products = await api.getPublicCatalog(storeId);

        if (cancelled) return;

        const existingStore = repository.getStoreBySlug(storeSlug);

        const store: Store =
          existingStore ??
          ({
            id: storeId,
            businessId: storeId,
            name: details.store.name,
            slug: details.store.slug,
            tagline: details.store.name,
            description: `Welcome to ${details.store.name}.`,
            currency:
              details.store.currency.toUpperCase() as Store["currency"],
            published: true,
            bannerUrl: FALLBACK_BANNER,
            shippingMinor: 0,
            theme: DEFAULT_THEME,
          } satisfies Store);

        repository.saveStore({
          ...store,
          id: storeId,
          name: details.store.name,
          slug: details.store.slug,
          currency:
            details.store.currency.toUpperCase() as Store["currency"],
        });

        repository.replaceCatalog(
          storeId,
          products.map((product) => ({
            ...product,
            storeId,
          }))
        );

        setStatus("ready");
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    syncCatalog();

    return () => {
      cancelled = true;
    };
  }, [repository, storeSlug]);

  return (
    <CatalogStatusContext.Provider value={status}>
      {status === "error" && (
        <div
          role="status"
          className="mx-auto mb-5 flex max-w-6xl items-start gap-2.5 rounded-2xl border border-[#edcbd2] bg-[#fff5f7] px-4 py-3 text-[11px] font-semibold leading-5 text-[#914f60]"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>
            We couldn’t refresh the catalog. Please try again shortly.
          </span>
        </div>
      )}

      {children}
    </CatalogStatusContext.Provider>
  );
}

export function useStorefrontCatalogStatus() {
  return useContext(CatalogStatusContext);
}
