import { expect, it } from "vitest";
import { cloneLocalIds } from "./clone-local-ids.js";
it("refreshes real inline placements and keeps media and shared references intact", () => {
  const result = cloneLocalIds({ sections: [{ kind: "inline", section: { id: "section-a", settings: { image: { id: "media-a" } }, blocks: [{ id: "block-a" }] } }, { kind: "global", globalSectionId: "global-a" }] });
  const sections = result.sections as Array<{ section: { id: string; settings: { image: { id: string } }; blocks: Array<{ id: string }> }; globalSectionId?: string }>;
  expect(sections[0].section.id).not.toBe("section-a");
  expect(sections[0].section.blocks[0].id).not.toBe("block-a");
  expect(sections[0].section.settings.image.id).toBe("media-a");
  expect(sections[1].globalSectionId).toBe("global-a");
});
