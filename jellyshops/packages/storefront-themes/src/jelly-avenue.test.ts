import { expect, it } from "vitest";
import { getThemeDefinition, isCompleteStorefrontTheme } from "./theme-registry";
import { resolveTheme, validateThemeManifest, validateThemeSettings } from "./theme-resolver";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens";

it("registers Jelly Avenue with editorial defaults and a 1440px page width", () => {
  const theme = resolveTheme("jelly-avenue");
  expect(theme.id).toBe("jelly-avenue");
  expect(theme.version).toBe("1.0.0");
  expect(theme.settings).toMatchObject({ colors: { primary: "#2b2f33", background: "#ffffff" }, typography: { headingFont: "Inter", headingWeight: 500 }, layout: { contentWidth: 1440 }, productCard: { gridSpacing: "none" } });
  const manifest = validateThemeManifest(getThemeDefinition("jelly-avenue").manifest);
  expect(manifest.settingsSchema.map((item) => item.id)).toEqual(expect.arrayContaining(["colors.surface", "productCard.gridSpacing", "typography.headingWeight", "branding.logoUrl"]));
  expect(validateThemeSettings("jelly-avenue", theme.settings)).toEqual([]);
});

it("is a complete storefront theme, like Jelly Minimal", () => {
  expect(isCompleteStorefrontTheme("jelly-avenue")).toBe(true);
  expect(isCompleteStorefrontTheme("jelly-signature")).toBe(true);
  expect(isCompleteStorefrontTheme("minimal")).toBe(false);
  expect(isCompleteStorefrontTheme(undefined)).toBe(false);
});

it("turns the product spacing setting into a grid gap token", () => {
  expect(resolveStorefrontThemeTokens("jelly-avenue", { productCard: { gridSpacing: "none" } })["--jelly-grid-gap"]).toBe("0px");
  expect(resolveStorefrontThemeTokens("jelly-avenue", { productCard: { gridSpacing: "small" } })["--jelly-grid-gap"]).toBe("12px");
  expect(resolveStorefrontThemeTokens("jelly-avenue", { productCard: { gridSpacing: "large" } })["--jelly-grid-gap"]).toBe("32px");
  expect(resolveStorefrontThemeTokens("jelly-signature", {})["--jelly-grid-gap"]).toBeUndefined();
});
