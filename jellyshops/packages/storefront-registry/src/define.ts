import type { BlockDefinition, SectionDefinition } from "./types.js";

function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

/**
 * Declares a section type. Returns the definition unchanged after checking the mistakes that
 * otherwise show up later as a confusing editor: no type, repeated control keys, default blocks the
 * section does not allow, or more default blocks than the section's own limit.
 */
export function defineSection(definition: SectionDefinition): SectionDefinition {
  if (!definition.type) throw new Error("A section needs a type.");
  const repeated = duplicates(definition.controls.map((control) => control.key));
  if (repeated.length) throw new Error(`Section "${definition.type}" repeats the control key "${repeated[0]}".`);
  const stray = definition.defaultBlocks.find((block) => !definition.allowedBlockTypes.includes(block.type));
  if (stray) throw new Error(`Section "${definition.type}" starts with a "${stray.type}" block it does not allow.`);
  if (definition.maxBlocks !== undefined && definition.defaultBlocks.length > definition.maxBlocks) throw new Error(`Section "${definition.type}" starts with more blocks than its limit of ${definition.maxBlocks}.`);
  if (definition.minBlocks !== undefined && definition.maxBlocks !== undefined && definition.minBlocks > definition.maxBlocks) throw new Error(`Section "${definition.type}" has a minimum above its maximum number of blocks.`);
  return definition;
}

/** Declares a block type, with the same early checks as `defineSection`. */
export function defineBlock(definition: BlockDefinition): BlockDefinition {
  if (!definition.type) throw new Error("A block needs a type.");
  const repeated = duplicates(definition.controls.map((control) => control.key));
  if (repeated.length) throw new Error(`Block "${definition.type}" repeats the control key "${repeated[0]}".`);
  if (definition.maxBlocks !== undefined && !definition.allowedBlockTypes) throw new Error(`Block "${definition.type}" sets a limit on child blocks but does not allow any.`);
  return definition;
}
