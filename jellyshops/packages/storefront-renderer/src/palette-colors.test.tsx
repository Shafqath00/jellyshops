import { describe, expect, it } from "vitest";
import { COLOR_SETTING_PATTERN, colorSettingCss, isPaletteColor } from "@jelly/storefront-schema";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { SectionNode } from "@jelly/storefront-schema";
import { blockStyleProps } from "./block-style";
import { sectionStyleProps } from "./section-style";
import { sectionScheme } from "./section-frame";
import { buttonProps } from "./sections/block-content";

/** Template plan T7 part 4: colour settings can link to a theme colour instead of holding a copy of it. */
describe("palette colours", () => {
  it("turns palette references into theme variables and refuses anything else", () => {
    expect(colorSettingCss("#123abc")).toBe("#123abc");
    expect(colorSettingCss("palette:primary")).toBe("var(--jelly-color-primary)");
    expect(colorSettingCss("palette:scheme12-button-text")).toBe("var(--jelly-scheme-12-button-text)");
    expect(colorSettingCss("palette:scheme3-secondary")).toBe("var(--jelly-scheme-3-secondary, var(--jelly-scheme-3-text))");
    for (const bad of ["palette:scheme17-bg", "palette:brand", "red", "var(--x)", "palette:primary;color:red", 7]) {
      expect(colorSettingCss(bad), String(bad)).toBeUndefined();
      expect(isPaletteColor(bad)).toBe(false);
    }
    expect(COLOR_SETTING_PATTERN.test("palette:scheme4-bg")).toBe(true);
    expect(COLOR_SETTING_PATTERN.test("palette:scheme4-bgx")).toBe(false);
  });

  it("draws linked section, block and button colours", () => {
    expect(sectionStyleProps({ styleColors: true, styleBackground: "palette:scheme2-bg", styleText: "palette:text" }).style).toMatchObject({ "--section-bg": "var(--jelly-scheme-2-bg)", "--section-text": "var(--jelly-color-text)" });
    expect(sectionScheme({ styleColors: true, styleBackground: "palette:accent" })).toBe("custom");
    expect(blockStyleProps({ blockTextColor: "palette:scheme4-button" }).style?.color).toBe("var(--jelly-scheme-4-button)");
    expect(buttonProps({ buttonStyle: "primary", buttonColor: "palette:primary", buttonTextColor: "palette:background" }).style).toMatchObject({ background: "var(--jelly-color-primary)", color: "var(--jelly-color-background)" });
  });

  it("lets sections and blocks save palette colours", () => {
    const section: SectionNode = { id: "s", type: "custom-content", enabled: true, settings: { styleColors: true, styleBackground: "palette:scheme2-bg", styleText: "palette:scheme2-text" }, blocks: [
      { id: "b", type: "button", enabled: true, settings: { label: "Shop", link: "/shop", buttonColor: "palette:primary", blockTextColor: "palette:text" } },
    ] };
    expect(validateSectionAgainstRegistry(section, "home")).toEqual([]);
    const broken = { ...section, settings: { ...section.settings, styleBackground: "palette:nowhere" } };
    expect(validateSectionAgainstRegistry(broken, "home").length).toBeGreaterThan(0);
  });
});
