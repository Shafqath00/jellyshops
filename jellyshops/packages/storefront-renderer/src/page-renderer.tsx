import type { PageDocument } from "@jelly/storefront-schema";
import { RenderErrorBoundary } from "./render-error-boundary";
import { SectionRenderer } from "./section-renderer";
import type { CommerceDataProvider, RendererMode } from "./types";

export function PageRenderer({ page, mode, commerce, onSectionError }: { page: PageDocument; mode: RendererMode; commerce: CommerceDataProvider; onSectionError?: (sectionId: string, error: unknown) => void }) {
  return <>{page.sections.map((section) => <RenderErrorBoundary key={section.id} onError={(error) => onSectionError?.(section.id, error)} fallback={mode === "preview" ? <aside role="status">Section failed to render</aside> : null}><SectionRenderer section={section} mode={mode} commerce={commerce} /></RenderErrorBoundary>)}</>;
}
