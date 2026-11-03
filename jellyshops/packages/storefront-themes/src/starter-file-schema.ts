import { z } from "zod";
import { sectionNodeSchema, storefrontPageTypes } from "@jelly/storefront-schema";

/**
 * The shape of a theme's starter.json: shared sections by key (announcement, header, footer) and
 * one template per page, each a list of placements (a section written in place, or a shared one by
 * key). This is the structural check; `validateThemeProject` adds the registry rules (known section
 * types, valid settings, allowed pages and blocks).
 */
export const starterFileSchema = z.object({
  globalSections: z.record(z.string(), sectionNodeSchema).default({}),
  templates: z.record(z.string(), z.object({
    type: z.enum(storefrontPageTypes),
    sections: z.array(z.union([
      z.object({ kind: z.literal("inline"), section: sectionNodeSchema }).strict(),
      z.object({ kind: z.literal("global"), globalSectionId: z.string().min(1) }).strict(),
    ])),
  }).strict()),
}).strict();

export type StarterFile = z.infer<typeof starterFileSchema>;
