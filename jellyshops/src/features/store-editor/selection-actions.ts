import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { getSectionDefinition } from "@jelly/storefront-registry";

/**
 * Shopify-style actions on the selected section or block of a template layout:
 * move up/down, duplicate, hide/show and delete. Each one returns a new layout
 * (stored placements keep all their fields) or null when the action is not
 * allowed, e.g. moving the first block up or going past a section's block limit.
 */

export type SelectionAction = "move-up" | "move-down" | "duplicate" | "toggle" | "remove";
export interface SelectionTarget { sectionId: string; blockId?: string }

type Placement = Record<string, unknown> & { kind?: unknown; section?: unknown };

function placements(layout: Record<string, unknown>): Placement[] {
  return Array.isArray(layout.sections) ? structuredClone(layout.sections) as Placement[] : [];
}

function inlineIndex(items: Placement[], sectionId: string): number {
  return items.findIndex((item) => item?.kind === "inline" && (item.section as SectionNode | undefined)?.id === sectionId);
}

function withSections(layout: Record<string, unknown>, sections: Placement[]): Record<string, unknown> {
  return { ...structuredClone(layout), sections };
}

/** The section (in the template, not a shared one) and block the target points at. */
export function findTarget(layout: Record<string, unknown>, target: SelectionTarget): { section: SectionNode; sectionIndex: number; sectionCount: number; block?: BlockNode; blockIndex: number } | null {
  const items = placements(layout);
  const sectionIndex = inlineIndex(items, target.sectionId);
  if (sectionIndex < 0) return null;
  const section = items[sectionIndex].section as SectionNode;
  const blockIndex = target.blockId ? section.blocks.findIndex((block) => block.id === target.blockId) : -1;
  if (target.blockId && blockIndex < 0) return null;
  return { section, sectionIndex, sectionCount: items.length, block: blockIndex >= 0 ? section.blocks[blockIndex] : undefined, blockIndex };
}

/** Which actions make sense for the target right now. */
export function availableActions(layout: Record<string, unknown>, target: SelectionTarget): Record<SelectionAction, boolean> {
  const found = findTarget(layout, target);
  if (!found) return { "move-up": false, "move-down": false, duplicate: false, toggle: false, remove: false };
  if (!found.block) {
    return { "move-up": found.sectionIndex > 0, "move-down": found.sectionIndex < found.sectionCount - 1, duplicate: true, toggle: true, remove: true };
  }
  const definition = getSectionDefinition(found.section.type);
  const count = found.section.blocks.length;
  return {
    "move-up": found.blockIndex > 0,
    "move-down": found.blockIndex < count - 1,
    duplicate: definition?.maxBlocks === undefined || count < definition.maxBlocks,
    toggle: true,
    remove: definition?.minBlocks === undefined || count > definition.minBlocks,
  };
}

function withNewIds(section: SectionNode, createId: () => string): SectionNode {
  return { ...structuredClone(section), id: createId(), blocks: section.blocks.map((block) => ({ ...structuredClone(block), id: createId() })) };
}

/**
 * Applies an action and returns the new layout plus what should be selected next
 * (the copy after duplicating, the parent section after deleting a block).
 */
export function applySelectionAction(
  layout: Record<string, unknown>,
  target: SelectionTarget,
  action: SelectionAction,
  createId: () => string = () => crypto.randomUUID(),
): { layout: Record<string, unknown>; select: SelectionTarget | null } | null {
  if (!availableActions(layout, target)[action]) return null;
  const items = placements(layout);
  const index = inlineIndex(items, target.sectionId);
  const section = items[index].section as SectionNode;

  if (!target.blockId) {
    if (action === "move-up" || action === "move-down") {
      const to = action === "move-up" ? index - 1 : index + 1;
      [items[index], items[to]] = [items[to], items[index]];
      return { layout: withSections(layout, items), select: target };
    }
    if (action === "duplicate") {
      const copy = withNewIds(section, createId);
      items.splice(index + 1, 0, { ...structuredClone(items[index]), section: copy });
      return { layout: withSections(layout, items), select: { sectionId: copy.id } };
    }
    if (action === "toggle") {
      items[index] = { ...items[index], section: { ...section, enabled: !section.enabled } };
      return { layout: withSections(layout, items), select: target };
    }
    items.splice(index, 1);
    return { layout: withSections(layout, items), select: null };
  }

  const blocks = [...section.blocks];
  const blockIndex = blocks.findIndex((block) => block.id === target.blockId);
  let select: SelectionTarget | null = target;
  if (action === "move-up" || action === "move-down") {
    const to = action === "move-up" ? blockIndex - 1 : blockIndex + 1;
    [blocks[blockIndex], blocks[to]] = [blocks[to], blocks[blockIndex]];
  } else if (action === "duplicate") {
    const copy = { ...structuredClone(blocks[blockIndex]), id: createId() };
    blocks.splice(blockIndex + 1, 0, copy);
    select = { sectionId: section.id, blockId: copy.id };
  } else if (action === "toggle") {
    blocks[blockIndex] = { ...blocks[blockIndex], enabled: !blocks[blockIndex].enabled };
  } else {
    blocks.splice(blockIndex, 1);
    select = { sectionId: section.id };
  }
  items[index] = { ...items[index], section: { ...section, blocks } };
  return { layout: withSections(layout, items), select };
}
