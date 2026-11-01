import type { BlockNode } from "./types.js";

/**
 * Helpers for blocks inside blocks (a "Group" holding headings, text, buttons…).
 * Blocks are addressed by id; ids are unique within a section, so the same
 * helpers work at any depth. None of them change their input.
 */

/** How deep blocks may nest: a section's blocks are level 1, a group's children level 2, a group-in-a-group's children level 3. */
export const MAX_BLOCK_DEPTH = 3;

export interface BlockLocation {
  block: BlockNode;
  /** The block holding this one, or null for a block placed straight in the section. */
  parent: BlockNode | null;
  /** The list the block sits in (the section's blocks or the parent's). */
  siblings: BlockNode[];
  index: number;
  /** 1 for a section's own blocks, 2 for a group's children, 3 inside a group in a group. */
  depth: number;
}

export function childBlocks(block: BlockNode): BlockNode[] {
  return Array.isArray(block.blocks) ? block.blocks : [];
}

export function findBlock(blocks: BlockNode[], id: string, parent: BlockNode | null = null, depth = 1): BlockLocation | null {
  for (const [index, block] of blocks.entries()) {
    if (block.id === id) return { block, parent, siblings: blocks, index, depth };
    const nested = findBlock(childBlocks(block), id, block, depth + 1);
    if (nested) return nested;
  }
  return null;
}

/** Levels of blocks in this block: 1 for a block holding none, 2 for a group of plain blocks, and so on. */
export function blockTreeHeight(block: BlockNode): number {
  return 1 + Math.max(0, ...childBlocks(block).map(blockTreeHeight));
}

/** Every block, children after their parent. */
export function flattenBlocks(blocks: BlockNode[]): BlockNode[] {
  return blocks.flatMap((block) => [block, ...flattenBlocks(childBlocks(block))]);
}

/** A copy with `update` applied to the list that holds `parentId`'s children (or the top-level list when `parentId` is undefined). */
export function updateBlockList(blocks: BlockNode[], parentId: string | undefined, update: (list: BlockNode[]) => BlockNode[]): BlockNode[] {
  if (parentId === undefined) return update([...blocks]);
  return blocks.map((block) => block.id === parentId
    ? { ...block, blocks: update([...childBlocks(block)]) }
    : block.blocks ? { ...block, blocks: updateBlockList(block.blocks, parentId, update) } : block);
}

/** A copy with `update` applied to the block with this id, wherever it is. */
export function updateBlock(blocks: BlockNode[], id: string, update: (block: BlockNode) => BlockNode): BlockNode[] {
  return blocks.map((block) => block.id === id
    ? update(block)
    : block.blocks ? { ...block, blocks: updateBlock(block.blocks, id, update) } : block);
}

/** A deep copy with fresh ids for the block and all its children. */
export function copyBlockWithNewIds(block: BlockNode, createId: () => string): BlockNode {
  const copy: BlockNode = { ...structuredClone(block), id: createId() };
  if (block.blocks) copy.blocks = block.blocks.map((child) => copyBlockWithNewIds(child, createId));
  return copy;
}
