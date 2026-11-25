import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { previewConfigForTheme } from "@/features/theme-preview/configs";
import { isLivePage } from "@/features/theme-preview/live-preview-links";
import { LiveStorePreview } from "@/features/theme-preview/live-store-preview";

export const metadata: Metadata = { title: "Store design preview | Jellyshop", robots: { index: false, follow: false } };

/** A design's whole sample store, shown in a frame by the home page's template previews. ?page= picks the first page. */
export default async function LiveTemplatePreviewPage({ params, searchParams }: { params: Promise<{ themeId: string }>; searchParams: Promise<{ page?: string }> }) {
  const [{ themeId }, { page }] = await Promise.all([params, searchParams]);
  const config = previewConfigForTheme(themeId);
  if (!config) notFound();
  return <LiveStorePreview config={config} initialPage={isLivePage(page) ? page : "home"} />;
}
