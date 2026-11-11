import { z } from "zod";
import { menuImageSchema, sectionNodeSchema, storefrontPageTypes, type MenuImage } from "@jelly/storefront-schema";

/**
 * The shape of a theme's starter.json: shared sections by key (announcement, header, footer) and
 * one template per page, each a list of placements (a section written in place, or a shared one by
 * key). This is the structural check; `validateThemeProject` adds the registry rules (known section
 * types, valid settings, allowed pages and blocks).
 */
type StarterMenuItemInput = { id: string; label: string; target: { kind: "home" } | { kind: "search" } | { kind: "external"; url: string } | { kind: "anchor"; anchor: string }; image?: MenuImage; children: StarterMenuItemInput[] };
const starterMenuItemSchema: z.ZodType<StarterMenuItemInput> = z.lazy(() => z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("home") }).strict(),
    z.object({ kind: z.literal("search") }).strict(),
    // A full https address, or a path in the store such as "/search?q=Beds" or "/pages/faq".
    z.object({ kind: z.literal("external"), url: z.string().min(1).max(500).refine((url) => (url.startsWith("/") && !url.startsWith("//")) || url.startsWith("https://"), "Use a path starting with / or an https address") }).strict(),
    z.object({ kind: z.literal("anchor"), anchor: z.string().regex(/^#[A-Za-z][A-Za-z0-9_:\-.]*$/) }).strict(),
  ]),
  /** Optional photo for the mega menu ("/themes/<id>/room.webp" or an https address). */
  image: menuImageSchema.optional(),
  children: z.array(starterMenuItemSchema).max(20).default([]),
}).strict()) as z.ZodType<StarterMenuItemInput>;

export const starterFileSchema = z.object({
  /** Optional main menu the store starts with; without it a store gets Home and Search. */
  menus: z.array(z.object({ key: z.literal("main"), name: z.string().min(1).max(80), handle: z.literal("main"), items: z.array(starterMenuItemSchema).max(20) }).strict()).length(1).optional(),
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
