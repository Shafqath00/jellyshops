import { jellyHaloPreview } from "@/features/theme-preview/configs";
import { ThemePreviewPage } from "@/features/theme-preview/theme-preview-page";

/** Jelly Halo style guide and template previews. */
export default function HaloPreviewPage() {
  return <ThemePreviewPage config={jellyHaloPreview} />;
}
