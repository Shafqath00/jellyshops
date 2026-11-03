import { translateSection, type RuntimeMenuV4, type SectionNode } from "@jelly/storefront-schema";
import { createElement } from "react";
import { sectionLabel } from "@jelly/storefront-registry";
import {
  defaultSectionRenderRegistry,
  type SectionRenderComponent,
  type SectionRenderRegistry,
} from "./render-registry";
import { createStorefrontRuntimeContext } from "./runtime-context";
import { SectionCustomCss, sectionCssProps } from "./section-custom-css";
import { sectionStyleProps } from "./section-style";
import type { CommerceDataProvider, RendererMode, RendererSelection, StorefrontPageContext } from "./types";
import { getRecipe, getThemeDefinition, DEFAULT_THEME_ID } from "@jelly/storefront-themes";
import { RecipeSection } from "./sections/recipe-section";

function sectionComponent(themeId: string, type: string, registry: SectionRenderRegistry) {
  const override = (id: string) => { try { return getThemeDefinition(id).sectionOverrides[type]; } catch { return undefined; } };
  // Theme overrides consume the same runtime props with a looser commerce type.
  const component = override(themeId) ?? override(DEFAULT_THEME_ID) ?? registry.get(type);
  // A section a theme described as data is drawn by the recipe renderer.
  return (component ?? (getRecipe(type) ? RecipeSection : undefined)) as SectionRenderComponent | undefined;
}

export function RegistrySectionRenderer({
  section: sourceSection,
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
  collectionLinks,
  resourceLinks,
  language,
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
  collectionLinks?: Record<string, string>;
  resourceLinks?: Record<string, string>;
  /** Shows the section's text in this language when it has a translation (null/undefined = main language). */
  language?: string | null;
}) {
  if (!sourceSection.enabled) return null;
  const section = translateSection(sourceSection, language);

  const RenderComponent = sectionComponent(themeId ?? DEFAULT_THEME_ID, section.type, registry);
  const context = createStorefrontRuntimeContext({ mode, region, commerce, page, menus, storeSlug, collectionLinks, resourceLinks });
  const content = RenderComponent
    ? createElement(RenderComponent, {
      section,
      mode,
      commerce,
      context,
      ...(mode === "editor" && selected?.kind === "block" && selected.sectionId === section.id
        ? { selectedBlockId: selected.blockId }
        : {}),
    })
    : mode !== "published"
      ? <aside role="status">Unsupported section: {section.type}</aside>
      : null;
  if (!content) return null;

  const editor = mode === "editor";
  const isSelected = selected?.kind === "section" && selected.sectionId === section.id;
  return <div
    data-testid={`section-${section.type}`}
    {...sectionCssProps(section)}
    {...sectionStyleProps(section.settings, section.responsive?.mobile, section.responsive?.tablet)}
    {...(editor ? { "data-editor-section-id": section.id, "data-editor-label": sectionLabel(section.type), "data-editor-selected": String(isSelected) } : {})}
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
  ><SectionCustomCss section={section} />{content}</div>;
}
