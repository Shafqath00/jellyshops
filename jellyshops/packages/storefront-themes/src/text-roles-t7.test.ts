import { describe, expect, it } from "vitest";
import { getThemeDefinition } from "./theme-registry";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens";
import { resolveTheme, validateThemeSettings } from "./theme-resolver";
import { contractTokenCss } from "./contract-tokens";
import { TEXT_ROLES, TEXT_STYLE_LEVELS, resolveThemeStyleTokens, textRoleCss, themeRootAttributes } from "./theme-style-settings";
import "./theme-registry-checks";

/** Template plan T7 part 2: Heading 5 and 6, a highlight font and text roles. */
const themes = ["jelly-signature", "jelly-avenue", "jelly-resthaven", "jelly-diode", "jelly-halo", "jelly-forma", "jelly-harbour"];
const tokensFor = (themeId: string, settings: Record<string, unknown> = {}) => resolveStorefrontThemeTokens(themeId, resolveTheme(themeId, settings).settings);
const schemaOf = (id: string) => (getThemeDefinition(id).manifest as { settingsSchema: Array<{ id: string; default?: unknown; options?: Array<{ value: string }> }> }).settingsSchema;

describe("text styles and roles (T7 part 2)", () => {
  it("adds Heading 5 and 6, a highlight font and six text roles to every theme's settings", () => {
    expect(TEXT_STYLE_LEVELS).toContain("h6");
    for (const id of themes) {
      const ids = schemaOf(id).map((setting) => setting.id);
      expect(ids, id).toEqual(expect.arrayContaining(["textStyles.h5.size", "textStyles.h6.textCase", "typography.highlightFont", "textRoles.cardTitle.font", "textRoles.navigation.size", "textRoles.badge.textCase"]));
      expect(schemaOf(id).find((setting) => setting.id === "textStyles.h2.font")?.options?.map((option) => option.value)).toContain("highlight");
    }
  });

  it("writes nothing new for an untouched store", () => {
    for (const id of themes) {
      const tokens = tokensFor(id);
      expect(Object.keys(tokens).filter((key) => key.startsWith("--jelly-role-") || key.startsWith("--jelly-type-h5") || key.startsWith("--jelly-type-h6")), id).toEqual([]);
      expect(tokens["--theme-font-highlight"]).toBeUndefined();
      expect(themeRootAttributes(tokens)["data-type-roles"]).toBeUndefined();
    }
  });

  it("turns a changed role property into a token and lists it on the theme root", () => {
    const tokens = tokensFor("jelly-signature", { typography: { highlightFont: "Playfair Display" }, textRoles: { cardTitle: { font: "highlight", size: "18", textCase: "uppercase" }, navigation: { weight: "600", letterSpacing: "wide" } } });
    expect(tokens["--theme-font-highlight"]).toContain("--font-playfair-display");
    expect(tokens["--jelly-role-card-title-font"]).toBe("var(--theme-font-highlight, var(--theme-font-heading))");
    expect(tokens["--jelly-role-card-title-size"]).toBe("18px");
    expect(tokens["--jelly-role-navigation-weight"]).toBe("600");
    expect(themeRootAttributes(tokens)["data-type-roles"]?.split(" ").sort()).toEqual(["card-title-font", "card-title-size", "card-title-text-case", "navigation-letter-spacing", "navigation-weight"]);
    // Out-of-range or unknown values are ignored, and the theme settings check refuses them.
    expect(resolveThemeStyleTokens({ textRoles: { badge: { size: "99", weight: "950" } } }, undefined)["--jelly-type-roles"]).toBeUndefined();
    expect(validateThemeSettings("jelly-signature", { textRoles: { badge: { size: "99" } } }).map((issue) => issue.path)).toEqual(["textRoles.badge.size"]);
  });

  it("styles Heading 5 and 6 from the theme's text style settings", () => {
    const tokens = tokensFor("jelly-avenue", { textStyles: { h5: { size: 22, font: "highlight" }, h6: { size: 16 } } });
    expect(tokens["--jelly-type-h5-size"]).toBe("22px");
    expect(tokens["--jelly-type-h5-font"]).toBe("var(--theme-font-highlight, var(--theme-font-heading))");
    expect(tokens["--jelly-type-h6-size"]).toBeUndefined();
    expect(contractTokenCss()).toContain("--j-type-h5-size: var(--jelly-type-h5-size, 1.125rem)");
  });

  it("gives every role property one gated rule", () => {
    const css = textRoleCss();
    expect(css.split("\n")).toHaveLength(TEXT_ROLES.length * 5);
    expect(css).toContain('[data-jelly-theme][data-type-roles~="card-title-font"][data-type-roles~="card-title-font"][data-type-roles~="card-title-font"] [data-card-part="title"] { font-family: var(--jelly-role-card-title-font); }');
  });
});
