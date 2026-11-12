/**
 * The public surface for building a Jelly Shops theme.
 *
 *   defineTheme     declare a theme (manifest, tokens, optional section overrides and shells)
 *   defineSection   declare a section type; defineBlock a block type
 *   registerSection add a namespaced `vendor/name` section from outside the core set
 *   validateThemeProject, createStarterPack  check and load a theme folder (theme.json + starter.json)
 *
 * Tests: `import { describeThemeConformance } from "@jelly/theme-sdk/testing"`.
 */
export { defineBlock, defineSection, registerSection } from "@jelly/storefront-registry";
export type { BlockDefinition, ControlDefinition, SectionDefinition } from "@jelly/storefront-registry";
export { createStarterPack, defineTheme, resolveTheme, validateThemeManifest, validateThemeProject, validateThemeSettings } from "@jelly/storefront-themes";
export { THEME_PART_GROUPS, THEME_PARTS, themeCssInternals } from "@jelly/storefront-themes";
export type { DiscoveredTheme, ThemeInput, ThemeManifest, ThemeProjectIssue, ThemeTokens } from "@jelly/storefront-themes";
export { JELLY_THEME_API_VERSION, compareThemeVersions, supportsJellyVersion } from "@jelly/storefront-themes";
export { applyThemeMigrations, applyThemeUpgrade, getThemeMigrationPath, getThemeUpgradePath, themeMigrationSchema } from "@jelly/storefront-themes";
export type { ThemeMigration, ThemeMigrationDraft, ThemeMigrationChange } from "@jelly/storefront-themes";
