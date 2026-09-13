import type { SectionNode } from "@jelly/storefront-schema";
import { expect, it } from "vitest";
import {
  appendGlobalPlacement,
  appendInlineSection,
  detachGlobalPlacement,
  replaceInlineWithGlobal,
} from "./template-layout";

const section: SectionNode = {
  id: "hero-1",
  type: "hero",
  enabled: true,
  settings: { alignment: "left" },
  blocks: [],
};

it("appends presets as detached inline section copies", () => {
  const layout = appendInlineSection({ sections: [] }, section);
  const placement = (layout.sections as Array<{ kind: string; section: SectionNode }>)[0];
  expect(placement.kind).toBe("inline");
  expect(placement.section).toEqual(section);
  expect(placement.section).not.toBe(section);
});

it("stores globals by stable id and can detach back to a local copy", () => {
  const withGlobal = appendGlobalPlacement({ sections: [] }, "global-1");
  expect(withGlobal.sections).toEqual([{ kind: "global", globalSectionId: "global-1" }]);

  const detached = detachGlobalPlacement(withGlobal, "global-1", section);
  expect(detached.sections).toEqual([{ kind: "inline", section }]);
  const detachedSection = (detached.sections as Array<{ kind: string; section: SectionNode }>)[0].section;
  expect(detachedSection).not.toBe(section);
});

it("replaces only the selected inline section when making it global", () => {
  const layout = {
    sections: [
      { kind: "inline", section },
      { kind: "inline", section: { ...section, id: "hero-2" } },
    ],
  };
  expect(replaceInlineWithGlobal(layout, "hero-1", "global-1").sections).toEqual([
    { kind: "global", globalSectionId: "global-1" },
    { kind: "inline", section: expect.objectContaining({ id: "hero-2" }) },
  ]);
});
