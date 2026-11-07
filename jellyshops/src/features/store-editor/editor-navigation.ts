import type { StorefrontTemplateType } from "./api/types";

const resourceTypes = new Set<StorefrontTemplateType>(["product", "collection", "page", "blog", "article"]);

export interface EditorNavigationTarget {
  templateId?: string;
  resourceType?: StorefrontTemplateType;
  resourceId?: string;
  /** A section (and block) of the page's template to select when the editor opens: `?section=…&block=…`. */
  sectionId?: string;
  blockId?: string;
  /** A part of the section (`&element=heading`), when no block is given. */
  elementId?: string;
}

export function parseEditorNavigationTarget(search: string): EditorNavigationTarget {
  const params = new URLSearchParams(search);
  const templateId = params.get("templateId")?.trim() || undefined;
  const resourceType = params.get("resourceType")?.trim() || undefined;
  const resourceId = params.get("resourceId")?.trim() || undefined;
  const sectionId = params.get("section")?.trim() || undefined;
  const blockId = params.get("block")?.trim() || undefined;
  const elementId = params.get("element")?.trim() || undefined;
  const target: EditorNavigationTarget = {};
  if (sectionId) {
    target.sectionId = sectionId;
    if (blockId) target.blockId = blockId;
    else if (elementId) target.elementId = elementId;
  }
  if (templateId) target.templateId = templateId;
  if (resourceType && resourceId && resourceTypes.has(resourceType as StorefrontTemplateType)) {
    target.resourceType = resourceType as StorefrontTemplateType;
    target.resourceId = resourceId;
  }
  return target;
}

/** The address for the current page and selection, keeping any other parameters (resourceType, resourceId…). Returns the new `search` string. */
export function editorSearchFor(search: string, current: { templateId?: string; sectionId?: string; blockId?: string; elementId?: string }): string {
  const params = new URLSearchParams(search);
  const apply = (key: string, value: string | undefined) => { if (value) params.set(key, value); else params.delete(key); };
  apply("templateId", current.templateId);
  apply("section", current.sectionId);
  apply("block", current.sectionId ? current.blockId : undefined);
  apply("element", current.sectionId && !current.blockId ? current.elementId : undefined);
  const next = params.toString();
  return next ? `?${next}` : "";
}
