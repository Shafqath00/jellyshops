import { ServerContentPage } from "@/features/storefront/server-content-page";
export default async function Page({ params }: { params: Promise<{ storeSlug: string; blogSlug: string; articleSlug: string }> }) {
  const route = await params;
  return <ServerContentPage storeSlug={route.storeSlug} type="article" handle={route.articleSlug} blogHandle={route.blogSlug} />;
}
