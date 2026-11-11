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
    // Found in src/themes/ (declarative themes; Harbour is generated from docs/theme-briefs/jelly-harbour.json).
    "jelly-diode", "jelly-forma", "jelly-halo", "jelly-harbour", "jelly-resthaven",
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

it("gives every theme a variant for each core section", () => {
  // Sections a theme adds itself (vendor/name, limited to that theme) are not core sections.
  const sectionTypes = listSectionDefinitions().map((section) => section.type).filter((type) => !type.includes("/"));

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

it("applies the old globals.css storefront rules only to themes that use them", async () => {
  const { legacyStylesAttribute, usesLegacyStorefrontStyles } = await import("./index");
  // Built-in themes, a folder theme that opts in, and a theme built on a base design follow their data.
  for (const id of ["minimal", "classic", "fresh-market", "jelly-signature", "jelly-avenue", "jelly-harbour"]) expect(usesLegacyStorefrontStyles(id), id).toBe(true);
  // Resthaven was rebuilt on the section defaults (docs/plans/resthaven-redesign.md).
  expect(usesLegacyStorefrontStyles("jelly-resthaven")).toBe(false);
  expect(legacyStylesAttribute("jelly-resthaven")).toBe("off");
  // Folder themes without the flag (and so every new or uploaded theme) start from storefront-base.css alone.
  expect(usesLegacyStorefrontStyles("jelly-forma")).toBe(false);
  // Forma, Halo and Diode bring all their own CSS ("own"); other folder themes get the section defaults ("off").
  expect(legacyStylesAttribute("jelly-forma")).toBe("own");
  expect(legacyStylesAttribute("jelly-signature")).toBeUndefined();
});

it("gives the section defaults to every theme without the old rules unless it opts out", async () => {
  const { usesSectionDefaults } = await import("./index");
  for (const id of ["jelly-forma", "jelly-halo", "jelly-diode"]) expect(usesSectionDefaults(id), id).toBe(false);
  // Themes on the old rules never get them either. A new theme does: see theme-cli scaffold-conformance.test.tsx.
  for (const id of ["jelly-signature", "jelly-avenue", "jelly-harbour"]) expect(usesSectionDefaults(id), id).toBe(false);
  expect(usesSectionDefaults("jelly-resthaven")).toBe(true);
});
