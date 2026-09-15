import {
  runtimeStorefrontSnapshotV4Schema,
  type RuntimeStorefrontSnapshotV4,
} from "@jelly/storefront-schema";
import type { StorefrontDependencyGraph } from "./dependency-graph.js";
import type { StorefrontCompilationInput } from "./types.js";

export function assembleRuntimeSnapshot(
  input: StorefrontCompilationInput,
  dependencies: StorefrontDependencyGraph,
  compilerVersion: string,
): RuntimeStorefrontSnapshotV4 {
  const templates = Object.fromEntries(input.templates.map((template) => [
    template.id,
    {
      id: template.id,
      type: template.type,
      handle: template.handle,
      layout: structuredClone(template.layout),
    },
  ]));
  const globalSections = Object.fromEntries(input.globalSections.map((global) => [
    global.id,
    { id: global.id, section: structuredClone(global.section) },
  ]));
  const menus = Object.fromEntries(input.menus.map((menu) => [
    menu.id,
    { id: menu.id, handle: menu.handle, items: structuredClone(menu.items) },
  ]));
  const templateDefaults = Object.fromEntries(
    input.templates
      .filter(({ handle }) => handle === "default")
      .map(({ type, id }) => [type, id]),
  );

  return runtimeStorefrontSnapshotV4Schema.parse({
    schemaVersion: 4,
    storeId: input.storeId,
    sourceGeneration: input.generation,
    compilerVersion,
    registryManifestHash: input.registryManifestHash,
    theme: {
      presetId: input.theme.presetId,
      settings: structuredClone(input.theme.settings),
      artifactId: input.theme.artifactId,
    },
    templates,
    globalSections,
    menus,
    templateDefaults,
    assignments: input.assignments
      .map((assignment) => ({ ...assignment }))
      .sort((a, b) => `${a.resourceType}:${a.resourceId}`.localeCompare(`${b.resourceType}:${b.resourceId}`)),
    dependencies: {
      edges: dependencies.edges,
    },
  });
}
