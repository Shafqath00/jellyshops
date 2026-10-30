import type { BlockLocation, BlockNode, SectionNode } from "@jelly/storefront-schema";
import { childBlocks, copyBlockWithNewIds, findBlock, MAX_BLOCK_DEPTH, updateBlock, updateBlockList } from "@jelly/storefront-schema";
import { getBlockDefinition } from "@jelly/storefront-registry";

/**
 * Editor helpers for blocks at any depth (a section's blocks and the blocks
 * inside a group): find the selected one, change its settings, add a new one.
 */

export function locateBlock(section: SectionNode | null | undefined, blockId: string | undefined): BlockLocation | null {
  return section && blockId ? findBlock(section.blocks, blockId) : null;
}

export function patchBlockSettings(section: SectionNode, blockId: string, patch: Record<string, unknown>): SectionNode {
  return { ...section, blocks: updateBlock(section.blocks, blockId, (block) => ({ ...block, settings: { ...block.settings, ...patch } })) };
}

/** A new block with its default settings and, for a group, its starter blocks (with fresh ids). */
export function createBlock(type: string, createId: () => string = () => crypto.randomUUID()): BlockNode | null {
  const definition = getBlockDefinition(type);
  if (!definition) return null;
  const block: BlockNode = { id: createId(), type, enabled: true, settings: structuredClone(definition.defaultSettings) };
  if (definition.allowedBlockTypes) block.blocks = (definition.defaultBlocks ?? []).map((child) => copyBlockWithNewIds(child, createId));
  return block;
}

/** Adds a block at the end of the section, or of the group `parentId`. */
export function addBlockTo(section: SectionNode, parentId: string | undefined, block: BlockNode): SectionNode {
  return { ...section, blocks: updateBlockList(section.blocks, parentId, (list) => [...list, block]) };
}

/** The block types a selected block can hold, and whether it has room for more. Empty for blocks that hold none. */
export function childBlockOptions(section: SectionNode, blockId: string): { types: string[]; full: boolean } {
  const location = findBlock(section.blocks, blockId);
  const definition = location ? getBlockDefinition(location.block.type) : undefined;
  if (!location || !definition?.allowedBlockTypes || location.depth >= MAX_BLOCK_DEPTH) return { types: [], full: false };
  const count = childBlocks(location.block).length;
  return { types: definition.allowedBlockTypes, full: definition.maxBlocks !== undefined && count >= definition.maxBlocks };
}
