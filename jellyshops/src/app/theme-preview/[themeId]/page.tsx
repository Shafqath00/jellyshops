import { notFound } from "next/navigation";
import { generatedThemePreview } from "@/features/theme-preview/configs";
import { ThemePreviewPage } from "@/features/theme-preview/theme-preview-page";

/** Style guide and template previews of a generated theme (one built on Jelly Minimal or Jelly Avenue). */
export default async function GeneratedThemePreviewPage({ params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
  const config = generatedThemePreview(themeId);
  if (!config) notFound();
  return <ThemePreviewPage config={config} />;
}
