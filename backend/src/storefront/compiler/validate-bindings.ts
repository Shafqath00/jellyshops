import {
  isDynamicValueTypeCompatible,
  type CompilationDiagnostic,
} from "@jelly/storefront-schema";
import {
  listDynamicBindings,
  listInvalidDynamicSettings,
  listTemplateSections,
} from "./traversal.js";
import type {
  CompilerDynamicSourceResolver,
  CompilerRegistry,
  StorefrontCompilationInput,
} from "./types.js";

export async function validateBindings(
  input: StorefrontCompilationInput,
  registry: CompilerRegistry,
  sources: CompilerDynamicSourceResolver,
): Promise<CompilationDiagnostic[]> {
  const diagnostics: CompilationDiagnostic[] = [];
  for (const template of input.templates) {
    for (const visit of listTemplateSections(input, template)) {
      for (const invalid of listInvalidDynamicSettings(visit.section)) {
        diagnostics.push({
          severity: "error",
          code: "DYNAMIC_SOURCE_INVALID",
          message: invalid.message,
          location: {
            entityType: visit.source === "global" ? "global_section" : "template",
            entityId: visit.source === "global" ? visit.globalSectionId : template.id,
            sectionId: invalid.sectionId,
            ...(invalid.blockId ? { blockId: invalid.blockId } : {}),
            fieldKey: invalid.fieldKey,
          },
        });
      }

      for (const occurrence of listDynamicBindings(visit.section)) {
        const expectedType = registry.dynamicSettingType(
          occurrence.sectionType,
          occurrence.fieldKey,
          occurrence.blockType,
        );
        if (!expectedType) continue;
        try {
          const source = await sources.describeBinding(input.storeId, occurrence.binding, template.type);
          if (!isDynamicValueTypeCompatible(expectedType, source.valueType)) {
            diagnostics.push({
              severity: "error",
              code: "DYNAMIC_SOURCE_TYPE_MISMATCH",
              message: `Setting expects ${expectedType} but dynamic source returns ${source.valueType}`,
              location: {
                entityType: visit.source === "global" ? "global_section" : "template",
                entityId: visit.source === "global" ? visit.globalSectionId : template.id,
                sectionId: occurrence.sectionId,
                ...(occurrence.blockId ? { blockId: occurrence.blockId } : {}),
                fieldKey: occurrence.fieldKey,
              },
            });
          }
        } catch (error) {
          diagnostics.push({
            severity: "error",
            code: "DYNAMIC_SOURCE_INVALID",
            message: error instanceof Error ? error.message : "Dynamic source is invalid",
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
  }
  return diagnostics;
}
