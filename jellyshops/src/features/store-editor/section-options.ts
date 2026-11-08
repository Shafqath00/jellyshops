import { createPresetSection, createSectionFromDefinition, listSectionPresets, type PresetCategory, type SectionDefinition } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import type { BuiltInSectionOption } from "./components/section-library";
import { displayName, sectionCategoryLabels } from "./editor-page-helpers";

const presetCategoryLabels: Record<PresetCategory, string> = { banners: "Banners", products: "Products", content: "Content", marketing: "Marketing" };

/**
 * The choices in Add section: every designed preset of a section ("Collection list", "Collection list: Bento", …),
 * or the section itself when it has no presets. Presets are grouped by their own category (Banners, Products, …).
 */
export function sectionLibraryOptions(definitions: SectionDefinition[]): BuiltInSectionOption[] {
  return definitions.flatMap((definition) => definition.presets?.length
    ? definition.presets.map((preset) => ({
      id: preset.id,
      name: preset.label,
      category: presetCategoryLabels[preset.category],
      ...(preset.description ? { description: preset.description } : {}),
      ...(preset.thumbnail ? { thumbnail: preset.thumbnail } : {}),
    }))
    : [{ id: definition.type, name: definition.label ?? displayName(definition.type), category: sectionCategoryLabels[definition.category] }]);
}

/** A new section for an Add section choice: the preset's design when the id is a preset, otherwise the section's defaults. */
export function createLibrarySection(id: string, createId: () => string, themeVersion?: string): SectionNode {
  return listSectionPresets(themeVersion).some((preset) => preset.id === id)
    ? createPresetSection(id, createId, themeVersion)
    : createSectionFromDefinition(id, createId, themeVersion);
}
