import { createPresetSection, createSectionFromDefinition, listSectionPresets, type PresetCategory, type SectionDefinition } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import type { BuiltInSectionOption } from "./components/section-library";
import { displayName, sectionCategoryLabels } from "./editor-page-helpers";

/** One line under each Add section choice that has no designed preset of its own. */
const SECTION_BLURBS: Record<string, string> = {
  "announcement-bar": "A short message across the top of every page.",
  "slideshow": "Several large photos that turn by themselves.",
  "image-banner": "A wide photo with a heading and a button.",
  "featured-collection": "Products from one collection.",
  "collection-list": "Tiles that link to your collections.",
  "faq": "Questions and answers that open one at a time.",
  "testimonials": "What customers say about you.",
  "newsletter": "A sign-up box for your emails.",
  "rich-text": "A heading and paragraphs of text.",
  "custom-content": "Build your own: headings, text, buttons, images, video.",
  "trust-badges": "Short promises such as free delivery or easy returns.",
  "rating": "Your star rating and review count.",
  "photo-gallery": "A grid of photos.",
  "logo-list": "Logos of brands or press that feature you.",
  "contact-store-info": "Your address, opening hours and ways to get in touch.",
  "recently-viewed": "Products the shopper looked at recently.",
  "spacer": "Empty space between sections.",
  "divider": "A thin line between sections.",
  "video": "A video from YouTube, Vimeo or a file.",
  "apps": "A map, booking form or other embed.",
};

/** Add section groups, most used first; spacing helpers last. */
export const LIBRARY_CATEGORY_ORDER = ["Banners", "Products", "Content", "Marketing", "Layout"];

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
    : [{ id: definition.type, name: definition.label ?? displayName(definition.type), category: sectionCategoryLabels[definition.category], ...(SECTION_BLURBS[definition.type] ? { description: SECTION_BLURBS[definition.type] } : {}) }]);
}

/** A new section for an Add section choice: the preset's design when the id is a preset, otherwise the section's defaults. */
export function createLibrarySection(id: string, createId: () => string, themeVersion?: string): SectionNode {
  return listSectionPresets(themeVersion).some((preset) => preset.id === id)
    ? createPresetSection(id, createId, themeVersion)
    : createSectionFromDefinition(id, createId, themeVersion);
}
