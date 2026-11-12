import { partSectionType, sectionLabel, type V4StarterPack } from "@jelly/storefront-registry";
import type { BlockNode, PageType, SectionNode } from "@jelly/storefront-schema";
import { discoveredThemes } from "./themes/index.generated.js";
import { createStarterPack } from "./starter-packs.js";
import type { DiscoveredTheme } from "./types.js";

/**
 * Layout revisions: the page layouts a theme's starter has had over time. A theme's `version` never
 * changes (published stores pin it), so a separate revision number says which starter layout a
 * store's draft was built from. Older layouts live in the theme folder's `layout-history.json`; the
 * current `starter.json` is the newest revision. A store on an older revision can be upgraded: the
 * current layout comes in, and everything the merchant changed or added is carried over.
 */

export type LayoutPlacement = { kind: "inline"; section: SectionNode } | { kind: "global"; globalSectionId: string };

/** A store's draft as the upgrade sees it: shared sections and templates (page type in the registry's spelling). */
export interface LayoutDraft {
  globals: Array<{ id: string; section: SectionNode }>;
  templates: Array<{ id: string; type: PageType; handle: string; layout: { sections: LayoutPlacement[] } }>;
}

export interface LayoutRevisionInfo { revision: number; label: string }

interface RevisionLayout extends LayoutRevisionInfo { pack: V4StarterPack }

const CURRENT_LABEL = "Current layout";

function folderTheme(themeId: string): DiscoveredTheme | undefined {
  return discoveredThemes.find((entry) => entry.manifest.id === themeId);
}

/** Every layout the theme's starter has had, oldest first; the last one is the current starter. */
function revisionLayouts(themeId: string): RevisionLayout[] {
  const theme = folderTheme(themeId);
  if (!theme?.starter) return [];
  const history = theme.layoutHistory?.revisions ?? [];
  const layouts: RevisionLayout[] = history.map((revision) => ({
    revision: revision.revision,
    label: revision.label,
    pack: createStarterPack({ manifest: theme.manifest, starter: { globalSections: revision.globalSections, templates: revision.templates } })!,
  }));
  layouts.push({ revision: history.length + 1, label: CURRENT_LABEL, pack: createStarterPack(theme)! });
  return layouts;
}

/** The revision a store installed today gets. Themes without a layout history are on revision 1. */
export function currentLayoutRevision(themeId: string): number {
  return folderTheme(themeId)?.layoutHistory?.revisions.length ? folderTheme(themeId)!.layoutHistory!.revisions.length + 1 : 1;
}

export function layoutRevisions(themeId: string): LayoutRevisionInfo[] {
  return revisionLayouts(themeId).map(({ revision, label }) => ({ revision, label }));
}

/** Installed ids are `<installation>:<starter id>`; the starter id is what links a store's section to the starter. */
export function starterIdOf(id: string): string {
  const index = id.indexOf(":");
  return index === -1 ? id : id.slice(index + 1);
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function same(a: unknown, b: unknown): boolean {
  const sorted = (value: unknown): unknown => Array.isArray(value)
    ? value.map(sorted)
    : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])])) : value;
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

/** Blocks with installation prefixes removed from their ids, for comparing a store's blocks with a starter's. */
function plainBlocks(blocks: BlockNode[] | undefined): unknown {
  return (blocks ?? []).map((block) => ({ ...block, id: starterIdOf(block.id), blocks: plainBlocks(block.blocks) as BlockNode[] }));
}

function plainSection(section: SectionNode): unknown {
  return { ...section, id: starterIdOf(section.id), blocks: plainBlocks(section.blocks) };
}

function inlineSections(placements: LayoutPlacement[]): SectionNode[] {
  return placements.flatMap((placement) => placement.kind === "inline" ? [placement.section] : []);
}


/**
 * Which starter layout the draft was most likely built from, for stores installed before revisions
 * were recorded. Scores each revision by the starter section ids the draft still has, then by how
 * many of those sections still have the starter's exact settings.
 */
export function detectLayoutRevision(themeId: string, draft: LayoutDraft): number {
  const layouts = revisionLayouts(themeId);
  if (!layouts.length) return 1;
  const draftSections = draft.templates.filter((template) => template.handle === "default").flatMap((template) => inlineSections(template.layout.sections).map((section) => ({ type: template.type, section })));
  const draftIds = new Set(draftSections.map(({ type, section }) => `${type}/${starterIdOf(section.id)}`));
  let best = layouts[layouts.length - 1];
  let bestScore = -1;
  for (const layout of layouts) {
    const starterSections = layout.pack.templates.flatMap((template) => inlineSections(template.layout.sections as LayoutPlacement[]).map((section) => ({ type: template.type, section })));
    const ids = new Set(starterSections.map(({ type, section }) => `${type}/${section.id}`));
    const shared = [...ids].filter((id) => draftIds.has(id)).length;
    const union = new Set([...ids, ...draftIds]).size || 1;
    const untouched = starterSections.filter(({ type, section }) => draftSections.some((entry) => entry.type === type && starterIdOf(entry.section.id) === section.id && same(plainSection(entry.section), plainSection(section)))).length;
    const score = (shared / union) * 1000 + untouched;
    if (score >= bestScore) { best = layout; bestScore = score; }
  }
  return best.revision;
}

function rekeyBlocks(blocks: BlockNode[], prefix: string): BlockNode[] {
  return blocks.map((block) => ({ ...block, id: `${prefix}:${block.id}`, ...(block.blocks ? { blocks: rekeyBlocks(block.blocks, prefix) } : {}) }));
}

function rekeySection(section: SectionNode, prefix: string): SectionNode {
  return { ...structuredClone(section), id: `${prefix}:${section.id}`, blocks: rekeyBlocks(structuredClone(section.blocks), prefix) };
}

/** What happened to one section, in terms the merchant's preview can name. */
export interface LayoutSectionChange { type: string; label: string; keptSettings?: string[]; keptBlocks?: boolean }

export interface LayoutPageChange {
  pageType: PageType;
  /** Sections from the new layout that were not on the page before. */
  added: LayoutSectionChange[];
  /** Sections in both layouts where the merchant's own changes were carried over. */
  carried: LayoutSectionChange[];
  /** Sections the merchant added or edited that the new layout has no place for; they are kept at the end of the page. */
  kept: LayoutSectionChange[];
  /** Old starter sections the merchant never changed, replaced by the new layout. */
  removed: LayoutSectionChange[];
  /** New-layout sections left out because the merchant had removed them. */
  skipped: LayoutSectionChange[];
  /** Old sections that became parts of one new section (the product sections inside Main product). */
  combined: LayoutSectionChange[];
}

export interface LayoutUpgradePlan {
  from: LayoutRevisionInfo;
  to: LayoutRevisionInfo;
  draft: LayoutDraft;
  /** Shared sections the new layout needs that the draft does not have yet. */
  newGlobals: Array<{ id: string; name: string; section: SectionNode }>;
  /** Changes to the shared header, footer and announcement bar. */
  shared: Pick<LayoutPageChange, "added" | "carried" | "kept">;
  pages: LayoutPageChange[];
}

const describe = (section: SectionNode, extra: Partial<LayoutSectionChange> = {}): LayoutSectionChange => ({ type: section.type, label: sectionLabel(section.type), ...extra });

/**
 * Section types a new layout may turn into another: Product images became Main product, which keeps the
 * photo settings and gains the product sections as its parts (see `mergeParts`).
 */
const CONVERTS_TO: Record<string, string> = { "product-gallery": "main-product" };

const asSection = (block: BlockNode, type: string): SectionNode => ({ id: block.id, type, enabled: block.enabled, settings: block.settings, blocks: block.blocks ?? [], ...(block.responsive ? { responsive: block.responsive } : {}) });

/**
 * When a page moves to Main product, each of its parts takes the matching old product section (same starter
 * id and type), with the merchant's changes carried over, exactly as a section would. Parts the merchant had
 * removed stay out; new parts come in from the starter.
 */
function mergeParts(target: SectionNode, mine: LayoutPlacement[], used: Set<number>, baseSections: SectionNode[], prefix: string, change: LayoutPageChange): BlockNode[] {
  const blocks: BlockNode[] = [];
  for (const block of target.blocks) {
    const type = partSectionType(block.type);
    if (!type) { blocks.push(rekeyBlocks([structuredClone(block)], prefix)[0]); continue; }
    const oldStarter = baseSections.find((section) => section.id === block.id && section.type === type);
    const index = mine.findIndex((candidate, at) => !used.has(at) && candidate.kind === "inline" && candidate.section.type === type && starterIdOf(candidate.section.id) === block.id);
    if (index === -1) {
      if (oldStarter) { change.skipped.push(describe(oldStarter)); continue; }
      blocks.push(rekeyBlocks([structuredClone(block)], prefix)[0]);
      change.added.push(describe(asSection(block, type)));
      continue;
    }
    const merged = mergeSection(oldStarter, (mine[index] as { section: SectionNode }).section, asSection(block, type), prefix);
    if (!merged) continue;
    used.add(index);
    change.combined.push(describe((mine[index] as { section: SectionNode }).section));
    const { section } = merged;
    blocks.push({ id: section.id, type: block.type, enabled: section.enabled, settings: section.settings, ...(section.blocks.length ? { blocks: section.blocks } : {}), ...(section.responsive ? { responsive: section.responsive } : {}) });
    if (merged.keptSettings.length || merged.keptBlocks) change.carried.push(describe(section, { keptSettings: merged.keptSettings, keptBlocks: merged.keptBlocks }));
  }
  return blocks;
}

/**
 * Three-way merge of one section: the new starter's version, with every setting (and the block list)
 * the merchant changed from the old starter carried over. Returns null when the two cannot be merged
 * (the merchant changed the section's type).
 */
function mergeSection(base: SectionNode | undefined, mine: SectionNode, target: SectionNode, prefix: string): { section: SectionNode; keptSettings: string[]; keptBlocks: boolean } | null {
  if (mine.type !== target.type && CONVERTS_TO[mine.type] !== target.type) return null;
  if (!base) return { section: { ...rekeySection(target, prefix), id: mine.id, enabled: mine.enabled, settings: { ...structuredClone(target.settings), ...structuredClone(mine.settings) }, blocks: structuredClone(mine.blocks) }, keptSettings: Object.keys(mine.settings), keptBlocks: true };
  const settings: Record<string, unknown> = structuredClone(target.settings);
  const keptSettings: string[] = [];
  for (const key of new Set([...Object.keys(base.settings), ...Object.keys(mine.settings)])) {
    if (same(mine.settings[key], base.settings[key])) continue;
    keptSettings.push(key);
    if (key in mine.settings) settings[key] = structuredClone(mine.settings[key]);
    else delete settings[key];
  }
  const keptBlocks = !same(plainBlocks(mine.blocks), plainBlocks(base.blocks));
  const section: SectionNode = {
    ...structuredClone(target),
    id: mine.id,
    enabled: mine.enabled !== base.enabled ? mine.enabled : target.enabled,
    settings,
    blocks: keptBlocks ? structuredClone(mine.blocks) : rekeyBlocks(structuredClone(target.blocks), prefix),
  };
  const responsive = !same(mine.responsive, base.responsive) ? mine.responsive : target.responsive;
  if (responsive) section.responsive = structuredClone(responsive); else delete section.responsive;
  return { section, keptSettings, keptBlocks };
}

/**
 * Moves a draft from layout revision `from` to the current one. Only the default template of each page
 * the new starter designs is rebuilt; alternate templates, menus, pages, products and theme settings are
 * left alone. `prefix` keys sections that come from the new layout (use the store's installation id).
 */
export function planLayoutUpgrade(themeId: string, draft: LayoutDraft, from: number, prefix: string): LayoutUpgradePlan {
  const layouts = revisionLayouts(themeId);
  const base = layouts.find((layout) => layout.revision === from);
  const target = layouts[layouts.length - 1];
  if (!base || !target) throw new Error(`No layout revision ${from} for ${themeId}.`);
  if (from >= target.revision) throw new Error("This draft already uses the current layout.");
  const next: LayoutDraft = structuredClone(draft);

  // Shared sections (announcement, header, footer), matched by starter id.
  const globalRowFor = new Map<string, string>();
  const newGlobals: LayoutUpgradePlan["newGlobals"] = [];
  const globalChanges: LayoutUpgradePlan["shared"] = { added: [], carried: [], kept: [] };
  for (const entry of target.pack.globalSections) {
    const row = next.globals.find((global) => starterIdOf(global.id) === entry.section.id || starterIdOf(global.section.id) === entry.section.id);
    const oldStarter = base.pack.globalSections.find((candidate) => candidate.section.id === entry.section.id)?.section;
    if (!row) {
      const id = `${prefix}:${entry.section.id}`;
      newGlobals.push({ id, name: entry.name, section: rekeySection(entry.section, prefix) });
      globalRowFor.set(entry.section.id, id);
      globalChanges.added.push(describe(entry.section));
      continue;
    }
    globalRowFor.set(entry.section.id, row.id);
    const merged = mergeSection(oldStarter, row.section, entry.section, prefix);
    if (!merged) { globalChanges.kept.push(describe(row.section)); continue; }
    row.section = merged.section;
    if (merged.keptSettings.length || merged.keptBlocks) globalChanges.carried.push(describe(entry.section, { keptSettings: merged.keptSettings, keptBlocks: merged.keptBlocks }));
  }

  const pages: LayoutPageChange[] = [];
  for (const targetTemplate of target.pack.templates) {
    const template = next.templates.find((candidate) => candidate.type === targetTemplate.type && candidate.handle === "default");
    if (!template) continue;
    const baseTemplate = base.pack.templates.find((candidate) => candidate.type === targetTemplate.type);
    const baseSections = baseTemplate ? inlineSections(baseTemplate.layout.sections as LayoutPlacement[]) : [];
    const mine = template.layout.sections;
    const used = new Set<number>();
    const change: LayoutPageChange = { pageType: targetTemplate.type, added: [], carried: [], kept: [], removed: [], skipped: [], combined: [] };
    const placements: LayoutPlacement[] = [];
    for (const placement of targetTemplate.layout.sections as LayoutPlacement[]) {
      if (placement.kind === "global") {
        const rowId = globalRowFor.get(placement.globalSectionId) ?? placement.globalSectionId;
        const index = mine.findIndex((candidate, at) => !used.has(at) && candidate.kind === "global" && candidate.globalSectionId === rowId);
        if (index !== -1) used.add(index);
        placements.push({ kind: "global", globalSectionId: rowId });
        continue;
      }
      const starterId = placement.section.id;
      const oldStarter = baseSections.find((section) => section.id === starterId);
      const index = mine.findIndex((candidate, at) => !used.has(at) && candidate.kind === "inline" && starterIdOf(candidate.section.id) === starterId);
      if (index === -1) {
        if (oldStarter) { change.skipped.push(describe(placement.section)); continue; }
        placements.push({ kind: "inline", section: rekeySection(placement.section, prefix) });
        change.added.push(describe(placement.section));
        continue;
      }
      const current = (mine[index] as { section: SectionNode }).section;
      const merged = mergeSection(oldStarter, current, placement.section, prefix);
      if (!merged) { placements.push({ kind: "inline", section: rekeySection(placement.section, prefix) }); change.added.push(describe(placement.section)); continue; }
      used.add(index);
      // Product images turning into Main product: the old product sections become its parts.
      if (current.type !== placement.section.type) {
        change.combined.push(describe(current));
        merged.section.blocks = mergeParts(placement.section, mine, used, baseSections, prefix, change);
      }
      placements.push({ kind: "inline", section: merged.section });
      if (merged.keptSettings.length || merged.keptBlocks) change.carried.push(describe(placement.section, { keptSettings: merged.keptSettings, keptBlocks: merged.keptBlocks }));
    }
    // Whatever the merchant still has that the new layout did not take: unchanged old starter sections go,
    // anything they edited or added stays, just before the footer.
    const leftovers: LayoutPlacement[] = [];
    mine.forEach((placement, at) => {
      if (used.has(at)) return;
      if (placement.kind === "global") {
        if (!placements.some((candidate) => candidate.kind === "global" && candidate.globalSectionId === placement.globalSectionId)) leftovers.push(placement);
        return;
      }
      const oldStarter = baseSections.find((section) => section.id === starterIdOf(placement.section.id));
      if (oldStarter && same(plainSection(placement.section), plainSection(oldStarter))) { change.removed.push(describe(placement.section)); return; }
      leftovers.push(placement);
      change.kept.push(describe(placement.section));
    });
    const footerAt = placements.findIndex((placement, at) => placement.kind === "global" && at > 0 && placements.slice(at).every((rest) => rest.kind === "global") && placements.slice(0, at).some((before) => before.kind === "inline"));
    if (footerAt === -1) placements.push(...leftovers); else placements.splice(footerAt, 0, ...leftovers);
    template.layout = { ...template.layout, sections: placements };
    pages.push(change);
  }
  return { from: { revision: base.revision, label: base.label }, to: { revision: target.revision, label: target.label }, draft: next, newGlobals, shared: globalChanges, pages };
}
