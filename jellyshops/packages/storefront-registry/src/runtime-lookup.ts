import type { ElementDefinition } from "./types.js";
import { BLOCK_ELEMENTS, SECTION_ELEMENTS } from "./element-data.js";
import { sectionLabel } from "./labels.js";
import { BLOCK_CONTROL_TYPES, SECTION_CONTROL_TYPES } from "./control-types.generated.js";

/**
 * What store pages need to know about a section or block while drawing it, without loading the registry (whose
 * definitions are built from zod schemas: about a fifth of a store page's JavaScript). When the full registry is
 * loaded (the editor, the backend, tests), it plugs itself in here and every answer comes from the real definitions,
 * including sections themes register; otherwise answers come from tables generated from the built-in definitions
 * (`node scripts/generate-control-types.mjs`, a test checks they match).
 */
interface RuntimeDefinition { label?: string; controls?: ReadonlyArray<{ key: string; type: string }>; elements?: ElementDefinition[] }
interface RuntimeDefinitionLookup {
  section(type: string, themeVersion?: string | null): RuntimeDefinition | undefined;
  block(type: string): RuntimeDefinition | undefined;
  sectionTypes(): string[];
}

let lookup: RuntimeDefinitionLookup | undefined;
const addedControlTypes = new Map<string, Record<string, string>>();

/** Called once by the full registry when it loads. */
export function setRuntimeDefinitionLookup(next: RuntimeDefinitionLookup): void { lookup = next; }

/** Control types of a section a theme adds at run time (recipes), for store pages without the registry. */
export function setRuntimeSectionControlTypes(type: string, types: Record<string, string> | undefined): void {
  if (types) addedControlTypes.set(type, types); else addedControlTypes.delete(type);
}

const asMap = (controls: ReadonlyArray<{ key: string; type: string }> | undefined) => new Map((controls ?? []).map((control) => [control.key, control.type]));

/** Setting key to control type, for the settings whose type changes how a looked-up value is shown. */
export function sectionControlTypes(type: string, themeVersion?: string | null): Map<string, string> {
  if (lookup) return asMap(lookup.section(type, themeVersion)?.controls);
  return new Map(Object.entries(SECTION_CONTROL_TYPES[type] ?? addedControlTypes.get(type) ?? {}));
}
export function blockControlTypes(type: string): Map<string, string> {
  if (lookup) return asMap(lookup.block(type)?.controls);
  return new Map(Object.entries(BLOCK_CONTROL_TYPES[type] ?? {}));
}

/** The parts of a section (or block) the editor can select, and that carry their own style settings. */
export function sectionElementList(type: string): ElementDefinition[] {
  return (lookup ? lookup.section(type)?.elements : undefined) ?? SECTION_ELEMENTS[type] ?? [];
}
export function blockElementList(type: string): ElementDefinition[] {
  return (lookup ? lookup.block(type)?.elements : undefined) ?? BLOCK_ELEMENTS[type] ?? [];
}

/** The name the editor shows for a section. */
export function sectionDisplayLabel(type: string, themeVersion?: string | null): string {
  return lookup?.section(type, themeVersion)?.label ?? sectionLabel(type);
}

/** Every section type the full registry knows (empty on store pages, which never need the list). */
export function runtimeSectionTypes(): string[] { return lookup?.sectionTypes() ?? []; }
