import { notFound } from "next/navigation";
import { getServerStorefront } from "@/features/storefront/server-storefront";
import { serverRouteValues } from "@/features/storefront/server-route-values";
import CartPageClient from "./cart-client";

export default async function CartPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  const data = await getServerStorefront(storeSlug);
  if (!data) notFound();
  const routeValues = await serverRouteValues(data.publication, { type: "cart" }, null);
  return <CartPageClient routeValues={routeValues} />;
}
