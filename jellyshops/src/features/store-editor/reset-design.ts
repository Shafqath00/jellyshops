import { getBlockDefinition, getSectionDefinition, type ControlDefinition } from "@jelly/storefront-registry";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";

/**
 * "Reset design": puts a section's look back to its defaults while keeping what the merchant wrote. Every setting
 * outside the Content group (layout, style, advanced, element styles) returns to the section's default, or is removed
 * when it has none; phone and tablet values for those settings are removed; blocks are reset the same way. Content
 * (text, photos, links, products, collections) and the merchant's own custom CSS stay. Phase 6 of
 * docs/reports/2026-11-09-shopify-template-parity.md ("Safe customisation").
 */
const KEPT_KEYS = new Set(["customCss", "translations"]);

/** The setting keys a reset puts back: design settings, never content or custom code. */
export function designKeys(controls: readonly ControlDefinition[]): string[] {
  return controls.filter((control) => (control.group !== "content" || control.element) && !KEPT_KEYS.has(control.key)).map((control) => control.key);
}

type Node = { settings: Record<string, unknown>; responsive?: SectionNode["responsive"] };

function resetNode<T extends Node>(node: T, controls: readonly ControlDefinition[], defaults: Record<string, unknown>): T {
  const keys = designKeys(controls);
  const settings = { ...node.settings };
  for (const key of keys) {
    if (key in defaults) settings[key] = structuredClone(defaults[key]);
    else delete settings[key];
  }
  // The older "Background" choice is part of the look too (it was replaced by colour schemes).
  if (!("colorScheme" in defaults)) delete settings.colorScheme;
  const { responsive, ...rest } = node;
  const kept: NonNullable<SectionNode["responsive"]> = {};
  for (const [device, values] of Object.entries(responsive ?? {}) as Array<[keyof NonNullable<SectionNode["responsive"]>, Record<string, unknown> | undefined]>) {
    if (!values) continue;
    const left = Object.fromEntries(Object.entries(values).filter(([key]) => !keys.includes(key)));
    if (Object.keys(left).length) kept[device] = left as never;
  }
  return { ...rest, settings, ...(Object.keys(kept).length ? { responsive: kept } : {}) } as T;
}

function resetBlock(block: BlockNode): BlockNode {
  const definition = getBlockDefinition(block.type);
  const reset = definition ? resetNode(block, definition.controls, definition.defaultSettings) : block;
  return { ...reset, ...(block.blocks ? { blocks: block.blocks.map(resetBlock) } : {}) };
}

/** The section with its design (and its blocks' design) back to the defaults; content and custom CSS kept. */
export function resetSectionDesign(section: SectionNode, themeVersion?: string | null): SectionNode {
  const definition = getSectionDefinition(section.type, themeVersion);
  if (!definition) return section;
  return { ...resetNode(section, definition.controls, definition.defaultSettings), blocks: section.blocks.map(resetBlock) };
}
