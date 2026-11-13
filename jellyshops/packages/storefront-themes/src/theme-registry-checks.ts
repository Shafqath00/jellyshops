import { checkThemeManifest } from "./define-theme.js";
import { recipesOf, registerRecipes } from "./recipes.js";
import { onThemeRegistered } from "./theme-registry.js";

/**
 * Loaded by the main entry only (editor, backend, tests, CLI): checks every theme's manifest against the platform
 * schema, as defineTheme did when themes were built, and registers each theme's recipes as sections in the section
 * registry with the checked recipe list. Store pages use `@jelly/storefront-themes/runtime`, which skips both.
 */
onThemeRegistered((registration) => {
  if (registration.kind === "theme") checkThemeManifest(registration.theme.id, registration.theme.manifest);
  else registerRecipes(registration.manifest.id, recipesOf(registration.manifest), registration.manifest.version);
});
