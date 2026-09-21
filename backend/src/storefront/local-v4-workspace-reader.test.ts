import { describe, expect, it, vi } from "vitest";
import { LocalV4WorkspaceReader, type LocalV4WorkspaceDataSource } from "./local-v4-workspace-reader.js";
import { StorefrontCompilationService } from "./compiler/service.js";
import type { CompilerDynamicSourceResolver, CompilerRegistry } from "./compiler/types.js";
import { WorkspaceGenerationConflictError } from "./workspace/errors.js";

function source(overrides: Partial<LocalV4WorkspaceDataSource> = {}): LocalV4WorkspaceDataSource {
  return {
    getWorkspace: vi.fn(async () => ({ generation: 7, updatedAt: new Date(0) })),
    listTemplates: vi.fn(async () => [{ id: "home-default", storeId: "store-a", revision: 0, type: "home", handle: "default", name: "Home", layout: { sections: [{ kind: "inline", section: { id: "hero", type: "hero", settings: {} } }] }, createdAt: new Date(0), updatedAt: new Date(0) }]),
    listGlobalSections: vi.fn(async () => [{ id: "announcement", storeId: "store-a", revision: 0, name: "Announcement", section: { id: "announcement-section", type: "announcement", settings: {} }, createdAt: new Date(0), updatedAt: new Date(0) }]),
    listMenus: vi.fn(async () => [{ id: "main", storeId: "store-a", revision: 0, name: "Main", handle: "main", items: [], createdAt: new Date(0), updatedAt: new Date(0) }]),
    getThemeConfiguration: vi.fn(async () => ({ storeId: "store-a", revision: 0, themeId: "minimal", themeVersion: "1.0.0", settings: { accent: "pink" }, draftArtifactId: "artifact-a", updatedAt: new Date(0) })),
    listAssignments: vi.fn(async () => [{ storeId: "store-a", resourceType: "product", resourceId: "product-a", revision: 0, templateId: "home-default", updatedAt: new Date(0) }]),
    listResourceIds: vi.fn(async () => ({ products: ["product-a"], collections: ["collection-a"], pages: ["page-a"], blogs: [], articles: [] })),
    listMetafieldDefinitions: vi.fn(async () => []),
    listMetaobjectDefinitions: vi.fn(async () => []),
    ...overrides,
  };
}

describe("LocalV4WorkspaceReader", () => {
  it("feeds a persisted workspace through the existing V4 compiler", async () => {
    const registry: CompilerRegistry = { validateSection: () => [], dynamicSettingType: () => null };
    const sources: CompilerDynamicSourceResolver = { describeBinding: async () => ({ valueType: "string" }) };
    const service = new StorefrontCompilationService(
      new LocalV4WorkspaceReader(source({
        listGlobalSections: vi.fn(async () => []),
        listAssignments: vi.fn(async () => []),
      })),
      registry,
      sources,
      "local-v4",
      () => "registry-a",
    );

    await expect(service.compile("store-a", 7)).resolves.toMatchObject({
      ok: true,
      snapshot: { storeId: "store-a", sourceGeneration: 7 },
    });
  });

  it("reconstructs a complete store-scoped workspace as existing compiler input", async () => {
    const input = await new LocalV4WorkspaceReader(source()).load("store-a", 7, "registry-a");

    expect(input).toMatchObject({
      storeId: "store-a",
      generation: 7,
      registryManifestHash: "registry-a",
      theme: { presetId: "minimal", id: "minimal", version: "1.0.0", settings: { accent: "pink" }, artifactId: "artifact-a" },
      templates: [{ id: "home-default", type: "home", handle: "default" }],
      globalSections: [{ id: "announcement" }],
      menus: [{ id: "main" }],
      assignments: [{ resourceType: "product", resourceId: "product-a", templateId: "home-default" }],
    });
    expect([...input.resourceIds.products]).toEqual(["product-a"]);
    expect([...input.resourceIds.collections]).toEqual(["collection-a"]);
  });

  it("uses only the requested store and never mutates the source", async () => {
    const data = source();
    await new LocalV4WorkspaceReader(data).load("store-a", 7, "registry-a");

    for (const method of Object.values(data)) {
      if (typeof method === "function") expect(method).toHaveBeenCalledWith("store-a");
    }
  });

  it("normalizes absent optional collections to empty compiler collections", async () => {
    const input = await new LocalV4WorkspaceReader(source({
      listMenus: vi.fn(async () => undefined),
      listAssignments: vi.fn(async () => undefined),
      listMetafieldDefinitions: vi.fn(async () => undefined),
      listMetaobjectDefinitions: vi.fn(async () => undefined),
    })).load("store-a", 7, "registry-a");

    expect(input.menus).toEqual([]);
    expect(input.assignments).toEqual([]);
    expect(input.metafieldDefinitions).toEqual([]);
    expect(input.metaobjectDefinitions).toEqual([]);
  });

  it("preserves malformed persisted layouts for compiler validation", async () => {
    const input = await new LocalV4WorkspaceReader(source({
      listTemplates: vi.fn(async () => [{ id: "home-default", storeId: "store-a", revision: 0, type: "home", handle: "default", name: "Home", layout: { sections: [{ kind: "global", globalSectionId: "missing" }] }, createdAt: new Date(0), updatedAt: new Date(0) }]),
    })).load("store-a", 7, "registry-a");

    expect(input.templates[0]?.layout.sections).toEqual([{ kind: "global", globalSectionId: "missing" }]);
  });

  it("rejects expected and observed generation conflicts", async () => {
    await expect(new LocalV4WorkspaceReader(source()).load("store-a", 6, "registry-a"))
      .rejects.toEqual(new WorkspaceGenerationConflictError(7));

    const getWorkspace = vi.fn()
      .mockResolvedValueOnce({ generation: 7, updatedAt: new Date(0) })
      .mockResolvedValueOnce({ generation: 8, updatedAt: new Date(0) });
    await expect(new LocalV4WorkspaceReader(source({ getWorkspace })).load("store-a", 7, "registry-a"))
      .rejects.toEqual(new WorkspaceGenerationConflictError(8));
  });
});
