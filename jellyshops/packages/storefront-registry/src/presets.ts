import type { SectionNode } from "@jelly/storefront-schema";
import { listSectionDefinitions, validateSectionAgainstRegistry } from "./registry.js";
import type { SectionPreset } from "./types.js";

export function listSectionPresets(): SectionPreset[] {
  return listSectionDefinitions().flatMap((definition) =>
    (definition.presets ?? []).map((preset) => ({ ...preset, sectionType: definition.type })),
  );
}

export function createPresetSection(presetId: string, createId: () => string): SectionNode {
  const preset = listSectionPresets().find((item) => item.id === presetId);
  if (!preset) throw new Error(`Unknown section preset: ${presetId}`);
  const definition = listSectionDefinitions().find((item) => item.type === preset.sectionType);
  if (!definition) throw new Error(`Section definition is missing: ${preset.sectionType}`);
  const section = createSectionFromDefinition(definition.type, createId);
  const issues = validateSectionAgainstRegistry(section, "home");
  if (issues.length) throw new Error(`Invalid section preset: ${presetId}`);
  return section;
}

export function createSectionFromDefinition(sectionType: string, createId: () => string): SectionNode {
  const definition = listSectionDefinitions().find((item) => item.type === sectionType);
  if (!definition) throw new Error(`Section definition is missing: ${sectionType}`);
  const section: SectionNode = {
    id: createId(),
    type: definition.type,
    enabled: true,
    settings: structuredClone(definition.defaultSettings),
    blocks: definition.defaultBlocks.map((block) => ({ ...structuredClone(block), id: createId() })),
  };
  return section;
}
