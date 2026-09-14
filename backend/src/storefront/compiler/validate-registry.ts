import type { CompilationDiagnostic } from "@jelly/storefront-schema";
import { listTemplateSections } from "./traversal.js";
import type { CompilerRegistry, StorefrontCompilationInput } from "./types.js";

export function validateRegistry(
  input: StorefrontCompilationInput,
  registry: CompilerRegistry,
): CompilationDiagnostic[] {
  const diagnostics: CompilationDiagnostic[] = [];
  for (const template of input.templates) {
    for (const visit of listTemplateSections(input, template)) {
      for (const issue of registry.validateSection(visit.section, template.type)) {
        diagnostics.push({
          severity: "error",
          code: issue.code,
          message: issue.message,
          location: {
            entityType: visit.source === "global" ? "global_section" : "template",
            entityId: visit.source === "global" ? visit.globalSectionId : template.id,
            sectionId: issue.sectionId ?? visit.section.id,
            ...(issue.blockId ? { blockId: issue.blockId } : {}),
            ...(issue.fieldKey ? { fieldKey: issue.fieldKey } : {}),
          },
        });
      }
    }
  }
  return diagnostics;
}
