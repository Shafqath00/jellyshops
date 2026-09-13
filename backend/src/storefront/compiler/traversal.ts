import { dynamicBindingSchema } from "@jelly/storefront-schema";
import type {
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
  for (const placement of template.layout.sections) {
    if (placement.kind === "inline") {
      visits.push({ template, section: placement.section, source: "inline" });
      continue;
    }
    const global = globals.get(placement.globalSectionId);
    if (global) {
      visits.push({
        template,
        section: global.section,
        source: "global",
        globalSectionId: global.id,
      });
    }
  }
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
  for (const block of section.blocks ?? []) {
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
  for (const block of section.blocks ?? []) {
    for (const [fieldKey, value] of Object.entries(block.settings)) add(fieldKey, value, block);
  }
  return occurrences;
}
