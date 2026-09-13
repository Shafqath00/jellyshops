import { describe, expect, it } from "vitest";
import { WorkspaceGenerationConflictError } from "../workspace/errors.js";
import { assertCompilationGeneration, parseTemplateLayout } from "./input-loader.js";

describe("compiler input loader helpers", () => {
  it("rejects loading a workspace generation other than the requested generation", () => {
    expect(() => assertCompilationGeneration(9, 8)).toThrow(WorkspaceGenerationConflictError);
  });

  it("parses inline and global section placements without resolving them", () => {
    const layout = parseTemplateLayout({
      sections: [
        { kind: "inline", section: { id: "hero-1", type: "hero", settings: {}, blocks: [] } },
        { kind: "global", globalSectionId: "announcement" },
      ],
    });
    expect(layout.sections).toHaveLength(2);
    expect(layout.sections[1]).toEqual({ kind: "global", globalSectionId: "announcement" });
  });

  it("preserves enabled and responsive metadata for migrated sections and blocks", () => {
    const layout = parseTemplateLayout({
      sections: [{
        kind: "inline",
        section: {
          id: "hero-1",
          type: "hero",
          enabled: false,
          settings: { alignment: "center" },
          responsive: { mobile: { alignment: "left" } },
          blocks: [{
            id: "heading-1",
            type: "heading",
            enabled: false,
            settings: { text: "Hello" },
            responsive: { mobile: { text: "Hi" } },
          }],
        },
      }],
    });

    expect(layout.sections[0]).toMatchObject({
      kind: "inline",
      section: {
        enabled: false,
        responsive: { mobile: { alignment: "left" } },
        blocks: [{ enabled: false, responsive: { mobile: { text: "Hi" } } }],
      },
    });
  });

  it("rejects malformed template layout JSON before validation stages run", () => {
    expect(() => parseTemplateLayout({ sections: [{ kind: "global" }] })).toThrow(/layout/i);
  });
});
