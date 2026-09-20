import type { SectionNode } from "@jelly/storefront-schema";
import { expect, it } from "vitest";
import {
  appendBlock,
  appendGlobalPlacement,
  appendInlineSection,
  detachGlobalPlacement,
  movePlacement,
  removeInlineSection,
  replaceInlineWithGlobal,
  setInlineSectionEnabled,
  updateInlineSection,
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

it("updates only the selected inline section and preserves other placements", () => {
  const layout = {
    sections: [
      { kind: "inline", section },
      { kind: "global", globalSectionId: "global-1" },
    ],
  };
  const updated = updateInlineSection(layout, "hero-1", (current) => ({
    ...current,
    settings: { ...current.settings, alignment: "center" },
  }));

  expect(updated.sections).toEqual([
    { kind: "inline", section: expect.objectContaining({ settings: { alignment: "center" } }) },
    { kind: "global", globalSectionId: "global-1" },
  ]);
});

it("adds a detached block to the selected section", () => {
  const block = { id: "button-1", type: "button", enabled: true, settings: { label: "Shop" } };
  const updated = appendBlock({ sections: [{ kind: "inline", section }] }, "hero-1", block);
  const updatedSection = (updated.sections as Array<{ kind: string; section: SectionNode }>)[0].section;

  expect(updatedSection.blocks).toEqual([block]);
  expect(updatedSection.blocks[0]).not.toBe(block);
});

it("removes only the selected inline section", () => {
  const updated = removeInlineSection({
    sections: [
      { kind: "inline", section },
      { kind: "global", globalSectionId: "global-1" },
      { kind: "inline", section: { ...section, id: "hero-2" } },
    ],
  }, "hero-1");

  expect(updated.sections).toEqual([
    { kind: "global", globalSectionId: "global-1" },
    { kind: "inline", section: expect.objectContaining({ id: "hero-2" }) },
  ]);
});

it("reorders placements and preserves hidden section configuration", () => {
  const layout = { sections: [{ kind: "inline", section }, { kind: "inline", section: { ...section, id: "grid-1", enabled: false, settings: { heading: "Keep me" } } }] };
  const moved = movePlacement(layout, "grid-1", "up");
  expect((moved.sections as Array<{ kind: string; section: SectionNode }>)[0]?.section.id).toBe("grid-1");
  const hidden = setInlineSectionEnabled(moved, "grid-1", false);
  expect((hidden.sections as Array<{ kind: string; section: SectionNode }>)[0]?.section).toEqual(expect.objectContaining({ enabled: false, settings: { heading: "Keep me" } }));
});
