import { expect, it } from "vitest";
import { getThemeDefinition } from "./theme-registry";
import { validateThemeSettings } from "./theme-resolver";
import { contrastRatio } from "./theme-style-settings";
import { applyThemeStyle, listThemeStyles } from "./theme-styles";

const defaults = (themeId: string) => structuredClone((getThemeDefinition(themeId as never).manifest as { settingsDefaults: Record<string, unknown> }).settingsDefaults);
const get = (settings: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], settings);

it("ships four designer styles for Jelly Minimal, Jelly Avenue and Resthaven, none for other themes", () => {
  expect(listThemeStyles("jelly-signature").map((style) => style.name)).toEqual(["Warm sand", "Ink and paper", "Sage", "Blush"]);
  expect(listThemeStyles("jelly-avenue").map((style) => style.name)).toEqual(["Gallery", "Midnight", "Stone", "Coastal"]);
  expect(listThemeStyles("jelly-resthaven").map((style) => style.name)).toEqual(["Midnight oat", "Heather", "Sage linen", "Charcoal and stone"]);
  expect(listThemeStyles("jelly-diode")).toEqual([]);
  expect(listThemeStyles(undefined)).toEqual([]);
});

it("makes each theme's first style its default look", () => {
  for (const themeId of ["jelly-signature", "jelly-avenue", "jelly-resthaven"]) {
    const base = defaults(themeId);
    expect(applyThemeStyle(base, listThemeStyles(themeId)[0]), themeId).toEqual(base);
  }
});

it("gives every style settings the theme accepts, readable colours, and the dark scheme in the theme's dark slot", () => {
  for (const [themeId, darkSlot] of [["jelly-signature", "scheme4"], ["jelly-avenue", "scheme3"], ["jelly-resthaven", "scheme4"]] as const) {
    for (const style of listThemeStyles(themeId)) {
      const settings = applyThemeStyle(defaults(themeId), style);
      expect(validateThemeSettings(themeId, settings), `${themeId} ${style.id}`).toEqual([]);
      const colors = settings.colors as Record<string, string>;
      expect(contrastRatio(colors.text, colors.background), `${style.id} text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.secondary, colors.background), `${style.id} soft text`).toBeGreaterThanOrEqual(4.5);
      for (const scheme of ["scheme1", "scheme2", "scheme3", "scheme4"]) {
        const values = get(settings, `colorSchemes.${scheme}`) as Record<string, string>;
        expect(contrastRatio(values.text, values.background), `${style.id} ${scheme} text`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(values.buttonText, values.button), `${style.id} ${scheme} button`).toBeGreaterThanOrEqual(4.5);
      }
      // The older "Dark" background maps to this slot, so it must stay the contrasting scheme.
      const dark = get(settings, `colorSchemes.${darkSlot}.background`) as string;
      expect(contrastRatio(dark, colors.background), `${style.id} dark slot`).toBeGreaterThanOrEqual(3);
    }
  }
});

it("changes only the settings a style names and keeps the store's other choices", () => {
  const base = { ...defaults("jelly-signature"), productCard: { radius: "rounded" }, branding: { logoUrl: "https://cdn.example.com/logo.png" } };
  const sage = listThemeStyles("jelly-signature").find((style) => style.id === "sage")!;
  const result = applyThemeStyle(base, sage);
  expect(get(result, "colors.primary")).toBe("#3f5a3a");
  expect(get(result, "typography.headingFont")).toBe("Lora");
  expect(get(result, "typography.headingSize")).toBe(get(base, "typography.headingSize"));
  expect(result.productCard).toEqual({ radius: "rounded" });
  expect(result.branding).toEqual({ logoUrl: "https://cdn.example.com/logo.png" });
  expect(get(base, "colors.primary")).toBe("#1c1b19");
});
