import type { RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";
import { createElement } from "react";
import {
  defaultSectionRenderRegistry,
  type SectionRenderComponent,
  type SectionRenderRegistry,
} from "./render-registry";
import { createStorefrontRuntimeContext } from "./runtime-context";
import type { CommerceDataProvider, RendererMode, RendererSelection, StorefrontPageContext } from "./types";
import { getThemeDefinition, DEFAULT_THEME_ID } from "@jelly/storefront-themes";

function sectionComponent(themeId: string, type: string, registry: SectionRenderRegistry) {
  const override = (id: string) => { try { return getThemeDefinition(id).sectionOverrides[type]; } catch { return undefined; } };
  // Theme overrides consume the same runtime props with a looser commerce type.
  return (override(themeId) ?? override(DEFAULT_THEME_ID) ?? registry.get(type)) as SectionRenderComponent | undefined;
}

export function RegistrySectionRenderer({
  section,
  mode,
  commerce,
  region,
  selected,
  onSelect,
  registry = defaultSectionRenderRegistry,
  themeId,
  page,
  menus,
  storeSlug,
}: {
  section: SectionNode;
  mode: RendererMode;
  commerce: CommerceDataProvider;
  region?: "header" | "template" | "footer";
  selected?: RendererSelection | null;
  onSelect?: (selection: RendererSelection) => void;
  registry?: SectionRenderRegistry;
  themeId?: string;
  page?: StorefrontPageContext;
  menus?: Record<string, RuntimeMenuV4>;
  storeSlug?: string;
}) {
  if (!section.enabled) return null;

  const RenderComponent = sectionComponent(themeId ?? DEFAULT_THEME_ID, section.type, registry);
  const context = createStorefrontRuntimeContext({ mode, region, commerce, page, menus, storeSlug });
  const content = RenderComponent
    ? createElement(RenderComponent, { section, mode, commerce, context })
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
