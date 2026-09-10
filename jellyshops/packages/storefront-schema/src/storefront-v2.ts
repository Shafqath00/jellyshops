import { z } from "zod";
import { createDefaultStoreDesign } from "./defaults.js";
import { storeDesignDocumentSchema, themeIdSchema } from "./schema.js";
import type { GlobalSettings, SectionNode, ThemeId } from "./types.js";

export const STOREFRONT_SCHEMA_VERSION = 3 as const;
const MAX_DOCUMENT_BYTES = 1_500_000;
const reservedSlugs = new Set(["admin", "api", "cart", "checkout", "order", "products", "shop"]);

export type StorefrontPageType = "home" | "product" | "collection" | "custom";
export type StorefrontTemplateId = "bakes" | "essentials";

export interface MediaReference {
  id: string;
  url: string;
  alt: string;
  focalPoint: { x: number; y: number };
  fit: "cover" | "contain";
}

export interface StorefrontPage {
  id: string;
  type: StorefrontPageType;
  title: string;
  slug: string;
  system: boolean;
  sections: SectionNode[];
}

export interface StorefrontDocument {
  schemaVersion: 3;
  storeId: string;
  theme: { presetId: ThemeId; settings: GlobalSettings };
  regions: Record<"header" | "template" | "footer", SectionNode[]>;
  pages: StorefrontPage[];
}

const settingsSchema = z.record(z.string(), z.unknown());
const responsiveSchema = z.object({ mobile: settingsSchema.optional() }).strict();
const blockSchema = z.object({ id: z.string().min(1), type: z.string().min(1), enabled: z.boolean(), settings: settingsSchema, responsive: responsiveSchema.optional() });
const sectionSchema = z.object({ id: z.string().min(1), type: z.string().min(1), enabled: z.boolean(), settings: settingsSchema, responsive: responsiveSchema.optional(), blocks: z.array(blockSchema) });
const globalSettingsSchema = storeDesignDocumentSchema.shape.globalSettings;
const pageSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["home", "product", "collection", "custom"]),
  title: z.string().trim().min(1).max(80),
  slug: z.string().regex(/^\/$|^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  system: z.boolean(),
  sections: z.array(sectionSchema),
});
const v2Schema = z.object({
  schemaVersion: z.literal(2),
  storeId: z.string().min(1),
  template: z.literal("home"),
  theme: z.object({ presetId: themeIdSchema, settings: globalSettingsSchema }),
  regions: z.object({ header: z.array(sectionSchema).min(1), template: z.array(sectionSchema), footer: z.array(sectionSchema).min(1) }),
});

export const storefrontDocumentSchema = z.object({
  schemaVersion: z.literal(STOREFRONT_SCHEMA_VERSION),
  storeId: z.string().min(1),
  theme: z.object({ presetId: themeIdSchema, settings: globalSettingsSchema }),
  regions: z.object({ header: z.array(sectionSchema).min(1), template: z.array(sectionSchema), footer: z.array(sectionSchema).min(1) }),
  pages: z.array(pageSchema).min(1),
}).superRefine((document, context) => {
  const slugs = new Set<string>();
  const systemTypes = new Set<string>();
  const ids = new Set<string>();
  for (const page of document.pages) {
    if (slugs.has(page.slug)) context.addIssue({ code: "custom", path: ["pages"], message: "Page slugs must be unique" });
    slugs.add(page.slug);
    if (page.type !== "custom") {
      if (systemTypes.has(page.type)) context.addIssue({ code: "custom", path: ["pages"], message: "System page types must be unique" });
      systemTypes.add(page.type);
      if (!page.system) context.addIssue({ code: "custom", path: ["pages"], message: "System pages must be protected" });
    }
    if (page.type === "home" && page.slug !== "/") context.addIssue({ code: "custom", path: ["pages"], message: "Home page must use the root slug" });
    if (page.type === "custom" && (page.system || reservedSlugs.has(page.slug))) context.addIssue({ code: "custom", path: ["pages"], message: "Custom page slug is reserved" });
  }
  if (!document.pages.some((page) => page.type === "home" && page.system)) context.addIssue({ code: "custom", path: ["pages"], message: "A protected home page is required" });
  for (const node of [...document.regions.header, ...document.regions.footer, ...document.pages.flatMap((page) => page.sections)].flatMap((section) => [section, ...section.blocks])) {
    if (ids.has(node.id)) { context.addIssue({ code: "custom", path: ["regions"], message: "Node IDs must be unique" }); break; }
    ids.add(node.id);
  }
  for (const section of [...document.regions.header, ...document.regions.footer, ...document.pages.flatMap((page) => page.sections)]) {
    inspectMedia(section.settings, ["settings"], context);
    section.blocks.forEach((block) => inspectMedia(block.settings, ["blocks", block.id, "settings"], context));
  }
  if (Buffer.byteLength(JSON.stringify(document), "utf8") > MAX_DOCUMENT_BYTES) context.addIssue({ code: "custom", path: [], message: "Storefront document exceeds 1.5 MB" });
});

function inspectMedia(value: unknown, path: Array<string | number>, context: z.RefinementCtx): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach((item, index) => inspectMedia(item, [...path, index], context)); return; }
  const record = value as Record<string, unknown>;
  if (typeof record.url === "string" && "focalPoint" in record && !(record.url.startsWith("/") || /^https?:\/\//i.test(record.url))) context.addIssue({ code: "custom", path: [...path, "url"], message: "Media URL uses an unsafe protocol" });
  Object.entries(record).forEach(([key, item]) => inspectMedia(item, [...path, key], context));
}

function block(type: string, settings: Record<string, unknown> = {}) { return { id: crypto.randomUUID(), type, enabled: true, settings }; }
function section(type: string, blocks: SectionNode["blocks"] = [], settings: Record<string, unknown> = {}): SectionNode { return { id: crypto.randomUUID(), type, enabled: true, settings, blocks }; }
function homePage(sections: SectionNode[]): StorefrontPage { return { id: crypto.randomUUID(), type: "home", title: "Home page", slug: "/", system: true, sections }; }

export function createStorefrontTemplate(templateId: StorefrontTemplateId, storeId: string): StorefrontDocument {
  const hero = templateId === "bakes"
    ? section("hero", [block("heading", { text: "Made for your sweetest moments" }), block("text", { text: "Small-batch treats delivered with care." }), block("button", { label: "Shop the collection", href: "/shop" })], { contentAlignment: "center" })
    : section("hero", [block("heading", { text: "Everyday favorites, beautifully made" }), block("text", { text: "A focused collection for your best customers." }), block("button", { label: "Browse products", href: "/shop" })], { contentAlignment: "left" });
  const sections = templateId === "bakes"
    ? [hero, section("product-grid"), section("rich-text", [block("heading", { text: "Made by hand" }), block("text", { text: "Thoughtful ingredients and memorable details in every order." })]), section("newsletter", [block("heading", { text: "Stay in the loop" }), block("text", { text: "New drops, seasonal favorites, and special offers." })])]
    : [hero, section("featured-collection"), section("product-grid"), section("rich-text", [block("heading", { text: "Simple by design" }), block("text", { text: "A carefully edited selection for everyday shopping." })])];
  const themeId = templateId === "bakes" ? "elegant" : "minimal";
  return {
    schemaVersion: STOREFRONT_SCHEMA_VERSION,
    storeId,
    theme: { presetId: themeId, settings: structuredClone(createDefaultStoreDesign(themeId).globalSettings) },
    regions: { header: [section("header", [block("menu")])], template: sections, footer: [section("footer", [block("menu")])] },
    pages: [homePage(sections)],
  };
}

export function createDefaultStorefrontDocument(storeId: string, themeId: ThemeId = "minimal"): StorefrontDocument {
  const legacy = createDefaultStoreDesign(themeId);
  const homeSections = legacy.pages.home.sections;
  return {
    schemaVersion: STOREFRONT_SCHEMA_VERSION,
    storeId,
    theme: {
      presetId: themeId,
      settings: structuredClone(legacy.globalSettings),
    },
    regions: {
      header: [legacy.header],
      template: homeSections,
      footer: [legacy.footer],
    },
    pages: [homePage(homeSections)],
  };
}

export function getStorefrontPage(document: StorefrontDocument, pageIdOrSlug: string = "/"): StorefrontPage | undefined {
  return document.pages.find((page) => page.id === pageIdOrSlug || page.slug === pageIdOrSlug);
}

export function validateStorefrontDocument(input: unknown) { return storefrontDocumentSchema.safeParse(input); }

export function migrateStorefrontDocument(input: unknown, storeId: string): StorefrontDocument {
  const current = storefrontDocumentSchema.safeParse(input);
  if (current.success) return current.data;
  const v2 = v2Schema.safeParse(input);
  if (v2.success) return storefrontDocumentSchema.parse({ schemaVersion: 3, storeId: v2.data.storeId, theme: v2.data.theme, regions: { header: v2.data.regions.header, template: v2.data.regions.template, footer: v2.data.regions.footer }, pages: [homePage(v2.data.regions.template)] });
  const legacy = storeDesignDocumentSchema.safeParse(input);
  if (legacy.success) return storefrontDocumentSchema.parse({ schemaVersion: 3, storeId, theme: { presetId: legacy.data.theme.id, settings: legacy.data.globalSettings }, regions: { header: [legacy.data.header], template: legacy.data.pages.home.sections, footer: [legacy.data.footer] }, pages: [homePage(legacy.data.pages.home.sections)] });
  throw new Error("Invalid Storefront document");
}
