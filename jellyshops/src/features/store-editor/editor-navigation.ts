import type { StorefrontTemplateType } from "./api/types";

const resourceTypes = new Set<StorefrontTemplateType>(["product", "collection", "page", "blog", "article"]);

export interface EditorNavigationTarget {
  templateId?: string;
  resourceType?: StorefrontTemplateType;
  resourceId?: string;
}

export function parseEditorNavigationTarget(search: string): EditorNavigationTarget {
  const params = new URLSearchParams(search);
  const templateId = params.get("templateId")?.trim() || undefined;
  const resourceType = params.get("resourceType")?.trim() || undefined;
  const resourceId = params.get("resourceId")?.trim() || undefined;
  const target: EditorNavigationTarget = {};
  if (templateId) target.templateId = templateId;
  if (resourceType && resourceId && resourceTypes.has(resourceType as StorefrontTemplateType)) {
    target.resourceType = resourceType as StorefrontTemplateType;
    target.resourceId = resourceId;
  }
  return target;
}
