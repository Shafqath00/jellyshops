import { z } from "zod";
import { STORE_DESIGN_SCHEMA_VERSION } from "./version.js";

export const themeIdSchema = z.enum(["minimal", "classic", "bold", "elegant", "playful"]);

const settingsSchema = z.record(z.string(), z.unknown());
const responsiveSettingsSchema = z.object({ mobile: settingsSchema.optional() }).strict();

const blockNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  enabled: z.boolean(),
  settings: settingsSchema,
  responsive: responsiveSettingsSchema.optional()
});

export const sectionNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  enabled: z.boolean(),
  settings: settingsSchema,
  responsive: responsiveSettingsSchema.optional(),
  blocks: z.array(blockNodeSchema)
});

const globalSettingsSchema = z.object({
  colors: z.object({ primary: z.string(), background: z.string(), text: z.string(), surface: z.string(), accent: z.string() }),
  typography: z.object({ headingFont: z.string(), bodyFont: z.string(), headingScale: z.enum(["compact", "standard", "large"]) }),
  buttons: z.object({ style: z.enum(["solid", "outline"]), radius: z.enum(["square", "soft", "rounded", "pill"]) }),
  layout: z.object({ containerWidth: z.enum(["narrow", "standard", "wide"]), sectionSpacing: z.enum(["compact", "standard", "spacious"]) }),
  productCards: z.object({ imageRatio: z.enum(["square", "portrait", "landscape"]), showVendor: z.boolean(), showQuickAdd: z.boolean() })
});

const pageDocumentSchema = (type: "home" | "product" | "collection") => z.object({
  id: z.string().min(1),
  type: z.literal(type),
  sections: z.array(sectionNodeSchema)
});

export const storeDesignDocumentSchema = z.object({
  schemaVersion: z.literal(STORE_DESIGN_SCHEMA_VERSION),
  theme: z.object({ id: themeIdSchema, settings: settingsSchema }),
  globalSettings: globalSettingsSchema,
  header: sectionNodeSchema,
  pages: z.object({ home: pageDocumentSchema("home"), product: pageDocumentSchema("product"), collection: pageDocumentSchema("collection") }),
  footer: sectionNodeSchema
}).superRefine((document, context) => {
  const requiredSections = { home: "hero", product: "product-information", collection: "collection-product-grid" } as const;

  for (const [page, requiredType] of Object.entries(requiredSections) as Array<[keyof typeof requiredSections, string]>) {
    if (!document.pages[page].sections.some((section) => section.type === requiredType)) {
      context.addIssue({ code: "custom", path: ["pages", page, "sections"], message: `${page} requires ${requiredType}` });
    }
  }
});
