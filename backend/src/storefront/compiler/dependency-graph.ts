import type { DynamicBinding, RuntimeDependencyEdgeV4 } from "@jelly/storefront-schema";
import { listDynamicBindings, listTemplateSections } from "./traversal.js";
import type { StorefrontCompilationInput } from "./types.js";

export interface StorefrontDependencyGraph {
  edges: RuntimeDependencyEdgeV4[];
}

function addMediaReferences(
  value: unknown,
  add: (mediaId: string) => void,
  seen = new Set<unknown>(),
): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => addMediaReferences(item, add, seen));
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.type === "media" && typeof record.id === "string" && record.id) add(record.id);
  Object.values(record).forEach((item) => addMediaReferences(item, add, seen));
}

function metafieldBinding(binding: DynamicBinding): Extract<DynamicBinding, { kind: "metafield" }> | null {
  if (binding.kind === "metafield") return binding;
  if (binding.kind === "metaobject_field") return metafieldBinding(binding.source);
  return null;
}

function walkMenuItems(items: unknown[], visit: (kind: string, resourceId: string) => void): void {
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as { target?: unknown; children?: unknown };
    if (record.target && typeof record.target === "object" && !Array.isArray(record.target)) {
      const target = record.target as { kind?: unknown; resourceId?: unknown };
      if (typeof target.kind === "string" && typeof target.resourceId === "string") {
        visit(target.kind, target.resourceId);
      }
    }
    if (Array.isArray(record.children)) walkMenuItems(record.children, visit);
  }
}

export function buildDependencyGraph(input: StorefrontCompilationInput): StorefrontDependencyGraph {
  const edges = new Map<string, RuntimeDependencyEdgeV4>();
  const add = (edge: RuntimeDependencyEdgeV4) => {
    const key = `${edge.from.type}:${edge.from.id}>${edge.reason}>${edge.to.type}:${edge.to.id}`;
    edges.set(key, edge);
  };

  for (const template of input.templates) {
    for (const placement of template.layout.sections) {
      if (placement.kind === "global") {
        add({
          from: { type: "template", id: template.id },
          to: { type: "global_section", id: placement.globalSectionId },
          reason: "placement",
        });
      }
    }

    for (const visit of listTemplateSections(input, template)) {
      const from = visit.source === "global"
        ? { type: "global_section" as const, id: visit.globalSectionId! }
        : { type: "template" as const, id: template.id };

      for (const occurrence of listDynamicBindings(visit.section)) {
        const metafield = metafieldBinding(occurrence.binding);
        if (!metafield) continue;
        const definition = input.metafieldDefinitions.find((candidate) =>
          candidate.ownerType === metafield.resource
          && candidate.namespace === metafield.namespace
          && candidate.key === metafield.key,
        );
        if (!definition) continue;
        add({ from, to: { type: "metafield_definition", id: definition.id }, reason: "binding" });
        if (occurrence.binding.kind === "metaobject_field" && definition.metaobjectDefinitionId) {
          add({
            from,
            to: { type: "metaobject_definition", id: definition.metaobjectDefinitionId },
            reason: "binding",
          });
        }
      }

      addMediaReferences(visit.section.settings, (mediaId) => {
        add({ from, to: { type: "media", id: mediaId }, reason: "media" });
      });
      for (const block of visit.section.blocks ?? []) {
        addMediaReferences(block.settings, (mediaId) => {
          add({ from, to: { type: "media", id: mediaId }, reason: "media" });
        });
      }
    }
  }

  for (const menu of input.menus) {
    walkMenuItems(menu.items, (kind, resourceId) => {
      if (!["product", "collection", "page", "blog", "article"].includes(kind)) return;
      add({
        from: { type: "menu", id: menu.id },
        to: { type: "resource", id: `${kind}:${resourceId}` },
        reason: "navigation",
      });
    });
  }

  for (const assignment of input.assignments) {
    add({
      from: { type: "assignment", id: `${assignment.resourceType}:${assignment.resourceId}` },
      to: { type: "template", id: assignment.templateId },
      reason: "template_assignment",
    });
  }

  if (input.theme.artifactId) {
    add({
      from: { type: "theme", id: "active" },
      to: { type: "extension", id: input.theme.artifactId },
      reason: "extension",
    });
  }

  return { edges: [...edges.values()].sort((a, b) => {
    const left = `${a.from.type}:${a.from.id}:${a.reason}:${a.to.type}:${a.to.id}`;
    const right = `${b.from.type}:${b.from.id}:${b.reason}:${b.to.type}:${b.to.id}`;
    return left.localeCompare(right);
  }) };
}
