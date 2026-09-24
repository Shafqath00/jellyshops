import { describe, expect, it } from "vitest";
import { resolveStorefrontThemeTokens } from "./storefront-theme-tokens";

describe("storefront theme tokens", () => {
  it("prefers modern settings over legacy store theme values", () => {
    const tokens = resolveStorefrontThemeTokens("minimal", { colors: { accent: "#123456", background: "#fafafa" } }, { accent: "#ff0000", background: "#000000" });
    expect(tokens["--theme-accent"]).toBe("#123456");
    expect(tokens["--theme-background"]).toBe("#fafafa");
  });

  it("uses theme defaults and legacy values when settings are missing", () => {
    const tokens = resolveStorefrontThemeTokens("minimal", {}, { accent: "#123456", background: "#fafafa", text: "#111111" });
    expect(tokens["--theme-accent"]).toBe("#123456");
    expect(tokens["--theme-background"]).toBe("#fafafa");
    expect(tokens["--theme-font-heading"]).toBeTruthy();
  });

  it("resolves Fresh Market's restrained storefront system through the shared CSS tokens", () => {
    const tokens = resolveStorefrontThemeTokens("fresh-market");

    expect(tokens).toMatchObject({
      "--jelly-color-primary": "#23633f",
      "--jelly-color-background": "#f7f8f4",
      "--jelly-color-text": "#26372c",
      "--jelly-color-surface": "#ffffff",
      "--jelly-color-accent": "#a84e08",
      "--jelly-font-display": "Nunito Sans",
      "--jelly-font-body": "Aptos",
      "--jelly-radius-button": "12px",
      "--jelly-radius-card": "10px",
      "--jelly-spacing-section": "64px",
      "--jelly-container-width": "80rem",
      "--theme-background": "#f7f8f4",
      "--theme-accent": "#a84e08",
    });
  });

  it("rejects unsafe token values without producing blank CSS", () => {
    const tokens = resolveStorefrontThemeTokens("minimal", { colors: { accent: "", background: "url(javascript:alert(1))" }, typography: { headingFont: "\n" } });
    expect(tokens["--theme-accent"]).toBeTruthy();
    expect(tokens["--theme-background"]).not.toContain("javascript");
    expect(tokens["--theme-font-heading"]).toBeTruthy();
  });
});
