/**
 * Section groups (theme plan T6): the shared sections drawn above every page (header group), below it (footer
 * group) and on top of it (overlay group), as ordered lists of shared section ids. A store without saved groups
 * keeps the older rule: each template lists its own shared header and footer sections, and `deriveSectionGroups`
 * works the groups out from them. Plain functions with no zod, so store pages can use them.
 */

export const SECTION_GROUP_KEYS = ["header", "footer", "overlay"] as const;
export type SectionGroupKey = typeof SECTION_GROUP_KEYS[number];
export type StorefrontSectionGroups = Record<SectionGroupKey, string[]>;

/** Most sections one group may hold. */
export const MAX_GROUP_SECTIONS = 12;

/** Section types that always belong to the header or footer, wherever a template places them. */
const CHROME_GROUP: Record<string, SectionGroupKey> = { "announcement-bar": "header", header: "header", footer: "footer" };
export const chromeGroupOf = (type: string | undefined): SectionGroupKey | undefined => (type ? CHROME_GROUP[type] : undefined);

type Placement = { kind?: unknown; globalSectionId?: unknown };

/**
 * The groups a store's templates imply: in the template (the home page when there is one), shared sections of a
 * header or footer type, plus other shared sections before the first page section (header) or after the last one
 * (footer). Shared sections in the middle of a page stay part of that page.
 */
export function deriveSectionGroups(templates: Array<{ type?: string; handle?: string; layout: { sections?: unknown } }>, typeOf: (globalSectionId: string) => string | undefined): StorefrontSectionGroups {
  const groups: StorefrontSectionGroups = { header: [], footer: [], overlay: [] };
  const template = templates.find((entry) => entry.type === "home" && entry.handle === "default")
    ?? templates.find((entry) => entry.handle === "default")
    ?? templates[0];
  const placements = (Array.isArray(template?.layout.sections) ? template.layout.sections : []) as Placement[];
  const inline = placements.map((placement, index) => placement?.kind === "inline" ? index : -1).filter((index) => index >= 0);
  const first = inline.length ? inline[0] : placements.length;
  const last = inline.length ? inline[inline.length - 1] : -1;
  placements.forEach((placement, index) => {
    if (placement?.kind !== "global" || typeof placement.globalSectionId !== "string") return;
    const id = placement.globalSectionId;
    const group = chromeGroupOf(typeOf(id)) ?? (index < first ? "header" : index > last && inline.length ? "footer" : undefined);
    if (group && !groups[group].includes(id)) groups[group].push(id);
  });
  return groups;
}

/** Every shared section id that sits in a group. */
export function groupedSectionIds(groups: StorefrontSectionGroups | undefined): Set<string> {
  return new Set(groups ? SECTION_GROUP_KEYS.flatMap((key) => groups[key]) : []);
}

/** Reads saved groups (from the database or a published design); anything malformed reads as "no saved groups". */
export function readSectionGroups(value: unknown): StorefrontSectionGroups | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const groups: StorefrontSectionGroups = { header: [], footer: [], overlay: [] };
  for (const key of SECTION_GROUP_KEYS) {
    const list = record[key] ?? [];
    if (!Array.isArray(list) || !list.every((id) => typeof id === "string" && id.length > 0)) return undefined;
    groups[key] = [...new Set(list as string[])].slice(0, MAX_GROUP_SECTIONS);
  }
  return groups;
}
