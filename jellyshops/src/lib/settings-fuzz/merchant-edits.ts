import { breaksEssentialSections, getSectionDefinition } from "@jelly/storefront-registry";
import type { PageType, RuntimeStorefrontSnapshotV4, SectionNode } from "@jelly/storefront-schema";
import { FONT_OPTIONS } from "@jelly/storefront-themes";
import { seededRandom } from "./generate";

/**
 * Merchant-edit fuzz (Phase 6 quality gate): the edits a merchant makes to a theme's starter pages in the editor:
 * sections moved around, colour schemes swapped, other fonts picked, optional blocks removed. A theme must still lay
 * out and stay readable afterwards. Seeded, so a failure is reproduced by its number (theme preview `?edits=<seed>`).
 * Every edit is one the editor allows: essential sections stay, blocks never drop below a section's minimum.
 */
const SCHEMES = ["", "scheme1", "scheme2", "scheme3", "scheme4"] as const;
const FIXED_FIRST = new Set(["hero", "slideshow", "image-banner", "collection-header", "main-product", "product-gallery"]);

const pick = <T,>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)];

function shuffled<T>(random: () => number, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function editSection(random: () => number, section: SectionNode): SectionNode {
  const settings = { ...section.settings };
  // Half the sections get a different colour scheme (or none); own colours are left as the merchant set them.
  if (random() < 0.5 && settings.styleColors !== true) {
    const scheme = pick(random, SCHEMES);
    if (scheme) settings.styleScheme = scheme; else delete settings.styleScheme;
    delete settings.colorScheme;
  }
  let blocks = section.blocks ?? [];
  const minimum = getSectionDefinition(section.type)?.minBlocks ?? 0;
  // A third of the sections lose one of their blocks, never below the section's minimum.
  if (blocks.length > Math.max(1, minimum) && random() < 0.34) {
    const drop = Math.floor(random() * blocks.length);
    blocks = blocks.filter((_, index) => index !== drop);
  }
  return { ...section, settings, blocks };
}

/** The template's inline sections, reordered and edited. Shared sections and a leading banner keep their place. */
function editLayout(random: () => number, pageType: PageType, sections: SectionNode[]): SectionNode[] {
  const [first, ...rest] = sections;
  const keepFirst = first && FIXED_FIRST.has(first.type);
  const movable = keepFirst ? rest : sections;
  const edited = shuffled(random, movable).map((section) => editSection(random, section));
  const next = keepFirst ? [editSection(random, first), ...edited] : edited;
  // Never an edit the editor would refuse (removing a page's essential section).
  return breaksEssentialSections(pageType, sections, next) ? sections : next;
}

type Placement = { kind: string; section?: SectionNode };

/** A copy of the snapshot with the starter pages edited the way a merchant might (seeded). */
export function merchantEditedSnapshot(snapshot: RuntimeStorefrontSnapshotV4, seed: number): RuntimeStorefrontSnapshotV4 {
  const random = seededRandom(seed);
  const copy = structuredClone(snapshot);
  for (const template of Object.values(copy.templates)) {
    const layout = template.layout as { sections?: Placement[] };
    const placements = layout.sections ?? [];
    const inline = placements.filter((placement) => placement.kind === "inline" && placement.section).map((placement) => placement.section as SectionNode);
    const edited = editLayout(random, template.type as PageType, inline);
    let next = 0;
    layout.sections = placements.map((placement) => placement.kind === "inline" && placement.section ? { ...placement, section: edited[next++] } : placement);
  }
  return copy;
}

/** Theme settings with other heading and body fonts, as picked in theme settings > Typography (seeded). */
export function merchantEditedSettings(settings: Record<string, unknown>, seed: number): Record<string, unknown> {
  const random = seededRandom(seed * 7919);
  const typography = { ...(settings.typography as Record<string, unknown> | undefined ?? {}) };
  typography.headingFont = pick(random, FONT_OPTIONS).value;
  typography.bodyFont = pick(random, FONT_OPTIONS).value;
  return { ...settings, typography };
}
