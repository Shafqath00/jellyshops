import { expect, it } from "vitest";
import { resolveTheme } from "./theme-resolver";
import { getThemeDefinition } from "./theme-registry";
import { validateThemeManifest } from "./theme-resolver";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens";

it("registers Jelly Minimal (id jelly-signature) with editable branded tokens and a 1280px container", () => {
  expect(getThemeDefinition("jelly-signature").tokens.spacing.container).toBe("80rem");
  const theme = resolveTheme("jelly-signature");
  expect(theme.settings).toMatchObject({ colors: { primary: "#1c1b19", background: "#faf9f7", accent: "#ece7de" }, layout: { contentWidth: 1280 } });
  expect(validateThemeManifest(getThemeDefinition("jelly-signature").manifest).settingsSchema.map((item) => item.id)).toEqual(expect.arrayContaining(["colors.secondary", "branding.faviconUrl", "typography.headingWeight", "layout.contentWidth"]));
});

it("applies numeric typography, secondary colors and width controls to actual CSS tokens", () => {
  const tokens = resolveStorefrontThemeTokens("jelly-signature", { colors: { secondary: "#123456" }, typography: { headingWeight: 700, bodySize: 18 }, layout: { contentWidth: 1152, sectionGap: 64 } });
  expect(tokens).toMatchObject({ "--jelly-container-width": "1152px", "--jelly-spacing-section": "64px", "--jelly-color-secondary": "#123456", "--jelly-heading-weight": "700", "--jelly-body-size": "18px" });
});

it("keeps the version that existing publications pin so they do not fall back to the default theme", () => {
  expect(resolveTheme("jelly-signature", {}, "1.0.0").id).toBe("jelly-signature");
});
