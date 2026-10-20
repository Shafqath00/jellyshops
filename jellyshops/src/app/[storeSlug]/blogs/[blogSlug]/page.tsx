import { ServerContentPage } from "@/features/storefront/server-content-page";
export default async function Page({ params }: { params: Promise<{ storeSlug: string; blogSlug: string }> }) {
  const route = await params;
  return <ServerContentPage storeSlug={route.storeSlug} type="blog" handle={route.blogSlug} />;
}
