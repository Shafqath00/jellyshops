import { jellyDiodePreview } from "@/features/theme-preview/configs";
import { ThemePreviewPage } from "@/features/theme-preview/theme-preview-page";

/** Jelly Diode style guide and template previews. */
export default function DiodePreviewPage() {
  return <ThemePreviewPage config={jellyDiodePreview} />;
}
