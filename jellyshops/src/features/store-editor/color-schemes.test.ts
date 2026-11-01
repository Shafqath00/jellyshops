import { getSectionDefinition } from "@jelly/storefront-registry";
import { getThemeDefinition } from "@jelly/storefront-themes";
import { expect, it } from "vitest";
import { themeSchemaForPanel, withColorSchemeNames } from "./color-schemes";

const schemeOptions = (themeSettings: Record<string, unknown>, current?: Record<string, unknown>) => {
  const control = withColorSchemeNames(getSectionDefinition("rich-text")!.controls, themeSettings, current).find((item) => item.key === "styleScheme");
  return control && control.type === "select" ? control.options.map((option) => option.label) : [];
};

it("lists the schemes in use by name, keeping a removed scheme a section still uses", () => {
  const settings = { colorSchemes: { count: "5", scheme2: { name: "Sand" }, scheme5: { name: "Night sale" } } };
  expect(schemeOptions(settings)).toEqual(["Theme default", "Scheme 1", "Scheme 2: Sand", "Scheme 3", "Scheme 4", "Scheme 5: Night sale"]);
  expect(schemeOptions({}, { styleScheme: "scheme7" })).toEqual(["Theme default", "Scheme 1", "Scheme 2", "Scheme 3", "Scheme 4", "Scheme 7"]);
});

it("hides the theme settings of schemes beyond the chosen number", () => {
  for (const id of ["jelly-signature", "jelly-avenue"] as const) {
    const schema = (getThemeDefinition(id).manifest as { settingsSchema: Array<{ id: string }> }).settingsSchema;
    const schemes = (settings: Record<string, unknown>) => new Set(themeSchemaForPanel(schema, settings).map((item) => /^colorSchemes\.(scheme\d)\./.exec(item.id)?.[1]).filter(Boolean)).size;
    expect(schemes({})).toBe(4);
    expect(schemes({ colorSchemes: { count: "6" } })).toBe(6);
    expect(themeSchemaForPanel(schema, {}).some((item) => item.id === "colorSchemes.count")).toBe(true);
  }
});
