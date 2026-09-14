import type { CompilationDiagnostic } from "@jelly/storefront-schema";
import type { StorefrontCompilationInput } from "./types.js";

function resourceExists(
  input: StorefrontCompilationInput,
  type: string,
  id: string,
): boolean {
  switch (type) {
    case "product": return input.resourceIds.products.has(id);
    case "collection": return input.resourceIds.collections.has(id);
    case "page": return input.resourceIds.pages.has(id);
    case "blog": return input.resourceIds.blogs.has(id);
    case "article": return input.resourceIds.articles.has(id);
    default: return true;
  }
}

function walkMenuItems(
  items: unknown[],
  visit: (target: { kind: string; resourceId?: string }) => void,
): void {
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as { target?: unknown; children?: unknown };
    if (candidate.target && typeof candidate.target === "object" && !Array.isArray(candidate.target)) {
      const target = candidate.target as { kind?: unknown; resourceId?: unknown };
      if (typeof target.kind === "string") {
        visit({
          kind: target.kind,
          ...(typeof target.resourceId === "string" ? { resourceId: target.resourceId } : {}),
        });
      }
    }
    if (Array.isArray(candidate.children)) walkMenuItems(candidate.children, visit);
  }
}

export function validateReferences(input: StorefrontCompilationInput): CompilationDiagnostic[] {
  const diagnostics: CompilationDiagnostic[] = [];
  const globalIds = new Set(input.globalSections.map(({ id }) => id));
  const templates = new Map(input.templates.map((template) => [template.id, template]));

  for (const template of input.templates) {
    for (const placement of template.layout.sections) {
      if (placement.kind === "global" && !globalIds.has(placement.globalSectionId)) {
        diagnostics.push({
          severity: "error",
          code: "MISSING_GLOBAL_SECTION",
          message: `Global section ${placement.globalSectionId} does not exist`,
          location: { entityType: "template", entityId: template.id },
        });
      }
    }
  }

  for (const menu of input.menus) {
    walkMenuItems(menu.items, (target) => {
      if (!target.resourceId || !["product", "collection", "page", "blog", "article"].includes(target.kind)) return;
      if (!resourceExists(input, target.kind, target.resourceId)) {
        diagnostics.push({
          severity: "error",
          code: "BROKEN_RESOURCE_REF",
          message: `Menu target ${target.kind}:${target.resourceId} does not exist`,
          location: { entityType: "menu", entityId: menu.id },
        });
      }
    });
  }

  for (const assignment of input.assignments) {
    const template = templates.get(assignment.templateId);
    const resourceValid = resourceExists(input, assignment.resourceType, assignment.resourceId);
    const templateValid = template?.type === assignment.resourceType;
    if (!resourceValid || !templateValid) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_TEMPLATE_ASSIGNMENT",
        message: !resourceValid
          ? `${assignment.resourceType} resource ${assignment.resourceId} does not exist`
          : `Template ${assignment.templateId} is not compatible with ${assignment.resourceType}`,
        location: {
          entityType: "assignment",
          entityId: `${assignment.resourceType}:${assignment.resourceId}`,
        },
      });
    }
  }

  return diagnostics;
}
