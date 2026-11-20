import { expressBedPreview } from "@/features/theme-preview/express-bed-preview";
import { ThemePreviewPage } from "@/features/theme-preview/theme-preview-page";

/** Express Bed (a store on Resthaven) before it is installed: its own layouts, settings and test products. */
export default function ExpressBedPreviewPage() {
  return <ThemePreviewPage config={expressBedPreview} />;
}
