import type { SectionNode } from "@jelly/storefront-schema";
import {
  defaultSectionRenderRegistry,
  type SectionRenderRegistry,
} from "./render-registry";
import { createStorefrontRuntimeContext } from "./runtime-context";
import type { CommerceDataProvider, RendererMode, RendererSelection } from "./types";
import { getThemeDefinition, DEFAULT_THEME_ID } from "@jelly/storefront-themes";

export function RegistrySectionRenderer({
  section,
  mode,
  commerce,
  region,
  selected,
  onSelect,
  registry = defaultSectionRenderRegistry,
  themeId,
}: {
  section: SectionNode;
  mode: RendererMode;
  commerce: CommerceDataProvider;
  region?: "header" | "template" | "footer";
  selected?: RendererSelection | null;
  onSelect?: (selection: RendererSelection) => void;
  registry?: SectionRenderRegistry;
  themeId?: string;
}) {
  if (!section.enabled) return null;

  const override = (id: string) => { try { return getThemeDefinition(id).sectionOverrides[section.type]; } catch { return undefined; } };
  const RenderComponent = override(themeId ?? DEFAULT_THEME_ID) ?? override(DEFAULT_THEME_ID) ?? registry.get(section.type);
  const context = createStorefrontRuntimeContext({ mode, region, commerce });
  const content = RenderComponent
    ? <RenderComponent section={section} mode={mode} commerce={commerce} context={context} />
    : mode !== "published"
      ? <aside role="status">Unsupported section: {section.type}</aside>
      : null;
  if (!content) return null;

  const editor = mode === "editor";
  const isSelected = selected?.kind === "section" && selected.sectionId === section.id;
  return <div
    data-testid={`section-${section.type}`}
    {...(editor ? { "data-editor-section-id": section.id, "data-editor-selected": String(isSelected) } : {})}
    onClick={editor ? (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target as HTMLElement;
      const block = target.closest<HTMLElement>("[data-editor-block-id]");
      const blockId = block?.dataset.editorBlockId;
      onSelect?.(blockId
        ? { kind: "block", region, sectionId: section.id, blockId, fieldKey: block?.dataset.editorFieldKey }
        : { kind: "section", region, sectionId: section.id });
    } : undefined}
  >{content}</div>;
}
