import type { Metadata } from "next";
import { ServerContentPage, contentMetadata } from "@/features/storefront/server-content-page";

/** Rendered on its first visit and kept until the store changes (see the store layout). */
export function generateStaticParams() { return []; }
export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string; blogSlug: string; articleSlug: string }> }): Promise<Metadata> {
  const route = await params;
  return contentMetadata(route.storeSlug, "article", route.articleSlug, route.blogSlug);
}
export default async function Page({ params }: { params: Promise<{ storeSlug: string; blogSlug: string; articleSlug: string }> }) {
  const route = await params;
  return <ServerContentPage storeSlug={route.storeSlug} type="article" handle={route.articleSlug} blogHandle={route.blogSlug} />;
}
