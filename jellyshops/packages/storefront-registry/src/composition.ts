import { storefrontPageTypes, type PageType, type SectionNode } from "@jelly/storefront-schema";
import type { AllowedBlockEntry, BlockDefinition, BlockSet, ControlCondition, ControlDefinition, RegionName, SectionDefinition, SectionGroupName, SectionPlacement } from "./types.js";

/**
 * Composition rules shared by the registry, the editor and the backend (theme plan T1, docs/template-analysis.md
 * section 6): block sets, where a section may be placed, conditional settings, section limits and help links.
 * Plain functions with no zod, so they can be used anywhere.
 */

export const BLOCK_SETS: readonly BlockSet[] = ["@content", "@product", "@app"];
export const SECTION_GROUP_NAMES: readonly SectionGroupName[] = ["header", "template", "footer", "overlay"];
const isRegion = (group: SectionGroupName): group is RegionName => group !== "overlay";

export function isBlockSet(entry: AllowedBlockEntry): entry is BlockSet {
  return (BLOCK_SETS as readonly string[]).includes(entry);
}

/** The block types an allowed list stands for: types as written, and each set's members in registry order. */
export function expandBlockTypes(entries: readonly AllowedBlockEntry[], blocks: Iterable<BlockDefinition>): string[] {
  const all = [...blocks];
  const types: string[] = [];
  for (const entry of entries) {
    const members = isBlockSet(entry) ? all.filter((block) => block.sets?.includes(entry)).map((block) => block.type) : [entry];
    for (const type of members) if (!types.includes(type)) types.push(type);
  }
  return types;
}

/** The sets named in an allowed list. */
export function blockSetsIn(entries: readonly AllowedBlockEntry[]): BlockSet[] {
  return entries.filter(isBlockSet);
}

function pagesOf(placement: SectionPlacement | undefined): PageType[] | undefined {
  if (!placement?.pages) return undefined;
  return placement.pages.includes("*") ? [...storefrontPageTypes] : storefrontPageTypes.filter((type) => placement.pages!.includes(type));
}

/**
 * Where a definition may sit, worked out from `enabledOn` / `disabledOn` when given, else from `supportedPages`
 * and `allowedRegions` (old definitions). Without groups the section goes in the page template only.
 */
export function resolvePlacement(definition: Pick<SectionDefinition, "supportedPages" | "allowedRegions" | "enabledOn" | "disabledOn">): { supportedPages: PageType[]; allowedRegions: RegionName[]; groups: SectionGroupName[] } {
  const placed = (supportedPages: PageType[], groups: SectionGroupName[]) => ({ supportedPages, allowedRegions: groups.filter(isRegion), groups });
  if (definition.enabledOn) {
    return placed(pagesOf(definition.enabledOn) ?? [...definition.supportedPages], definition.enabledOn.groups ? [...definition.enabledOn.groups] : [...(definition.allowedRegions ?? ["template"])]);
  }
  if (definition.disabledOn) {
    const blockedPages = pagesOf(definition.disabledOn) ?? [];
    const blockedGroups = definition.disabledOn.groups ?? [];
    const base: PageType[] = definition.supportedPages.length ? definition.supportedPages : [...storefrontPageTypes];
    return placed(base.filter((type) => !blockedPages.includes(type)), (definition.allowedRegions ?? SECTION_GROUP_NAMES).filter((group) => !blockedGroups.includes(group)));
  }
  return placed([...definition.supportedPages], [...(definition.allowedRegions ?? ["template"])]);
}

function conditionMet(condition: ControlCondition, value: unknown): boolean {
  if ("oneOf" in condition && condition.oneOf) return condition.oneOf.includes(value);
  if ("notEquals" in condition) return value !== condition.notEquals;
  return value === condition.equals;
}

/**
 * Whether a control's `showWhen` and `visibleIf` rules hold. `valueOf` gives the value the editor shows for a
 * setting (its saved value, or its default).
 */
export function controlConditionMet(control: Pick<ControlDefinition, "showWhen" | "visibleIf">, valueOf: (key: string) => unknown): boolean {
  if (control.showWhen && valueOf(control.showWhen.key) !== control.showWhen.equals) return false;
  if (control.visibleIf && !conditionMet(control.visibleIf, valueOf(control.visibleIf.key))) return false;
  return true;
}

/** Problems with a condition, for definition checks: it must name exactly one rule. */
export function controlConditionProblem(condition: ControlCondition): string | null {
  if (!condition.key) return "names no setting";
  const rules = ["equals", "oneOf", "notEquals"].filter((rule) => rule in condition);
  if (rules.length !== 1) return "must use exactly one of equals, oneOf or notEquals";
  if ("oneOf" in condition && !Array.isArray(condition.oneOf)) return "oneOf must be a list";
  return null;
}

const HELP_PATH = /^\/help\/[a-z0-9][a-z0-9/-]*$/;
/** A help link is a site path under /help/ or an https address. */
export function isHelpUrl(value: string): boolean {
  if (HELP_PATH.test(value)) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function countByType(sections: SectionNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const section of sections) counts.set(section.type, (counts.get(section.type) ?? 0) + 1);
  return counts;
}

/** Why these sections go over a section's `limit`, or null. */
export function sectionLimitProblem(sections: SectionNode[], definitionOf: (type: string) => Pick<SectionDefinition, "limit"> | undefined, labelOf: (type: string) => string = (type) => type): string | null {
  for (const [type, count] of countByType(sections)) {
    const limit = definitionOf(type)?.limit;
    if (limit !== undefined && count > limit) return `A page can have ${limit === 1 ? "only one" : `at most ${limit}`} "${labelOf(type)}" section${limit === 1 ? "" : "s"}.`;
  }
  return null;
}

/**
 * True (with the reason) when a change adds a copy of a section past its limit. A page that was already over the
 * limit may still be edited, as long as the change doesn't add another copy.
 */
export function breaksSectionLimits(before: SectionNode[], after: SectionNode[], definitionOf: (type: string) => Pick<SectionDefinition, "limit"> | undefined, labelOf?: (type: string) => string): string | null {
  const earlier = countByType(before);
  const grown = after.filter((section, index, list) => {
    const count = list.filter((other) => other.type === section.type).length;
    return list.findIndex((other) => other.type === section.type) === index && count > (earlier.get(section.type) ?? 0);
  });
  return grown.length ? sectionLimitProblem(after.filter((section) => grown.some((type) => type.type === section.type)), definitionOf, labelOf) : null;
}

/** Whether another copy of the section fits on a page with these sections. */
export function sectionFitsLimit(type: string, sections: SectionNode[], definitionOf: (type: string) => Pick<SectionDefinition, "limit"> | undefined): boolean {
  const limit = definitionOf(type)?.limit;
  return limit === undefined || sections.filter((section) => section.type === type).length < limit;
}
