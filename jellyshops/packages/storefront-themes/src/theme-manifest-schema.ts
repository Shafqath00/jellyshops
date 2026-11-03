import { z } from "zod";
import { recipeSchema } from "./recipes.js";

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

export const themeManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/),
  description: z.string().min(1),
  assetPrefix: z.string().regex(/^\/themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/),
  previewAsset: z.string().regex(/^\/themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9._-]+$/).optional(),
  assets: assetsSchema.default({ stylesheets: [], scripts: [], fonts: [], icons: [], assets: [] }),
  layout: z.enum(["standard", "editorial"]),
  enabled: z.boolean(),
  settingsDefaults: z.record(z.string(), z.unknown()),
  settingsSchema: z.array(settingDefinitionSchema).default([]),
  /** Custom sections the theme adds, described as data (see recipes.ts). */
  sections: z.array(recipeSchema).max(20).optional(),
}).strict().superRefine((manifest, context) => {
  if (manifest.assetPrefix !== `/themes/${manifest.id}/`) {
    context.addIssue({ code: "custom", message: "Theme assetPrefix must belong to its theme id", path: ["assetPrefix"] });
  }
  (manifest.sections ?? []).forEach((recipe, index) => {
    if (!recipe.type.startsWith(`${manifest.id}/`)) context.addIssue({ code: "custom", message: `A section of this theme is named ${manifest.id}/section-name, not "${recipe.type}".`, path: ["sections", index, "type"] });
  });
});

export type ThemeManifest = z.infer<typeof themeManifestSchema>;
export type ThemeSettingDefinition = z.infer<typeof settingDefinitionSchema>;
