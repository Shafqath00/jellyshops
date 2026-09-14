import { describe, expect, it } from "vitest";
import type { CompilerRegistry, StorefrontCompilationInput } from "./types.js";
import { validateRegistry } from "./validate-registry.js";

function input(): StorefrontCompilationInput {
  return {
    storeId: "store-a",
    generation: 1,
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: [
      {
        id: "home-default",
        type: "home",
        handle: "default",
        name: "Home",
        layout: { sections: [{ kind: "inline", section: { id: "unknown-1", type: "unknown", settings: {} } }] },
      },
    ],
    globalSections: [],
    menus: [],
    assignments: [],
    metafieldDefinitions: [],
    metaobjectDefinitions: [],
    resourceIds: { products: new Set(), collections: new Set(), pages: new Set(), blogs: new Set(), articles: new Set() },
    registryManifestHash: "registry",
  };
}

describe("validateRegistry", () => {
  it("turns registry section issues into navigable compiler diagnostics", () => {
    const registry: CompilerRegistry = {
      validateSection: (section) => [{ code: "SECTION_NOT_REGISTERED", message: "Unknown section", sectionId: section.id }],
      dynamicSettingType: () => null,
    };

    const diagnostics = validateRegistry(input(), registry);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "SECTION_NOT_REGISTERED",
        location: expect.objectContaining({ entityType: "template", entityId: "home-default", sectionId: "unknown-1" }),
      }),
    ]);
  });
});
