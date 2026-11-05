import { jellyResthavenPreview } from "@/features/theme-preview/configs";
import { ThemePreviewPage } from "@/features/theme-preview/theme-preview-page";

/** Resthaven style guide and template previews. */
export default function ResthavenStyleGuidePage() {
  return <ThemePreviewPage config={jellyResthavenPreview} />;
}
