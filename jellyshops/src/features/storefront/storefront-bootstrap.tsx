"use client";
import { createContext, useContext } from "react";
import { ShopProvider } from "@/contexts/shop-context";
import type { StorefrontBootstrapData } from "./server-storefront";
import type { PublicStorefrontPublication } from "./public-storefront-api";
import { CustomerProvider } from "@/features/customers/customer-provider";
const InitialPublicationContext = createContext<PublicStorefrontPublication | null>(null);
export function StorefrontBootstrap({ data, children }: { data: StorefrontBootstrapData; children: React.ReactNode }) {
  return <InitialPublicationContext.Provider value={data.publication}><ShopProvider initialCatalog={data}><CustomerProvider>{children}</CustomerProvider></ShopProvider></InitialPublicationContext.Provider>;
}
export function useInitialStorefrontPublication() { return useContext(InitialPublicationContext); }
