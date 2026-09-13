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

function dynamicBinding(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { kind?: unknown; binding?: unknown };
  if (candidate.kind !== "dynamic") return null;
  const parsed = dynamicBindingSchema.safeParse(candidate.binding);
  return parsed.success ? parsed.data : null;
}

export function listDynamicBindings(section: CompilerSectionNode): DynamicBindingOccurrence[] {
  const occurrences: DynamicBindingOccurrence[] = [];
  for (const [fieldKey, value] of Object.entries(section.settings)) {
    const binding = dynamicBinding(value);
    if (binding) {
      occurrences.push({
        sectionId: section.id,
        sectionType: section.type,
        fieldKey,
        binding,
      });
    }
  }
  for (const block of section.blocks ?? []) {
    for (const [fieldKey, value] of Object.entries(block.settings)) {
      const binding = dynamicBinding(value);
      if (binding) {
        occurrences.push({
          sectionId: section.id,
          sectionType: section.type,
          blockId: block.id,
          blockType: block.type,
          fieldKey,
          binding,
        });
      }
    }
  }
  return occurrences;
}
