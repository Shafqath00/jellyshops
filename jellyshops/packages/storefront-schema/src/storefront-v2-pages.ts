/** Plain storefront document helpers, without zod (store pages use these; validation is in storefront-v2.ts). */
import { createDefaultStoreDesign } from "./defaults.js";
import type { SectionNode, ThemeId } from "./types.js";
import type { StorefrontDocument, StorefrontPage, StorefrontTemplateId } from "./storefront-v2.js";

export const STOREFRONT_SCHEMA_VERSION = 3 as const;

function block(type: string, settings: Record<string, unknown> = {}) { return { id: crypto.randomUUID(), type, enabled: true, settings }; }
function section(type: string, blocks: SectionNode["blocks"] = [], settings: Record<string, unknown> = {}): SectionNode { return { id: crypto.randomUUID(), type, enabled: true, settings, blocks }; }
export function homePage(sections: SectionNode[]): StorefrontPage { return { id: crypto.randomUUID(), type: "home", title: "Home page", slug: "/", system: true, sections }; }

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

