import type { BlockLocation, BlockNode, SectionNode } from "@jelly/storefront-schema";
import { childBlocks, copyBlockWithNewIds, findBlock, updateBlock, updateBlockList } from "@jelly/storefront-schema";
import { getBlockDefinition, getSectionDefinition } from "@jelly/storefront-registry";

/**
 * Shopify-style actions on the selected section or block of a template layout:
 * move up/down, duplicate, hide/show, delete, and for blocks moving into the
 * group above or out of their group. Blocks are found at any depth. Each action
 * returns a new layout (stored placements keep all their fields) or null when it
 * is not allowed, e.g. moving the first block up or going past a block limit.
 */

export type SelectionAction = "move-up" | "move-down" | "duplicate" | "toggle" | "remove" | "group-in" | "group-out";
export interface SelectionTarget { sectionId: string; blockId?: string }

type Placement = Record<string, unknown> & { kind?: unknown; section?: unknown };

const none: Record<SelectionAction, boolean> = { "move-up": false, "move-down": false, duplicate: false, toggle: false, remove: false, "group-in": false, "group-out": false };

function placements(layout: Record<string, unknown>): Placement[] {
  return Array.isArray(layout.sections) ? structuredClone(layout.sections) as Placement[] : [];
}

function inlineIndex(items: Placement[], sectionId: string): number {
  return items.findIndex((item) => item?.kind === "inline" && (item.section as SectionNode | undefined)?.id === sectionId);
}

function withSections(layout: Record<string, unknown>, sections: Placement[]): Record<string, unknown> {
  return { ...structuredClone(layout), sections };
}

/** The rules for the list a block sits in: its section's, or its group's. */
function listRules(section: SectionNode, parent: BlockNode | null): { allowed: string[]; min?: number; max?: number } {
  if (parent) {
    const definition = getBlockDefinition(parent.type);
    return { allowed: definition?.allowedBlockTypes ?? [], max: definition?.maxBlocks };
  }
  const definition = getSectionDefinition(section.type);
  return { allowed: definition?.allowedBlockTypes ?? [], min: definition?.minBlocks, max: definition?.maxBlocks };
}

function hasRoom(rules: { max?: number }, count: number): boolean {
  return rules.max === undefined || count < rules.max;
}

/** The group just above a top-level block, when the block may go inside it. */
function groupAbove(location: BlockLocation): BlockNode | null {
  if (location.parent || location.index === 0) return null;
  const above = location.siblings[location.index - 1];
  const definition = getBlockDefinition(above.type);
  if (!definition?.allowedBlockTypes?.includes(location.block.type)) return null;
  return hasRoom({ max: definition.maxBlocks }, childBlocks(above).length) ? above : null;
}

/** The section (in the template, not a shared one) and block the target points at. */
export function findTarget(layout: Record<string, unknown>, target: SelectionTarget): { section: SectionNode; sectionIndex: number; sectionCount: number; block?: BlockNode; location?: BlockLocation } | null {
  const items = placements(layout);
  const sectionIndex = inlineIndex(items, target.sectionId);
  if (sectionIndex < 0) return null;
  const section = items[sectionIndex].section as SectionNode;
  if (!target.blockId) return { section, sectionIndex, sectionCount: items.length };
  const location = findBlock(section.blocks, target.blockId);
  return location ? { section, sectionIndex, sectionCount: items.length, block: location.block, location } : null;
}

/** Which actions make sense for the target right now. */
export function availableActions(layout: Record<string, unknown>, target: SelectionTarget): Record<SelectionAction, boolean> {
  const found = findTarget(layout, target);
  if (!found) return { ...none };
  const { section, location } = found;
  if (!location) {
    return { ...none, "move-up": found.sectionIndex > 0, "move-down": found.sectionIndex < found.sectionCount - 1, duplicate: true, toggle: true, remove: true };
  }
  const rules = listRules(section, location.parent);
  const count = location.siblings.length;
  const sectionRules = listRules(section, null);
  return {
    "move-up": location.index > 0,
    "move-down": location.index < count - 1,
    duplicate: hasRoom(rules, count),
    toggle: true,
    remove: rules.min === undefined || count > rules.min,
    "group-in": groupAbove(location) !== null,
    "group-out": location.parent !== null && sectionRules.allowed.includes(location.block.type) && hasRoom(sectionRules, section.blocks.length),
  };
}

function withNewIds(section: SectionNode, createId: () => string): SectionNode {
  return { ...structuredClone(section), id: createId(), blocks: section.blocks.map((block) => copyBlockWithNewIds(block, createId)) };
}

/**
 * Applies an action and returns the new layout plus what should be selected next
 * (the copy after duplicating, the parent after deleting a block).
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

  const location = findBlock(section.blocks, target.blockId)!;
  const { block, parent } = location;
  const parentId = parent?.id;
  let blocks = section.blocks;
  let select: SelectionTarget | null = target;
  if (action === "move-up" || action === "move-down") {
    const to = action === "move-up" ? location.index - 1 : location.index + 1;
    blocks = updateBlockList(blocks, parentId, (list) => { [list[location.index], list[to]] = [list[to], list[location.index]]; return list; });
  } else if (action === "duplicate") {
    const copy = copyBlockWithNewIds(block, createId);
    blocks = updateBlockList(blocks, parentId, (list) => { list.splice(location.index + 1, 0, copy); return list; });
    select = { sectionId: section.id, blockId: copy.id };
  } else if (action === "toggle") {
    blocks = updateBlock(blocks, block.id, (current) => ({ ...current, enabled: !current.enabled }));
  } else if (action === "remove") {
    blocks = updateBlockList(blocks, parentId, (list) => list.filter((item) => item.id !== block.id));
    select = parent ? { sectionId: section.id, blockId: parent.id } : { sectionId: section.id };
  } else if (action === "group-in") {
    const group = groupAbove(location)!;
    blocks = blocks.filter((item) => item.id !== block.id);
    blocks = updateBlock(blocks, group.id, (current) => ({ ...current, blocks: [...childBlocks(current), block] }));
  } else {
    // Out of the group: placed straight after it in the section.
    blocks = updateBlockList(blocks, parentId, (list) => list.filter((item) => item.id !== block.id));
    const groupIndex = blocks.findIndex((item) => item.id === parentId);
    blocks = [...blocks.slice(0, groupIndex + 1), block, ...blocks.slice(groupIndex + 1)];
  }
  items[index] = { ...items[index], section: { ...section, blocks } };
  return { layout: withSections(layout, items), select };
}
