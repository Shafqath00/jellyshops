import { expect, it } from "vitest";
import { listSectionDefinitions, validateSectionAgainstRegistry } from "./registry";
import { SECTION_STYLE_CONTROLS } from "./section-style";

const shared = new Set(SECTION_STYLE_CONTROLS.map(({ key }) => key));
/** What a merchant sees on opening a section: not Advanced, not an older setting, not waiting for another choice. */
const upFront = (controls: typeof SECTION_STYLE_CONTROLS) => controls.filter((control) => control.group !== "advanced" && !control.legacy && !control.showWhen);

it("shows every section the same four universal settings; the rest of the shared styling is under Advanced", () => {
  expect(upFront(SECTION_STYLE_CONTROLS).map(({ label }) => label)).toEqual(["Colour scheme", "Width", "Spacing", "Show on"]);
  // Exact spacing appears only for Spacing > Custom (or while an older exact value is saved).
  for (const key of ["stylePaddingTop", "stylePaddingBottom"]) {
    expect(SECTION_STYLE_CONTROLS.find((control) => control.key === key)).toMatchObject({ showWhen: { key: "styleSpacing", equals: "custom" }, visibleWhenSaved: true });
  }
  for (const key of ["styleColors", "styleBackground", "styleText", "styleGradientColor", "styleHeadingFont", "styleHeadingSize", "styleBodyFont", "styleShadow", "styleOpacity", "styleMinHeight", "customCss"]) {
    expect(SECTION_STYLE_CONTROLS.find((control) => control.key === key)?.group, key).toBe("advanced");
  }
  for (const definition of listSectionDefinitions()) {
    const visibleShared = upFront(definition.controls).filter(({ key }) => shared.has(key)).map(({ key }) => key);
    expect(visibleShared, definition.type).toEqual(["styleScheme", "styleWidth", "styleSpacing", "styleShowOn"]);
  }
});

it("keeps saved values from before the settings model valid", () => {
  const section = (settings: Record<string, unknown>) => ({ id: "s1", type: "rich-text", enabled: true, settings, blocks: [] });
  // Older saves: named spacing, exact padding without Custom, own colours, heading size.
  expect(validateSectionAgainstRegistry(section({ styleSpacing: "small", stylePaddingTop: 40, styleColors: true, styleBackground: "#112233", styleHeadingSize: "large" }), "home")).toEqual([]);
  // New choices.
  expect(validateSectionAgainstRegistry(section({ styleSpacing: "custom", stylePaddingTop: 24, styleWidth: "narrow" }), "home")).toEqual([]);
  expect(validateSectionAgainstRegistry(section({ styleWidth: "huge" }), "home")[0]?.code).toBe("SETTINGS_INVALID");
});
