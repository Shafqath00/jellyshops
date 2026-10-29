import { isRetainedTemplate, type SelectableTemplate } from "./template-selection";

/** Page types a product, collection, page or blog post can switch to another template for. */
export const ASSIGNABLE_TEMPLATE_TYPES = ["product", "collection", "page", "blog", "article"] as const;
export type AssignableTemplateType = typeof ASSIGNABLE_TEMPLATE_TYPES[number];

export function isAssignableTemplateType(type: string): type is AssignableTemplateType {
  return (ASSIGNABLE_TEMPLATE_TYPES as readonly string[]).includes(type);
}

/** The main template of a page type: the one every item uses unless it picks another. */
export function isMainTemplate(template: Pick<SelectableTemplate, "handle">): boolean {
  return template.handle === "default";
}

/** Templates a merchant can choose: the main one first, then the others by name. Old ones from a previous store design are left out. */
export function selectableTemplates<T extends SelectableTemplate & { name: string }>(templates: readonly T[], type: string): T[] {
  return templates
    .filter((template) => template.type === type && !isRetainedTemplate(template))
    .sort((a, b) => Number(isMainTemplate(b)) - Number(isMainTemplate(a)) || a.name.localeCompare(b.name));
}

/** Turns a template name such as "Mattress page" into a handle no other template of that page type uses. */
export function templateHandleFromName(name: string, existing: readonly Pick<SelectableTemplate, "handle">[]): string {
  const base = name.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "") || "template";
  const safe = base === "default" || base.startsWith("previous-") || base === "previous" ? `${base}-template` : base;
  const taken = new Set(existing.map(({ handle }) => handle));
  if (!taken.has(safe)) return safe;
  let suffix = 2;
  while (taken.has(`${safe}-${suffix}`)) suffix += 1;
  return `${safe}-${suffix}`;
}

/** Gives every section and block a fresh id so a new template never shares ids with another one. */
export function withFreshSectionIds(layout: Record<string, unknown>, id: () => string = () => crypto.randomUUID()): Record<string, unknown> {
  const sections = Array.isArray(layout.sections) ? layout.sections : [];
  return {
    ...structuredClone(layout),
    sections: sections.map((placement) => {
      const record = placement as { kind?: unknown; section?: { blocks?: unknown } };
      if (record.kind !== "inline" || !record.section) return structuredClone(placement);
      const blocks = Array.isArray(record.section.blocks) ? record.section.blocks : [];
      return { ...structuredClone(record), section: { ...structuredClone(record.section), id: id(), blocks: blocks.map((block) => ({ ...structuredClone(block as Record<string, unknown>), id: id() })) } };
    }),
  };
}
