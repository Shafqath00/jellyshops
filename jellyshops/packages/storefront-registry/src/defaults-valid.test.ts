import { describe, expect, it } from "vitest";
import { createPresetSection, createSectionFromDefinition, listSectionPresets } from "./presets";
import { listSectionDefinitions, validateSectionAgainstRegistry } from "./registry";

/**
 * A section added from the library must be savable as it is. The settings fuzz found "Spacer and divider", whose
 * default size (a number from its slider) its own schema refused.
 */
let counter = 0;
const id = () => `defaults-${++counter}`;

describe("every section can be saved as added", () => {
  it.each(listSectionDefinitions().map((definition) => [definition.type, definition] as const))("%s with its defaults", (_type, definition) => {
    const section = createSectionFromDefinition(definition.type, id);
    expect(validateSectionAgainstRegistry(section, definition.supportedPages[0]!).map((issue) => issue.message)).toEqual([]);
  });

  it.each(listSectionPresets().map((preset) => [preset.id, preset] as const))("preset %s", (_id, preset) => {
    expect(() => createPresetSection(preset.id, id)).not.toThrow();
  });
});
