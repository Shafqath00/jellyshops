import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { listSectionDefinitions, validateSectionAgainstRegistry } from "./registry.js";
import type { SectionPreset } from "./types.js";

export function listSectionPresets(themeVersion?: string): SectionPreset[] {
  return listSectionDefinitions(themeVersion).flatMap((definition) =>
    (definition.presets ?? []).map((preset) => ({ ...preset, sectionType: definition.type })),
  );
}

/**
 * A new section from a preset: the section's defaults with the preset's settings on top, and the preset's blocks (or
 * the section's default blocks) with new ids at every level. Throws for an unknown preset or one the registry refuses.
 */
export function createPresetSection(presetId: string, createId: () => string, themeVersion?: string): SectionNode {
  const preset = listSectionPresets(themeVersion).find((item) => item.id === presetId);
  if (!preset) throw new Error(`Unknown section preset: ${presetId}`);
  const definition = listSectionDefinitions(themeVersion).find((item) => item.type === preset.sectionType);
  if (!definition) throw new Error(`Section definition is missing: ${preset.sectionType}`);
  const base = createSectionFromDefinition(definition.type, createId, themeVersion);
  const section: SectionNode = {
    ...base,
    settings: { ...base.settings, ...structuredClone(preset.settings ?? {}) },
    blocks: preset.blocks ? preset.blocks.map((block) => withNewIds(block, createId)) : base.blocks,
  };
  const issues = validateSectionAgainstRegistry(section, "home", undefined, themeVersion);
  if (issues.length) throw new Error(`Invalid section preset: ${presetId} (${issues.map((issue) => issue.message).join("; ")})`);
  return section;
}

function withNewIds(block: BlockNode, createId: () => string): BlockNode {
  const copy = structuredClone(block);
  return { ...copy, id: createId(), ...(copy.blocks ? { blocks: copy.blocks.map((child) => withNewIds(child, createId)) } : {}) };
}

export function createSectionFromDefinition(sectionType: string, createId: () => string, themeVersion?: string): SectionNode {
  const definition = listSectionDefinitions(themeVersion).find((item) => item.type === sectionType);
  if (!definition) throw new Error(`Section definition is missing: ${sectionType}`);
  const section: SectionNode = {
    id: createId(),
    type: definition.type,
    enabled: true,
    settings: structuredClone(definition.defaultSettings),
    blocks: definition.defaultBlocks.map((block) => withNewIds(block, createId)),
  };
  return section;
}
