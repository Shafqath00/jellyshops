import type { CompilationDiagnostic, DynamicBinding, DynamicResourceType } from "@jelly/storefront-schema";
import { listDynamicBindings, listTemplateSections } from "./traversal.js";
import type { StorefrontCompilationInput } from "./types.js";

function baseResource(binding: DynamicBinding): DynamicResourceType {
  return binding.kind === "metaobject_field" ? baseResource(binding.source) : binding.resource;
}

function requiredContext(resource: DynamicResourceType): string | "any" {
  if (resource === "store") return "any";
  if (resource === "variant") return "product";
  return resource;
}

export function validateContext(input: StorefrontCompilationInput): CompilationDiagnostic[] {
  const diagnostics: CompilationDiagnostic[] = [];
  for (const template of input.templates) {
    for (const visit of listTemplateSections(input, template)) {
      for (const occurrence of listDynamicBindings(visit.section)) {
        const required = requiredContext(baseResource(occurrence.binding));
        if (required === "any" || required === template.type) continue;
        diagnostics.push({
          severity: "error",
          code: "INVALID_TEMPLATE_CONTEXT",
          message: `Dynamic source requires ${required} context but is placed in ${template.type}`,
          location: {
            entityType: visit.source === "global" ? "global_section" : "template",
            entityId: visit.source === "global" ? visit.globalSectionId : template.id,
            sectionId: occurrence.sectionId,
            ...(occurrence.blockId ? { blockId: occurrence.blockId } : {}),
            fieldKey: occurrence.fieldKey,
          },
        });
      }
    }
  }
  return diagnostics;
}
