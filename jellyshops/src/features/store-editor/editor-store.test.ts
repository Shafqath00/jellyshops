import { expect, it } from "vitest";
import { createDefaultStoreDesign } from "@jelly/storefront-schema";
import { createEditorState, moveSection, setTheme } from "./editor-store";

it("preserves Hero content when selecting a theme", () => {
  const state = createEditorState(createDefaultStoreDesign());
  const hero = state.document.pages.home.sections[0];

  const updated = setTheme(state, "elegant");

  expect(updated.document.theme.id).toBe("elegant");
  expect(updated.document.pages.home.sections[0]).toEqual(hero);
});

it("moves a Home section in the outline", () => {
  const state = createEditorState(createDefaultStoreDesign());
  const [hero, grid] = state.document.pages.home.sections;

  const updated = moveSection(state, "home", hero.id, "down");

  expect(updated.document.pages.home.sections).toEqual([grid, hero]);
});
