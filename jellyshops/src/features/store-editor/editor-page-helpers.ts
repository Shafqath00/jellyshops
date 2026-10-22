import type { ComponentProps } from "react";
import { sectionLabel } from "@jelly/storefront-registry";
import type { RegistrySectionRenderer } from "@jelly/storefront-renderer";
import type { SectionNode } from "@jelly/storefront-schema";
import type { GlobalSectionRecord, StorefrontTemplateRecord } from "./api/types";
import type { EditorSelection } from "./model/types";

export type RegistrySection = ComponentProps<typeof RegistrySectionRenderer>["section"];

export type HierarchyRegion = "header" | "template" | "footer";

export const sectionCategoryLabels = {
  layout: "Layout",
  content: "Content",
  commerce: "Products",
} as const;

export const defaultTemplateSections: Record<string, string[]> = {
  home: ["hero"], product: ["product-information"], collection: ["collection-header", "collection-product-grid", "collection-description"],
  cart: ["cart-summary"], search: ["search-results"], page: ["page-content"], blog: ["blog-header", "article-list"], article: ["article-header", "article-content"], "not-found": ["not-found-message"],
};

export function defaultTemplateLayout(type: string): Record<string, unknown> {
  return { sections: (defaultTemplateSections[type] ?? ["rich-text"]).map((sectionType) => ({ kind: "inline", section: { id: `${type}-${sectionType}`, type: sectionType, enabled: true, settings: {}, blocks: [] } })) };
}

export const regionLabels: Record<string, string> = { header: "Header", template: "Page sections", footer: "Footer" };

/** Merchant-facing name for a region or section type. */
export function displayName(value: string): string {
  return regionLabels[value] ?? sectionLabel(value);
}

export function setThemeSetting(settings: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const result = structuredClone(settings);
  const keys = path.split(".");
  let current = result;
  keys.slice(0, -1).forEach((key) => {
    const next = current[key];
    current[key] = next && typeof next === "object" && !Array.isArray(next) ? structuredClone(next) : {};
    current = current[key] as Record<string, unknown>;
  });
  current[keys[keys.length - 1]!] = value;
  return result;
}

export function normalizeBlock(value: unknown): SectionNode["blocks"][number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.type !== "string") return null;
  return {
    id: input.id,
    type: input.type,
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    settings: input.settings && typeof input.settings === "object" && !Array.isArray(input.settings)
      ? structuredClone(input.settings as Record<string, unknown>)
      : {},
    ...(input.responsive && typeof input.responsive === "object" && !Array.isArray(input.responsive)
      ? { responsive: structuredClone(input.responsive) as SectionNode["blocks"][number]["responsive"] }
      : {}),
  };
}

export function normalizeSection(value: unknown): SectionNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.type !== "string") return null;
  return {
    id: input.id,
    type: input.type,
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    settings: input.settings && typeof input.settings === "object" && !Array.isArray(input.settings)
      ? structuredClone(input.settings as Record<string, unknown>)
      : {},
    blocks: Array.isArray(input.blocks)
      ? input.blocks.map(normalizeBlock).filter((block): block is NonNullable<ReturnType<typeof normalizeBlock>> => block !== null)
      : [],
    ...(input.responsive && typeof input.responsive === "object" && !Array.isArray(input.responsive)
      ? { responsive: structuredClone(input.responsive) as SectionNode["responsive"] }
      : {}),
  };
}

export function templateSections(template: StorefrontTemplateRecord, globals: Map<string, GlobalSectionRecord>): SectionNode[] {
  const placements = template.layout.sections;
  if (!Array.isArray(placements)) return [];
  return placements.flatMap((placement): SectionNode[] => {
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) return [];
    const input = placement as Record<string, unknown>;
    if (input.kind === "inline") {
      const section = normalizeSection(input.section);
      return section ? [section] : [];
    }
    if (input.kind === "global" && typeof input.globalSectionId === "string") {
      const section = normalizeSection(globals.get(input.globalSectionId)?.section);
      return section ? [section] : [];
    }
    return [];
  });
}

export function draftPreviewLayout(template: StorefrontTemplateRecord, globals: Map<string, GlobalSectionRecord>) {
  const layout = { announcement: [] as SectionNode[], header: [] as SectionNode[], template: [] as SectionNode[], footer: [] as SectionNode[] };
  const placements = template.layout.sections;
  if (!Array.isArray(placements)) return layout;
  for (const placement of placements) {
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) continue;
    const input = placement as Record<string, unknown>;
    const section = input.kind === "inline"
      ? normalizeSection(input.section)
      : input.kind === "global" && typeof input.globalSectionId === "string"
        ? normalizeSection(globals.get(input.globalSectionId)?.section)
        : null;
    if (!section) continue;
    const region = section.type === "announcement-bar" ? "announcement"
      : section.type === "header" ? "header"
        : section.type === "footer" ? "footer"
          : "template";
    layout[region].push(section);
  }
  return layout;
}

export function selectedInlineSection(template: StorefrontTemplateRecord, selection: EditorSelection): SectionNode | null {
  if (!selection || selection.kind === "theme" || !selection.sectionId) return null;
  const placements = template.layout.sections;
  if (!Array.isArray(placements)) return null;
  for (const placement of placements) {
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) continue;
    const input = placement as Record<string, unknown>;
    if (input.kind !== "inline") continue;
    const section = normalizeSection(input.section);
    if (section?.id === selection.sectionId) return section;
  }
  return null;
}

