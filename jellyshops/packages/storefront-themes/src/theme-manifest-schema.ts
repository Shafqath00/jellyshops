import { z } from "zod";
import { recipeSchema } from "./recipes.js";
import { compareThemeVersions, jellyEngineRangeSchema, themeVersionSchema } from "./versioning.js";
import { themeMigrationSchema } from "./migrations.js";

const settingTypeSchema = z.enum(["text", "textarea", "number", "range", "checkbox", "select", "radio", "color", "font", "image", "url", "richtext", "alignment"]);
const localAssetPath = z.string().regex(/^\/themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9._/-]+$/).refine((path) => !path.includes("..") && !path.includes("\\") && !/^\/themes\/[^/]+\/https?:/i.test(path), "Theme assets must be local, namespaced paths");
const assetSchema = z.object({ id: z.string().regex(/^[a-z][a-zA-Z0-9_-]*$/), path: localAssetPath }).strict();
const fontAssetSchema = z.object({ id: z.string().regex(/^[a-z][a-zA-Z0-9_-]*$/), family: z.string().min(1), path: localAssetPath.optional(), weight: z.union([z.string(), z.number()]).optional(), style: z.string().optional(), format: z.string().optional() }).strict();
const assetsSchema = z.object({ stylesheets: z.array(assetSchema).default([]), scripts: z.array(assetSchema).default([]), fonts: z.array(fontAssetSchema).default([]), icons: z.array(assetSchema).default([]), assets: z.array(assetSchema).default([]), preview: z.object({ path: localAssetPath, alt: z.string().optional() }).strict().optional() }).strict();
const settingDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/),
  type: settingTypeSchema,
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  group: z.string().min(1).optional(),
  default: z.unknown(),
  options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) }).strict()).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  step: z.number().positive().finite().optional(),
}).strict().superRefine((definition, context) => {
  if (["select", "radio", "alignment", "font"].includes(definition.type) && !definition.options?.length) {
    context.addIssue({ code: "custom", message: "Choice settings require options", path: ["options"] });
  }
  if (["number", "range"].includes(definition.type) && (definition.min === undefined || definition.max === undefined || definition.min > definition.max)) {
    context.addIssue({ code: "custom", message: "Numeric settings require valid min and max bounds" });
  }
});

/**
 * Built-in designs another theme may build on (`extends`): the theme reuses the base design's stylesheets, shared
 * kit, section designs and settings, and brings only its own values (colours, fonts, schemes, defaults) and content.
 */
export const THEME_BASE_IDS = ["jelly-signature", "jelly-avenue"] as const;

export const themeManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** A built-in design this theme builds on; it then needs no stylesheet of its own. */
  extends: z.enum(THEME_BASE_IDS).optional(),
  name: z.string().min(1),
  version: themeVersionSchema,
  engines: z.object({ jelly: jellyEngineRangeSchema }).strict().optional(),
  migrations: z.array(themeMigrationSchema).max(100).optional(),
  description: z.string().min(1),
  assetPrefix: z.string().regex(/^\/themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/),
  previewAsset: z.string().regex(/^\/themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9._-]+$/).optional(),
  assets: assetsSchema.default({ stylesheets: [], scripts: [], fonts: [], icons: [], assets: [] }),
  layout: z.enum(["standard", "editorial"]),
  enabled: z.boolean(),
  settingsDefaults: z.record(z.string(), z.unknown()),
  settingsSchema: z.array(settingDefinitionSchema).default([]),
  /**
   * Opts the theme in to the old default storefront rules in src/app/globals.css (hero, gallery, product cards,
   * a header that stacks below 560px, ...). Only themes written against those rules set it; a new theme leaves it
   * out and starts from storefront-base.css alone. Built-in themes registered in theme-registry.ts use the rules
   * unless they set it to false, and a theme that `extends` a base design follows the base.
   */
  legacyStorefrontStyles: z.boolean().optional(),
  /** Custom sections the theme adds, described as data (see recipes.ts). */
  sections: z.array(recipeSchema).max(20).optional(),
}).strict().superRefine((manifest, context) => {
  (manifest.migrations ?? []).forEach((migration, index, entries) => {
    if (!themeVersionSchema.safeParse(manifest.version).success || !themeVersionSchema.safeParse(migration.from).success || !themeVersionSchema.safeParse(migration.to).success) return;
    if (compareThemeVersions(migration.to, manifest.version) > 0) context.addIssue({ code: "custom", message: "A migration cannot target a future theme version.", path: ["migrations", index, "to"] });
    if (entries.slice(0, index).some((other) => themeVersionSchema.safeParse(other.from).success && compareThemeVersions(other.from, migration.from) === 0)) context.addIssue({ code: "custom", message: "Only one migration may leave each source version.", path: ["migrations", index, "from"] });
  });
  if (manifest.extends && manifest.extends === manifest.id) context.addIssue({ code: "custom", message: "A theme cannot extend itself.", path: ["extends"] });
  if (manifest.assetPrefix !== `/themes/${manifest.id}/`) {
    context.addIssue({ code: "custom", message: "Theme assetPrefix must belong to its theme id", path: ["assetPrefix"] });
  }
  (manifest.sections ?? []).forEach((recipe, index) => {
    if (!recipe.type.startsWith(`${manifest.id}/`)) context.addIssue({ code: "custom", message: `A section of this theme is named ${manifest.id}/section-name, not "${recipe.type}".`, path: ["sections", index, "type"] });
  });
});

export type ThemeManifest = z.infer<typeof themeManifestSchema>;
export type ThemeSettingDefinition = z.infer<typeof settingDefinitionSchema>;
