import { chromeGroupOf, dynamicBindingSchema, groupedSectionIds, SECTION_GROUP_KEYS, type SectionGroupKey } from "@jelly/storefront-schema";
import type {
  CompilerBlockNode,
  CompilerSectionNode,
  CompilerTemplateInput,
  DynamicBindingOccurrence,
  StorefrontCompilationInput,
} from "./types.js";

export interface TemplateSectionVisit {
  template: CompilerTemplateInput;
  section: CompilerSectionNode;
  source: "inline" | "global";
  globalSectionId?: string;
  /** Set for a section in a shared group: it is drawn on every page, so it is checked against the group. */
  group?: SectionGroupKey;
}

export interface InvalidDynamicSettingOccurrence {
  sectionId: string;
  sectionType: string;
  blockId?: string;
  blockType?: string;
  fieldKey: string;
  message: string;
}

export function listTemplateSections(
  input: StorefrontCompilationInput,
  template: CompilerTemplateInput,
): TemplateSectionVisit[] {
  const globals = new Map(input.globalSections.map((global) => [global.id, global]));
  const visits: TemplateSectionVisit[] = [];
  // With saved groups the page draws the groups and leaves out the template's own header and footer (as the
  // storefront's expandRawRuntimeLayout does), so the checks follow what is drawn.
  const groups = input.sectionGroups;
  const grouped = groupedSectionIds(groups);
  const groupVisits = (keys: readonly SectionGroupKey[]) => keys.flatMap((group) => (groups?.[group] ?? []).flatMap((id) => {
    const global = globals.get(id);
    return global ? [{ template, section: global.section, source: "global" as const, globalSectionId: id, group }] : [];
  }));
  visits.push(...groupVisits(["header"]));
  for (const placement of template.layout.sections) {
    if (placement.kind === "inline") {
      if (groups && chromeGroupOf(placement.section.type)) continue;
      visits.push({ template, section: placement.section, source: "inline" });
      continue;
    }
    if (grouped.has(placement.globalSectionId)) continue;
    const global = globals.get(placement.globalSectionId);
    if (global && groups && chromeGroupOf(global.section.type)) continue;
    if (global) {
      visits.push({
        template,
        section: global.section,
        source: "global",
        globalSectionId: global.id,
      });
    }
  }
  visits.push(...groupVisits(SECTION_GROUP_KEYS.filter((key) => key !== "header")));
  return visits;
}

function parseDynamicBinding(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { kind: "not-dynamic" as const };
  const candidate = value as { kind?: unknown; binding?: unknown };
  if (candidate.kind !== "dynamic") return { kind: "not-dynamic" as const };
  const parsed = dynamicBindingSchema.safeParse(candidate.binding);
  return parsed.success
    ? { kind: "valid" as const, binding: parsed.data }
    : { kind: "invalid" as const, message: parsed.error.issues.map(({ message }) => message).join("; ") };
}

/** Every block in the section, including blocks inside groups. */
export function listSectionBlocks(section: CompilerSectionNode): CompilerBlockNode[] {
  const walk = (blocks: CompilerBlockNode[]): CompilerBlockNode[] => blocks.flatMap((block) => [block, ...walk(block.blocks ?? [])]);
  return walk(section.blocks ?? []);
}

export function listDynamicBindings(section: CompilerSectionNode): DynamicBindingOccurrence[] {
  const occurrences: DynamicBindingOccurrence[] = [];
  const add = (
    fieldKey: string,
    value: unknown,
    block?: { id: string; type: string },
  ) => {
    const parsed = parseDynamicBinding(value);
    if (parsed.kind !== "valid") return;
    occurrences.push({
      sectionId: section.id,
      sectionType: section.type,
      ...(block ? { blockId: block.id, blockType: block.type } : {}),
      fieldKey,
      binding: parsed.binding,
    });
  };

  for (const [fieldKey, value] of Object.entries(section.settings)) add(fieldKey, value);
  for (const block of listSectionBlocks(section)) {
    for (const [fieldKey, value] of Object.entries(block.settings)) add(fieldKey, value, block);
  }
  return occurrences;
}

export function listInvalidDynamicSettings(section: CompilerSectionNode): InvalidDynamicSettingOccurrence[] {
  const occurrences: InvalidDynamicSettingOccurrence[] = [];
  const add = (
    fieldKey: string,
    value: unknown,
    block?: { id: string; type: string },
  ) => {
    const parsed = parseDynamicBinding(value);
    if (parsed.kind !== "invalid") return;
    occurrences.push({
      sectionId: section.id,
      sectionType: section.type,
      ...(block ? { blockId: block.id, blockType: block.type } : {}),
      fieldKey,
      message: parsed.message,
    });
  };

  for (const [fieldKey, value] of Object.entries(section.settings)) add(fieldKey, value);
  for (const block of listSectionBlocks(section)) {
    for (const [fieldKey, value] of Object.entries(block.settings)) add(fieldKey, value, block);
  }
  return occurrences;
}
