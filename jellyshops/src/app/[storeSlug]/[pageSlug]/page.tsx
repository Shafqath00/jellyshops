import { ServerContentPage } from "@/features/storefront/server-content-page";

/** Rendered on its first visit and kept until the store changes (see the store layout). */
export function generateStaticParams() { return []; }
export default async function Page({ params }: { params: Promise<{ storeSlug: string; pageSlug: string }> }) {
  const route = await params;
  return <ServerContentPage storeSlug={route.storeSlug} type="page" handle={route.pageSlug} />;
}
