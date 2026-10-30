import { expect, it } from "vitest";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens";
import { resolveTheme, validateThemeSettings } from "./theme-resolver";

const tokensFor = (themeId: string, settings: Record<string, unknown> = {}) => resolveStorefrontThemeTokens(themeId, resolveTheme(themeId, settings).settings);

it("keeps the theme's own sizes and buttons until the merchant changes them", () => {
  for (const id of ["jelly-signature", "jelly-avenue"]) {
    const tokens = tokensFor(id);
    expect(Object.keys(tokens).filter((key) => key.startsWith("--jelly-type-") || key.startsWith("--jelly-button-"))).toEqual([]);
    // Every scheme resolves to the theme's default colours.
    expect(tokens["--jelly-scheme-1-bg"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(tokens["--jelly-scheme-4-button-text"]).toMatch(/^#[0-9a-f]{6}$/);
  }
});

it("turns changed text styles into responsive size and style tokens", () => {
  const tokens = tokensFor("jelly-signature", { textStyles: { h2: { size: 61, lineHeight: "loose", letterSpacing: "wide", textCase: "uppercase" }, h4: { size: 24, font: "body" }, small: { size: 12 } } });
  expect(tokens["--jelly-type-h2-size"]).toBe("clamp(39px, 5.00vw, 61px)");
  expect(tokens["--jelly-type-h2-line"]).toBe("1.6");
  expect(tokens["--jelly-type-h2-tracking"]).toBe("0.04em");
  expect(tokens["--jelly-type-h2-case"]).toBe("uppercase");
  expect(tokens["--jelly-type-h4-size"]).toBe("24px");
  expect(tokens["--jelly-type-h4-font"]).toBe("var(--theme-font-body)");
  expect(tokens["--jelly-type-small-size"]).toBe("12px");
  expect(tokens["--jelly-type-h3-size"]).toBeUndefined();
});

it("uses saved colour schemes and button settings, ignoring unsafe colours", () => {
  const tokens = tokensFor("jelly-avenue", { colorSchemes: { scheme2: { background: "#123456", text: "red;}" } }, buttons: { size: "large", textCase: "uppercase", borderWidth: "thick", hover: "lift" } });
  expect(tokens["--jelly-scheme-2-bg"]).toBe("#123456");
  expect(tokens["--jelly-scheme-2-text"]).toBe("#2b2f33");
  expect(tokens).toMatchObject({ "--jelly-button-height": "56px", "--jelly-button-padding": "36px", "--jelly-button-case": "uppercase", "--jelly-button-border-width": "2px", "--jelly-button-hover-transform": "translateY(-2px)" });
});

it("accepts the new settings and rejects values outside their choices", () => {
  expect(validateThemeSettings("jelly-signature", { textStyles: { h3: { size: 30, textCase: "none" } }, colorSchemes: { scheme1: { button: "#000000" } }, buttons: { hover: "underline" } })).toEqual([]);
  expect(validateThemeSettings("jelly-signature", { textStyles: { h3: { size: 500 } } })[0]?.path).toBe("textStyles.h3.size");
  expect(validateThemeSettings("jelly-avenue", { buttons: { hover: "spin" } })[0]?.path).toBe("buttons.hover");
});
