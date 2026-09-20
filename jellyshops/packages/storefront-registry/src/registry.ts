import type { PageType, SectionNode } from "@jelly/storefront-schema";
import { blockDefinitions } from "./blocks.js";
import { commerceSections } from "./sections/commerce.js";
import { contentSections } from "./sections/content.js";
import { layoutSections } from "./sections/layout.js";
import type { RegistryValidationIssue, SectionDefinition } from "./types.js";

const sections: SectionDefinition[] = [...layoutSections, ...contentSections, ...commerceSections].map((definition) => ({
  ...definition,
  allowedRegions: definition.type === "header" || definition.type === "announcement-bar"
    ? ["header"]
    : definition.type === "footer"
      ? ["footer"]
      : ["template"],
}));
const sectionDefinitions = new Map(sections.map((definition) => [definition.type, definition]));

export function getSectionDefinition(type: string): SectionDefinition | undefined { return sectionDefinitions.get(type); }
export function getBlockDefinition(type: string) { return blockDefinitions.get(type); }
export function listSectionDefinitions(): SectionDefinition[] { return [...sections]; }

export function validateSectionAgainstRegistry(section: SectionNode, pageType: PageType): RegistryValidationIssue[] {
  const definition = getSectionDefinition(section.type);
  if (!definition) return [{ code: "SECTION_NOT_REGISTERED", sectionId: section.id, message: `Section ${section.type} is not registered` }];

  const issues: RegistryValidationIssue[] = [];
  if (!definition.supportedPages.includes(pageType)) issues.push({ code: "SECTION_NOT_ALLOWED_ON_PAGE", sectionId: section.id, message: `${section.type} is not allowed on ${pageType}` });
  if (!definition.settingsSchema.safeParse(section.settings).success) issues.push({ code: "SETTINGS_INVALID", sectionId: section.id, message: "Section settings are invalid" });
  if (section.responsive?.mobile) {
    for (const field of Object.keys(section.responsive.mobile)) {
      if (!definition.responsiveFields.includes(field)) issues.push({ code: "RESPONSIVE_FIELD_NOT_ALLOWED", sectionId: section.id, field, message: `${field} cannot be overridden on mobile` });
    }
  }
  if ((definition.maxBlocks !== undefined && section.blocks.length > definition.maxBlocks) || (definition.minBlocks !== undefined && section.blocks.length < definition.minBlocks)) {
    issues.push({ code: "BLOCK_LIMIT_EXCEEDED", sectionId: section.id, message: "Section block limit exceeded" });
  }
  for (const block of section.blocks) {
    if (!definition.allowedBlockTypes.includes(block.type)) {
      issues.push({ code: "BLOCK_NOT_ALLOWED", sectionId: section.id, blockId: block.id, message: `${block.type} is not allowed in ${section.type}` });
      continue;
    }
    const blockDefinition = getBlockDefinition(block.type);
    if (!blockDefinition || !blockDefinition.settingsSchema.safeParse(block.settings).success) issues.push({ code: "SETTINGS_INVALID", sectionId: section.id, blockId: block.id, message: "Block settings are invalid" });
  }
  return issues;
}
