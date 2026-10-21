import { expect, it } from "vitest";
import { createDefaultStoreDesign } from "@jelly/storefront-schema";
import { listSectionDefinitions } from "@jelly/storefront-registry";
import { applyThemePreset, getThemeDefinition, listThemes, resolveDesignTokens } from "./index";
import { validateThemeManifest, resolveTheme } from "./theme-resolver";

it.each(["fresh-market", "artisan-boutique", "classic"])("exposes working color and font controls for %s", (id) => {
  const manifest = validateThemeManifest(getThemeDefinition(id).manifest);
  expect(manifest.settingsSchema).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "colors.accent", type: "color" }),
    expect.objectContaining({ id: "typography.headingFont", type: "font" }),
  ]));
  expect(resolveTheme(id).settings).toMatchObject({ colors: getThemeDefinition(id).tokens.colors });
});

it("registers every Store Editor theme", () => {
  expect(listThemes().map((theme) => theme.id)).toEqual([
    "jelly-signature", "jelly-avenue", "minimal", "classic", "bold", "elegant", "playful", "fresh-market", "artisan-boutique", "example-boutique",
  ]);
});

it.each(["fresh-market", "artisan-boutique"] as const)("resolves complete ecommerce tokens for %s", (id) => {
  const tokens = resolveDesignTokens(id, createDefaultStoreDesign(id).globalSettings);

  expect(tokens).toMatchObject({
    "--jelly-color-primary": expect.any(String),
    "--jelly-font-display": expect.any(String),
    "--jelly-radius-card": expect.any(String),
  });
});

it("preserves Artisan Boutique's approved visual identity", () => {
  expect(getThemeDefinition("artisan-boutique").tokens).toEqual({
    colors: { primary: "#201a1d", background: "#f7f3ed", text: "#201a1d", surface: "#fffdf9", accent: "#7c2d4f" },
    typography: { display: "Georgia", body: "Inter" },
    radii: { button: "8px", card: "4px" },
    spacing: { section: "104px", container: "76rem" },
    cardShadow: "0 12px 30px rgba(32, 26, 29, 0.08)",
  });
});

it("gives every theme a variant for each registered section", () => {
  const sectionTypes = listSectionDefinitions().map((section) => section.type);

  for (const theme of listThemes()) {
    expect(Object.keys(theme.sectionVariants)).toEqual(expect.arrayContaining(sectionTypes));
  }
});

it("allows global settings to override theme defaults", () => {
  const document = createDefaultStoreDesign("minimal");
  document.globalSettings.colors.background = "#101010";

  expect(resolveDesignTokens(document.theme.id, document.globalSettings)["--jelly-color-background"]).toBe("#101010");
});

it("resolves serializable semantic CSS variables", () => {
  const tokens = resolveDesignTokens("elegant", createDefaultStoreDesign().globalSettings);

  expect(tokens).toMatchObject({
    "--jelly-color-background": expect.any(String),
    "--jelly-color-text": expect.any(String),
    "--jelly-font-display": expect.any(String),
    "--jelly-radius-card": expect.any(String),
    "--jelly-shadow-card": expect.any(String)
  });
});

it("does not mutate design content while resolving a different theme", () => {
  const document = createDefaultStoreDesign("minimal");
  const before = structuredClone(document);

  getThemeDefinition("playful");

  expect(document).toEqual(before);
});

it("resolves comprehensive semantic theme variables", () => {
  const tokens = resolveDesignTokens("minimal", createDefaultStoreDesign().globalSettings);

  expect(tokens).toMatchObject({
    "--jelly-color-secondary": expect.any(String),
    "--jelly-color-muted": expect.any(String),
    "--jelly-color-border": expect.any(String),
    "--jelly-layout-gutter": expect.any(String),
    "--jelly-radius-input": expect.any(String),
    "--jelly-motion-duration": expect.any(String),
  });
});

it("can preserve overrides or reset colors when applying a preset", () => {
  const current = createDefaultStoreDesign().globalSettings;
  current.colors.background = "#123456";

  expect(applyThemePreset(current, "bold", "preserve").colors.background).toBe("#123456");
  expect(applyThemePreset(current, "bold", "reset").colors.background).toBe(
    getThemeDefinition("bold").tokens.colors.background,
  );
  expect(current.colors.background).toBe("#123456");
});
