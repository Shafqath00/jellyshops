import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { serverRouteValues } from "@/features/storefront/server-route-values";
import { SHOP_ALL_COLLECTION as ALL_PRODUCTS } from "@/features/storefront/page-context-loaders";
import ShopPageClient from "./shop-client";
import { searchFromParams } from "@/features/storefront/list-search";

export default async function ShopPage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  const routeValues = await serverRouteValues(data.publication, { type: "collection", handle: ALL_PRODUCTS.slug }, { type: "collection", id: ALL_PRODUCTS.id, handle: ALL_PRODUCTS.slug });
  return <ShopPageClient routeValues={routeValues} listSearch={searchFromParams(await searchParams)} />;
}
