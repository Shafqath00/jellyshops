"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminCatalog, type CatalogAdminProduct, type CollectionRow } from "@/features/admin/api/catalog-api";
import { createAdminApi } from "@/features/admin/api/admin-api";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import type { MerchantDiscount } from "./api";
import { useDiscountsApi } from "./api";
import type { CatalogNames } from "./selection-field";

export interface DiscountFormData {
  loading: boolean;
  timeZone: string;
  names: CatalogNames;
  /** Customers with an email, for "specific customers". */
  customers: Array<{ email: string; name: string }>;
  /** Tags customers already have, offered as suggestions. */
  customerTags: string[];
  /** Every discount in the shop (for overlap warnings). */
  discounts: MerchantDiscount[];
  /** Products for the sample bag: lowest price and the collections each is in. */
  catalog: Array<{ id: string; title: string; priceMinor: number; collectionIds: string[]; active: boolean }>;
  /** The shop's delivery charge, when known. */
  shippingMinor: number | null;
}

/**
 * Everything the discount form reads besides the discount: product and collection names, customers and their tags,
 * the shop's other discounts and its time zone. Each part fails on its own: a missing list only means fewer choices.
 */
export function useDiscountFormData(): DiscountFormData {
  const { all, ready: catalogReady } = useAdminCatalog();
  const { list, ready } = useDiscountsApi();
  const { session, activeStore } = useAuth();
  const [products, setProducts] = useState<CatalogAdminProduct[] | null>(null);
  const [collections, setCollections] = useState<CollectionRow[] | null>(null);
  const [customers, setCustomers] = useState<Array<{ email: string; name: string; tags: string[] }> | null>(null);
  const [discounts, setDiscounts] = useState<{ discounts: MerchantDiscount[]; timeZone: string } | null>(null);
  const [shippingMinor, setShippingMinor] = useState<number | null>(null);

  useEffect(() => {
    if (!session || !activeStore) return;
    let active = true;
    fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(activeStore.id)}/settings`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { const value = Number((body?.settings ?? body)?.shippingMinor); if (active && Number.isFinite(value)) setShippingMinor(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session, activeStore]);

  useEffect(() => {
    if (!catalogReady) return;
    let active = true;
    all<CatalogAdminProduct>("/products").then((rows) => { if (active) setProducts(rows); }).catch(() => { if (active) setProducts([]); });
    all<CollectionRow>("/collections").then((rows) => { if (active) setCollections(rows); }).catch(() => { if (active) setCollections([]); });
    return () => { active = false; };
  }, [all, catalogReady]);

  useEffect(() => {
    if (!session || !activeStore) return;
    let active = true;
    createAdminApi({ baseUrl: authApiOrigin(), token: session.access_token }).listCustomers(activeStore.id)
      .then((result) => { if (active) setCustomers(result.customers.filter((customer) => customer.email).map((customer) => ({ email: customer.email!.toLowerCase(), name: customer.name, tags: (customer as { tags?: string[] }).tags ?? [] }))); })
      .catch(() => { if (active) setCustomers([]); });
    return () => { active = false; };
  }, [session, activeStore]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    list().then((result) => { if (active) setDiscounts({ discounts: result.discounts, timeZone: result.timeZone }); }).catch(() => { if (active) setDiscounts({ discounts: [], timeZone: "Europe/London" }); });
    return () => { active = false; };
  }, [list, ready]);

  return useMemo(() => {
    const names: CatalogNames = { products: {}, collections: {} };
    for (const product of products ?? []) names.products[product.id] = { title: product.title, active: String((product as { status?: string }).status ?? "ACTIVE").toUpperCase() === "ACTIVE" };
    for (const collection of collections ?? []) names.collections[collection.id] = { title: collection.title, count: collection.productIds?.length ?? 0 };
    const inCollections = new Map<string, string[]>();
    for (const collection of collections ?? []) for (const productId of collection.productIds ?? []) inCollections.set(productId, [...(inCollections.get(productId) ?? []), collection.id]);
    const catalog = (products ?? []).map((product) => ({
      id: product.id, title: product.title, active: product.status === "ACTIVE",
      priceMinor: Math.min(...(product.variants?.length ? product.variants.map((variant) => variant.priceMinor) : [0])),
      collectionIds: inCollections.get(product.id) ?? product.collectionIds ?? [],
    }));
    return {
      catalog, shippingMinor,
      loading: products === null || collections === null || discounts === null,
      timeZone: discounts?.timeZone ?? "Europe/London",
      names,
      customers: (customers ?? []).map(({ email, name }) => ({ email, name })),
      customerTags: [...new Set((customers ?? []).flatMap((customer) => customer.tags))].sort((a, b) => a.localeCompare(b)),
      discounts: discounts?.discounts ?? [],
    };
  }, [products, collections, customers, discounts, shippingMinor]);
}
