"use client";
import { createContext, useContext } from "react";
import { ShopProvider } from "@/contexts/shop-context";
import type { StorefrontBootstrapData } from "./server-storefront";
import type { PublicStorefrontPublication } from "./public-storefront-api";
import { CustomerProvider } from "@/features/customers/providers/customer-provider";
import type { NavigationResource } from "@/features/navigation/resource-links";
import { VisitBeacon } from "./use-visit-beacon";
import { readStorePreferences, type StorePreferences } from "@jelly/storefront-schema";
const InitialPublicationContext = createContext<PublicStorefrontPublication | null>(null);
const InitialNavigationContext = createContext<{ storeId: string; resources: NavigationResource[] } | null>(null);
const StorePreferencesContext = createContext<StorePreferences | null>(null);
export function StorefrontBootstrap({ data, children }: { data: StorefrontBootstrapData; children: React.ReactNode }) {
  const navigation = data.navigation ? { storeId: data.store.id, resources: data.navigation } : null;
  return <StorePreferencesContext.Provider value={data.preferences ?? null}><InitialPublicationContext.Provider value={data.publication}><InitialNavigationContext.Provider value={navigation}><ShopProvider initialCatalog={data}><CustomerProvider><VisitBeacon storeId={data.store.id} />{children}</CustomerProvider></ShopProvider></InitialNavigationContext.Provider></InitialPublicationContext.Provider></StorePreferencesContext.Provider>;
}
export function useInitialStorefrontPublication() { return useContext(InitialPublicationContext); }
/** Menu destinations the server already read for this store, if any. */
export function useInitialNavigationResources() { return useContext(InitialNavigationContext); }
/** The store's preferences (Settings > Store preferences), or the defaults outside a published store page. */
export function useStorePreferences(): StorePreferences {
  return useContext(StorePreferencesContext) ?? DEFAULT_PREFERENCES;
}
const DEFAULT_PREFERENCES = readStorePreferences(null);
