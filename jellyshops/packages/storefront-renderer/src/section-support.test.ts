import { describe, expect, it } from "vitest";
import { listSectionPresets } from "@jelly/storefront-registry";
import { isRenderableHomeSection } from "./section-support";

describe("editor preset renderer support", () => {
  it("renders every section exposed by an editor preset", () => {
    expect(listSectionPresets().every((preset) => isRenderableHomeSection(preset.sectionType))).toBe(true);
  });
});
