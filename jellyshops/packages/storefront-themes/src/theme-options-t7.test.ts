import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getThemeDefinition } from "./theme-registry";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens";
import { resolveTheme, validateThemeSettings } from "./theme-resolver";
import { resolveThemeStyleTokens, themeRootAttributes } from "./theme-style-settings";
import "./theme-registry-checks";

/** Template plan T7 part 3: pop-ups and drawers, icons, collection cards, blog post cards and prices. */
const themes = ["jelly-signature", "jelly-avenue", "jelly-resthaven", "jelly-diode", "jelly-halo", "jelly-forma", "jelly-harbour"];
const tokensFor = (themeId: string, settings: Record<string, unknown> = {}) => resolveStorefrontThemeTokens(themeId, resolveTheme(themeId, settings).settings);
const css = readFileSync(resolve(__dirname, "../../../src/app/themes/storefront-base.css"), "utf8");
const everything = {
  dialogs: { radius: "rounded", shadow: "strong", overlay: "dark" },
  icons: { weight: "bold", ends: "square" },
  collectionCards: { radius: "large", textPosition: "over", overlay: "light" },
  blogCards: { style: "outlined", radius: "soft" },
  prices: { compareAt: "was", sale: "sale" },
};

describe("theme options (T7 part 3)", () => {
  it("adds the five settings groups to every theme", () => {
    for (const id of themes) {
      const schema = (getThemeDefinition(id).manifest as { settingsSchema: Array<{ id: string; group?: string }> }).settingsSchema;
      const groups = new Set(schema.map((setting) => setting.group));
      for (const group of ["Pop-ups and drawers", "Icons", "Collection cards", "Blog post cards", "Prices"]) expect(groups.has(group), `${id} ${group}`).toBe(true);
    }
  });

  it("changes nothing for an untouched store", () => {
    for (const id of themes) {
      const tokens = tokensFor(id);
      expect(tokens["--jelly-theme-options"], id).toBeUndefined();
      expect(Object.keys(tokens).filter((key) => /^--jelly-(dialog|icon|collection|blog)-/.test(key)), id).toEqual([]);
    }
  });

  it("turns each choice into a flag on the theme root, and every flag has a rule", () => {
    expect(validateThemeSettings("jelly-avenue", everything)).toEqual([]);
    const tokens = resolveThemeStyleTokens(everything, undefined);
    const flags = themeRootAttributes(tokens)["data-theme-options"]?.split(" ") ?? [];
    expect(flags.sort()).toEqual(["blog-radius", "blog-style-outlined", "collection-radius", "collection-text-over", "dialog-overlay", "dialog-radius", "dialog-shadow", "icon-ends", "icon-weight", "price-compare-was", "price-sale-sale"]);
    expect(tokens["--jelly-collection-overlay"]).toBe("0.25");
    expect(tokens["--jelly-icon-joins"]).toBe("miter");
    for (const flag of flags) expect(css, flag).toContain(`[data-theme-options~="${flag}"][data-theme-options~="${flag}"][data-theme-options~="${flag}"]`);
    // Every other choice has a rule too.
    for (const flag of ["collection-text-below", "blog-style-plain", "blog-style-filled", "price-compare-strike", "price-compare-hide"]) expect(css, flag).toContain(`[data-theme-options~="${flag}"]`);
  });

  it("ignores values it does not know and the theme settings check refuses them", () => {
    expect(resolveThemeStyleTokens({ dialogs: { radius: "huge" }, prices: { compareAt: "blink" } }, undefined)["--jelly-theme-options"]).toBeUndefined();
    expect(validateThemeSettings("jelly-signature", { dialogs: { radius: "huge" } }).map((issue) => issue.path)).toEqual(["dialogs.radius"]);
  });
});
