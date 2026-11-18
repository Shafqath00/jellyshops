import { describe, expect, it } from "vitest";
import { getThemeDefinition } from "./theme-registry";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens";
import { resolveTheme, validateThemeSettings } from "./theme-resolver";
import { COLOR_SCHEME_IDS, colorSchemeSource, contrastRatio, resolveThemeStyleTokens, themeRootAttributes } from "./theme-style-settings";
import "./theme-registry-checks";

/** Template plan T7 part 1: up to 16 colour schemes with optional secondary button, border and soft text colours. */
const themes = ["jelly-signature", "jelly-avenue", "jelly-resthaven", "jelly-diode", "jelly-halo", "jelly-forma", "jelly-harbour"];
const tokensFor = (themeId: string, settings: Record<string, unknown> = {}) => resolveStorefrontThemeTokens(themeId, resolveTheme(themeId, settings).settings);

describe("colour schemes (T7)", () => {
  it("offers sixteen schemes; the extra ones start as copies of the theme's own", () => {
    expect(COLOR_SCHEME_IDS).toHaveLength(16);
    expect(colorSchemeSource("scheme12")).toBe("scheme4");
    expect(colorSchemeSource("scheme2")).toBe("scheme2");
    for (const id of themes) {
      const tokens = tokensFor(id);
      for (let n = 1; n <= 16; n += 1) expect(tokens[`--jelly-scheme-${n}-bg`], `${id} scheme ${n}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(tokens["--jelly-scheme-12-bg"]).toBe(tokens["--jelly-scheme-4-bg"]);
      const schema = (getThemeDefinition(id).manifest as { settingsSchema: Array<{ id: string; default?: unknown; options?: Array<{ value: string }> }> }).settingsSchema;
      const count = schema.find((setting) => setting.id === "colorSchemes.count");
      expect(count?.options?.map((option) => option.value)).toContain("16");
      // A folder theme listing only some schemes still shows its own colours in the extra ones.
      const extra = schema.find((setting) => setting.id === "colorSchemes.scheme9.background")?.default;
      expect(extra, id).toBe(schema.find((setting) => setting.id === "colorSchemes.scheme1.background")?.default);
    }
  });

  it("leaves untouched stores exactly as before: no optional colour or secondary style tokens", () => {
    for (const id of themes) {
      const tokens = tokensFor(id);
      expect(Object.keys(tokens).filter((key) => /-(secondary|on-secondary|border|muted)$/.test(key) && key.startsWith("--jelly-scheme-")), id).toEqual([]);
      expect(tokens["--jelly-secondary-button-style"]).toBeUndefined();
      expect(themeRootAttributes(tokens)["data-secondary-button"]).toBeUndefined();
    }
  });

  it("writes a scheme's own colours, kept readable on its background, for all sixteen schemes", () => {
    const colorSchemes = Object.fromEntries(COLOR_SCHEME_IDS.map((id) => [id, { background: "#1d2333", text: "#f7f3ee", button: "#f7f3ee", buttonText: "#1d2333", secondaryButton: "#2b3140", border: "#556070", muted: "#30384a" }]));
    expect(validateThemeSettings("jelly-signature", { colorSchemes: { count: "16", ...colorSchemes } })).toEqual([]);
    const tokens = resolveThemeStyleTokens({ colorSchemes }, undefined);
    for (let n = 1; n <= 16; n += 1) {
      const background = tokens[`--jelly-scheme-${n}-bg`];
      expect(tokens[`--jelly-scheme-${n}-border`]).toBe("#556070");
      // Too-dark secondary and soft text on a dark background fall back to readable colours (WCAG AA).
      expect(contrastRatio(tokens[`--jelly-scheme-${n}-muted`], background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens[`--jelly-scheme-${n}-secondary`], background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens[`--jelly-scheme-${n}-on-secondary`], "#2b3140")).toBeGreaterThanOrEqual(4.5);
    }
    // A readable choice is kept as it is.
    expect(resolveThemeStyleTokens({ colorSchemes: { scheme3: { background: "#ffffff", text: "#111111", button: "#111111", buttonText: "#ffffff", muted: "#595959" } } }, undefined)["--jelly-scheme-3-muted"]).toBe("#595959");
  });

  it("marks the theme root with the chosen secondary button style", () => {
    const tokens = tokensFor("jelly-avenue", { buttons: { secondaryStyle: "soft" } });
    expect(tokens["--jelly-secondary-button-style"]).toBe("soft");
    expect(themeRootAttributes(tokens)).toEqual({ "data-card-layout": undefined, "data-card-fit": undefined, "data-secondary-button": "soft" });
    expect(themeRootAttributes({ "--jelly-secondary-button-style": "glow" })["data-secondary-button"]).toBeUndefined();
    expect(validateThemeSettings("jelly-avenue", { buttons: { secondaryStyle: "glow" } }).map((issue) => issue.path)).toEqual(["buttons.secondaryStyle"]);
  });
});
