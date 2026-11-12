import { translateSection, type RuntimeMenuV4, type SectionNode } from "@jelly/storefront-schema";
import { CardCartContext, CardCompareContext, CardRatingsContext } from "./product-card";
import { createElement } from "react";
import { getSectionDefinition, sectionLabel } from "@jelly/storefront-registry";
import {
  defaultSectionRenderRegistry,
  type SectionRenderComponent,
  type SectionRenderRegistry,
} from "./render-registry";
import { createStorefrontRuntimeContext } from "./runtime-context";
import { SectionCustomCss, sectionCssProps } from "./section-custom-css";
import { sectionStyleProps } from "./section-style";
import { SectionFrame, sectionFrameWidth, sectionScheme } from "./section-frame";
import type { CommerceDataProvider, RendererMode, RendererSelection, StorefrontPageContext } from "./types";
import { getRecipe, getThemeDefinition, DEFAULT_THEME_ID } from "@jelly/storefront-themes";
import { RecipeSection } from "./sections/recipe-section";

function sectionComponent(themeId: string, type: string, registry: SectionRenderRegistry, version?: string) {
  const override = (id: string, requestedVersion?: string) => { try { return getThemeDefinition(id, requestedVersion).sectionOverrides[type]; } catch { return undefined; } };
  // Theme overrides consume the same runtime props with a looser commerce type.
  const component = override(themeId, version) ?? override(DEFAULT_THEME_ID) ?? registry.get(type);
  // A section a theme described as data is drawn by the recipe renderer.
  return (component ?? (type.startsWith(`${themeId}/`) && getRecipe(type, version) ? RecipeSection : undefined)) as SectionRenderComponent | undefined;
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
  themeVersion,
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
  themeVersion?: string;
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

  const RenderComponent = sectionComponent(themeId ?? DEFAULT_THEME_ID, section.type, registry, themeVersion);
  const context = createStorefrontRuntimeContext({ mode, region, themeVersion, commerce, page, menus, storeSlug, collectionLinks, resourceLinks });
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
  // With an element of the section selected, only that element is outlined (by the editor), not the section.
  const isSelected = selected?.kind === "section" && selected.sectionId === section.id && !selected.elementId;
  return <SectionFrame
    width={sectionFrameWidth(section.settings)}
    scheme={sectionScheme(section.settings)}
    data-testid={`section-${section.type}`}
    data-section-type={section.type}
    {...sectionCssProps(section)}
    {...sectionStyleProps(section.settings, section.responsive?.mobile, section.responsive?.tablet)}
    {...(editor ? { "data-editor-section-id": section.id, "data-editor-label": getSectionDefinition(section.type, themeVersion)?.label ?? sectionLabel(section.type), "data-editor-selected": String(isSelected) } : {})}
    onClick={editor ? (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target as HTMLElement;
      const block = target.closest<HTMLElement>("[data-editor-block-id]");
      const element = target.closest<HTMLElement>("[data-editor-element]");
      const blockId = block?.dataset.editorBlockId;
      // The innermost target wins: both are ancestors of the click, so the element is inner unless it wraps the block.
      // A block that draws a whole section (a Main product part) is selected as one piece.
      const blockHasNoParts = block?.dataset.editorBlockElements === "none" && Boolean(element && block.contains(element));
      if (element?.dataset.editorElement && !blockHasNoParts && (!block || !element.contains(block))) {
        const elementId = element.dataset.editorElement;
        // Inside a block it is the block's part (a column's heading); otherwise the section's own (the nth product card).
        const owner: HTMLElement = block ?? event.currentTarget;
        const copies = [...owner.querySelectorAll<HTMLElement>("[data-editor-element]")].filter((item) => item.dataset.editorElement === elementId && item.parentElement?.closest("[data-editor-block-id]") === (block ?? null));
        const elementIndex = Math.max(0, copies.indexOf(element));
        onSelect?.(block && blockId
          ? { kind: "block", region, sectionId: section.id, blockId, elementId, elementIndex }
          : { kind: "section", region, sectionId: section.id, elementId, elementIndex });
        return;
      }
      onSelect?.(blockId
        ? { kind: "block", region, sectionId: section.id, blockId, fieldKey: block?.dataset.editorFieldKey }
        : { kind: "section", region, sectionId: section.id });
    } : undefined}
  ><SectionCustomCss section={section} /><CardCartContext.Provider value={editor ? undefined : commerce.cart}><CardRatingsContext.Provider value={commerce.ratings}><CardCompareContext.Provider value={editor ? undefined : commerce.compare}>{content}</CardCompareContext.Provider></CardRatingsContext.Provider></CardCartContext.Provider></SectionFrame>;
}
