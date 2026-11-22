import { ServerContentPage } from "@/features/storefront/server-content-page";

/** Rendered on its first visit and kept until the store changes (see the store layout). */
export function generateStaticParams() { return []; }

/**
 * Information pages at /<store>/pages/<handle>, the address theme starters and menus link to (Shopify's address for
 * pages), as well as /<store>/<handle>. The segment is named `metaobject` because /pages/<metaobject>/<entry> shows
 * metaobject entries; one level deep it is a page handle.
 */
export default async function Page({ params }: { params: Promise<{ storeSlug: string; metaobject: string }> }) {
  const route = await params;
  return <ServerContentPage storeSlug={route.storeSlug} type="page" handle={route.metaobject} />;
}
