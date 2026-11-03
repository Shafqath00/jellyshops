import { customCssProblem, isRichTextDocument, MAX_BLOCK_DEPTH, translationsProblem, type BlockNode, type PageType, type SectionNode } from "@jelly/storefront-schema";
import { z } from "zod";
import { blockDefinitions } from "./blocks.js";
import { commerceSections } from "./sections/commerce.js";
import { contentSections } from "./sections/content.js";
import { layoutSections } from "./sections/layout.js";
import { productExtraSections } from "./sections/product-extras.js";
import { sectionStyleSchema, withSectionStyleControls } from "./section-style.js";
import type { ControlDefinition, RegionName, RegistryValidationIssue, SectionDefinition } from "./types.js";

function prepareSection(definition: SectionDefinition): SectionDefinition {
  return {
    ...definition,
    // Every section gets the shared style settings (colours, fonts, sizes, alignment, spacing).
    controls: withSectionStyleControls(definition.controls),
    settingsSchema: z.intersection(definition.settingsSchema, sectionStyleSchema),
    allowedRegions: definition.type === "header" || definition.type === "announcement-bar"
      ? ["header"]
      : definition.type === "footer"
        ? ["footer"]
        : ["template"],
  };
}
const sections: SectionDefinition[] = [...layoutSections, ...contentSections, ...commerceSections, ...productExtraSections].map(prepareSection);
const sectionDefinitions = new Map(sections.map((definition) => [definition.type, definition]));

const NAMESPACED_TYPE = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/;
/**
 * Adds a section type from outside the built-in set (an integration or a theme). The type must be
 * namespaced `vendor/name` so it can never shadow a built-in section, and can be registered once.
 * It gets the same shared style controls as every other section and is validated the same way.
 */
export function registerSection(definition: SectionDefinition): void {
  if (!NAMESPACED_TYPE.test(definition.type)) throw new Error(`Section type "${definition.type}" must be written vendor/name, for example "acme/size-guide".`);
  if (sectionDefinitions.has(definition.type)) throw new Error(`Section type "${definition.type}" is already registered.`);
  const prepared = prepareSection(definition);
  sections.push(prepared);
  sectionDefinitions.set(prepared.type, prepared);
}

export function getSectionDefinition(type: string): SectionDefinition | undefined { return sectionDefinitions.get(type); }
export function getBlockDefinition(type: string) { return blockDefinitions.get(type); }
/** Every block definition, in registration order. */
export function listBlockDefinitions() { return [...blockDefinitions.values()]; }

/**
 * The block types a block at `depth` (1 = placed in the section) may hold.
 * Blocks that hold blocks themselves (groups) are left out at the last level,
 * where they could hold nothing.
 */
export function allowedChildBlockTypes(blockType: string, depth: number): string[] {
  const allowed = blockDefinitions.get(blockType)?.allowedBlockTypes;
  if (!allowed || depth >= MAX_BLOCK_DEPTH) return [];
  return depth + 1 >= MAX_BLOCK_DEPTH ? allowed.filter((type) => !blockDefinitions.get(type)?.allowedBlockTypes) : allowed;
}
export function listSectionDefinitions(): SectionDefinition[] { return [...sections]; }
export function listSectionDefinitionsForPage(pageType: PageType, region: RegionName = "template"): SectionDefinition[] {
  return sections.filter((definition) => definition.supportedPages.includes(pageType) && (definition.allowedRegions ?? ["template"]).includes(region));
}

/** Rich text settings keep a formatted copy under `<key>Doc` next to the plain text; it must be a real document. */
function formattedCopiesValid(settings: Record<string, unknown>): boolean {
  return Object.entries(settings).every(([key, value]) => !key.endsWith("Doc") || value === undefined || value === null || isRichTextDocument(value));
}

export function validateSectionAgainstRegistry(section: SectionNode, pageType: PageType): RegistryValidationIssue[] {
  const definition = getSectionDefinition(section.type);
  if (!definition) return [{ code: "SECTION_NOT_REGISTERED", sectionId: section.id, message: `Section ${section.type} is not registered` }];

  const issues: RegistryValidationIssue[] = [];
  if (!definition.supportedPages.includes(pageType)) issues.push({ code: "SECTION_NOT_ALLOWED_ON_PAGE", sectionId: section.id, message: `${section.type} is not allowed on ${pageType}` });
  if (!definition.settingsSchema.safeParse(section.settings).success || !formattedCopiesValid(section.settings)) {
    // Custom CSS is the one setting merchants type freely, so say what is wrong with it.
    const cssProblem = typeof section.settings.customCss === "string" ? customCssProblem(section.settings.customCss) : null;
    issues.push({ code: "SETTINGS_INVALID", sectionId: section.id, message: cssProblem ? `Custom CSS: ${cssProblem}` : "Section settings are invalid" });
  }
  for (const device of ["mobile", "tablet"] as const) {
    const values = section.responsive?.[device];
    if (!values) continue;
    const allowed = new Set([...definition.responsiveFields, ...mobileSettingKeys(definition.controls)]);
    for (const field of Object.keys(values)) {
      if (!allowed.has(field)) issues.push({ code: "RESPONSIVE_FIELD_NOT_ALLOWED", sectionId: section.id, field, message: `${field} cannot be overridden on ${device}` });
    }
    if (!definition.settingsSchema.safeParse({ ...section.settings, ...values }).success) issues.push({ code: "SETTINGS_INVALID", sectionId: section.id, message: `Section ${device === "mobile" ? "phone" : "tablet"} settings are invalid` });
  }
  if ((definition.maxBlocks !== undefined && section.blocks.length > definition.maxBlocks) || (definition.minBlocks !== undefined && section.blocks.length < definition.minBlocks)) {
    issues.push({ code: "BLOCK_LIMIT_EXCEEDED", sectionId: section.id, message: "Section block limit exceeded" });
  }
  const translationProblem = translationsProblem(section.settings.translations, new Set(translatableKeys(definition.controls)));
  if (translationProblem) issues.push({ code: "SETTINGS_INVALID", sectionId: section.id, message: `Translations: ${translationProblem}` });
  issues.push(...validateBlocks(section.blocks, definition.allowedBlockTypes, section.type, section.id, 1));
  return issues;
}

/** Text settings never translated even though they are typed as text. */
const NEVER_TRANSLATED = new Set(["customCss", "url", "metaobject", "provider", "href", "link", "videoUrl"]);

/** Settings that can have text in other languages: text, long text and formatted text. */
export function translatableKeys(controls: ControlDefinition[]): string[] {
  return controls.filter((control) => (control.type === "text" || control.type === "textarea" || control.type === "rich-text") && control.translatable !== false && !NEVER_TRANSLATED.has(control.key)).map((control) => control.key);
}

/** Settings with a separate phone value (controls marked `mobile`). */
export function mobileSettingKeys(controls: ControlDefinition[]): string[] {
  return controls.filter((control) => control.mobile).map((control) => control.key);
}

/** Checks blocks and, for groups, the blocks inside them (one level deep). */
function validateBlocks(blocks: BlockNode[], allowed: string[], owner: string, sectionId: string, depth: number): RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];
  for (const block of blocks) {
    if (!allowed.includes(block.type)) {
      issues.push({ code: "BLOCK_NOT_ALLOWED", sectionId, blockId: block.id, message: `${block.type} is not allowed in ${owner}` });
      continue;
    }
    const blockDefinition = getBlockDefinition(block.type);
    if (!blockDefinition || !blockDefinition.settingsSchema.safeParse(block.settings).success || !formattedCopiesValid(block.settings)) issues.push({ code: "SETTINGS_INVALID", sectionId, blockId: block.id, message: "Block settings are invalid" });
    const blockTranslationProblem = blockDefinition ? translationsProblem(block.settings.translations, new Set(translatableKeys(blockDefinition.controls))) : null;
    if (blockTranslationProblem) issues.push({ code: "SETTINGS_INVALID", sectionId, blockId: block.id, message: `Translations: ${blockTranslationProblem}` });
    for (const device of ["mobile", "tablet"] as const) {
      const values = block.responsive?.[device];
      if (!values || !blockDefinition) continue;
      const allowedKeys = new Set(mobileSettingKeys(blockDefinition.controls));
      for (const field of Object.keys(values)) {
        if (!allowedKeys.has(field)) issues.push({ code: "RESPONSIVE_FIELD_NOT_ALLOWED", sectionId, blockId: block.id, field, message: `${field} cannot be overridden on ${device}` });
      }
      if (!blockDefinition.settingsSchema.safeParse({ ...block.settings, ...values }).success) issues.push({ code: "SETTINGS_INVALID", sectionId, blockId: block.id, message: `Block ${device === "mobile" ? "phone" : "tablet"} settings are invalid` });
    }
    const children = block.blocks ?? [];
    if (children.length === 0) continue;
    if (!blockDefinition?.allowedBlockTypes || depth >= MAX_BLOCK_DEPTH) {
      issues.push({ code: "BLOCK_NOT_ALLOWED", sectionId, blockId: block.id, message: `${block.type} cannot hold other blocks` });
      continue;
    }
    if (blockDefinition.maxBlocks !== undefined && children.length > blockDefinition.maxBlocks) issues.push({ code: "BLOCK_LIMIT_EXCEEDED", sectionId, blockId: block.id, message: "Block limit exceeded" });
    issues.push(...validateBlocks(children, allowedChildBlockTypes(block.type, depth), block.type, sectionId, depth + 1));
  }
  return issues;
}
