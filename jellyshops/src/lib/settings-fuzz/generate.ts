import { getBlockDefinition, getSectionDefinition, type ControlDefinition } from "@jelly/storefront-registry";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";

/**
 * Settings fuzz (phase 6 of docs/reports/2026-11-09-shopify-template-parity.md): random but valid combinations of a
 * section's own settings, as a merchant could pick them in the editor, so tests can check that no combination
 * breaks the page. Every value is checked against the section's (or block's) own settings schema before it is
 * kept, so each result is something the editor could save. Seeded: a failure is reproduced by its seed.
 */

/** A small, fast, seeded random number generator (mulberry32): the same seed gives the same sequence. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Texts a merchant might type: empty, short, ordinary, a whole sentence, one unbroken word. */
export const FUZZ_TEXTS = [
  "",
  "Hi",
  "An ordinary heading",
  "A very long heading that a merchant wrote as a whole sentence, because that is what felt natural at the time",
  "Supercalifragilisticexpialidociouswordwithoutanyspaces",
] as const;
/** Colours from very dark to very light, plus a strong red and green. */
export const FUZZ_COLOURS = ["#000000", "#ffffff", "#1c1b19", "#d14b3a", "#2f6f4e", "#f3e9d2"] as const;
const FUZZ_LINKS = ["/shop", "https://example.com/page", ""] as const;
/** Settings the fuzz leaves alone: free code, other languages, and saved links to store data. */
const SKIPPED_KEYS = new Set(["customCss", "translations"]);

const pick = <T,>(rng: () => number, values: readonly T[]): T => values[Math.floor(rng() * values.length) % values.length];

/** A random value for one control, or undefined when the fuzz does not change this kind of setting. */
export function randomControlValue(control: ControlDefinition, rng: () => number, photos: readonly string[]): unknown {
  switch (control.type) {
    case "text": case "textarea": case "rich-text": return pick(rng, FUZZ_TEXTS).slice(0, control.maxLength);
    case "select": case "segmented": return control.options.length ? pick(rng, control.options).value : undefined;
    case "checkbox": return rng() < 0.5;
    case "range": case "number": {
      const steps = Math.max(0, Math.floor((control.max - control.min) / (control.step || 1)));
      return control.min + Math.floor(rng() * (steps + 1)) * (control.step || 1);
    }
    case "color": return pick(rng, FUZZ_COLOURS);
    case "image": return photos.length ? { url: pick(rng, photos), alt: "" } : undefined;
    case "link": return pick(rng, FUZZ_LINKS);
    default: return undefined; // fonts, spacing boxes, product and collection pickers keep their value
  }
}

/** The settings with every fuzzable control set at random, keeping only values the schema accepts. */
export function fuzzSettings(settings: Record<string, unknown>, controls: readonly ControlDefinition[], schema: { safeParse(value: unknown): { success: boolean } }, rng: () => number, photos: readonly string[]): Record<string, unknown> {
  let next = { ...settings };
  for (const control of controls) {
    if (SKIPPED_KEYS.has(control.key) || control.legacy || control.dynamicTypes?.length && typeof next[control.key] === "object" && next[control.key] !== null && "kind" in (next[control.key] as object)) continue;
    const value = randomControlValue(control, rng, photos);
    if (value === undefined) continue;
    const candidate = { ...next, [control.key]: value };
    if (schema.safeParse(candidate).success) next = candidate;
  }
  return next;
}

function fuzzBlock(block: BlockNode, rng: () => number, photos: readonly string[]): BlockNode {
  const definition = getBlockDefinition(block.type);
  const settings = definition ? fuzzSettings(block.settings, definition.controls, definition.settingsSchema, rng, photos) : block.settings;
  return { ...block, settings, ...(block.blocks ? { blocks: block.blocks.map((child) => fuzzBlock(child, rng, photos)) } : {}) };
}

/** The section with random valid settings for itself and every block in it (blocks keep their order and count). */
export function fuzzSection(section: SectionNode, rng: () => number, photos: readonly string[]): SectionNode {
  const definition = getSectionDefinition(section.type);
  if (!definition) return section;
  return {
    ...section,
    settings: fuzzSettings(section.settings, definition.controls, definition.settingsSchema, rng, photos),
    blocks: section.blocks.map((block) => fuzzBlock(block, rng, photos)),
  };
}
