import { BLOCK_SETS, controlConditionProblem, isBlockSet, isHelpUrl } from "./composition.js";
import type { AllowedBlockEntry, BlockDefinition, ControlDefinition, SectionDefinition } from "./types.js";

function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function checkEntries(owner: string, entries: readonly AllowedBlockEntry[] | undefined): void {
  const unknownSet = entries?.find((entry) => entry.startsWith("@") && !isBlockSet(entry));
  if (unknownSet) throw new Error(`${owner} accepts "${unknownSet}", which is not a block set (use ${BLOCK_SETS.join(", ")}).`);
}

function checkControls(owner: string, controls: ControlDefinition[]): void {
  for (const control of controls) {
    const problem = control.visibleIf ? controlConditionProblem(control.visibleIf) : null;
    if (problem) throw new Error(`${owner}: the visibleIf rule of "${control.key}" ${problem}.`);
  }
}

function checkHelpUrl(owner: string, helpUrl: string | undefined): void {
  if (helpUrl !== undefined && !isHelpUrl(helpUrl)) throw new Error(`${owner} has a help link that is neither a /help/ path nor an https address.`);
}

/**
 * Declares a section type. Returns the definition unchanged after checking the mistakes that
 * otherwise show up later as a confusing editor: no type, repeated control keys, default blocks the
 * section does not allow, more default blocks than the section's own limit, unknown block sets,
 * repeated static blocks, a bad limit or help link.
 */
export function defineSection(definition: SectionDefinition): SectionDefinition {
  if (!definition.type) throw new Error("A section needs a type.");
  const owner = `Section "${definition.type}"`;
  const repeated = duplicates(definition.controls.map((control) => control.key));
  if (repeated.length) throw new Error(`${owner} repeats the control key "${repeated[0]}".`);
  checkEntries(owner, definition.allowedBlockTypes);
  checkControls(owner, definition.controls);
  checkHelpUrl(owner, definition.helpUrl);
  const staticTypes = (definition.staticBlocks ?? []).map((block) => block.type);
  // Blocks from a set can only be checked once every block is registered (registry.ts does it).
  const usesSets = definition.allowedBlockTypes.some(isBlockSet);
  const stray = definition.defaultBlocks.find((block) => !definition.allowedBlockTypes.includes(block.type) && !staticTypes.includes(block.type) && !usesSets);
  if (stray) throw new Error(`${owner} starts with a "${stray.type}" block it does not allow.`);
  const counted = definition.defaultBlocks.filter((block) => !staticTypes.includes(block.type)).length;
  if (definition.maxBlocks !== undefined && counted > definition.maxBlocks) throw new Error(`${owner} starts with more blocks than its limit of ${definition.maxBlocks}.`);
  if (definition.minBlocks !== undefined && definition.maxBlocks !== undefined && definition.minBlocks > definition.maxBlocks) throw new Error(`${owner} has a minimum above its maximum number of blocks.`);
  if (definition.limit !== undefined && definition.limit !== 1 && definition.limit !== 2) throw new Error(`${owner} has a limit of ${String(definition.limit)}; use 1 or 2.`);
  if (definition.enabledOn && definition.disabledOn) throw new Error(`${owner} uses both enabledOn and disabledOn; use one.`);
  const repeatedStatic = duplicates(staticTypes);
  if (repeatedStatic.length) throw new Error(`${owner} lists the static block "${repeatedStatic[0]}" twice.`);
  return definition;
}

/** Declares a block type, with the same early checks as `defineSection`. */
export function defineBlock(definition: BlockDefinition): BlockDefinition {
  if (!definition.type) throw new Error("A block needs a type.");
  const owner = `Block "${definition.type}"`;
  const repeated = duplicates(definition.controls.map((control) => control.key));
  if (repeated.length) throw new Error(`${owner} repeats the control key "${repeated[0]}".`);
  if (definition.maxBlocks !== undefined && !definition.allowedBlockTypes) throw new Error(`${owner} sets a limit on child blocks but does not allow any.`);
  checkEntries(owner, definition.allowedBlockTypes);
  checkControls(owner, definition.controls);
  checkHelpUrl(owner, definition.helpUrl);
  const unknownSet = definition.sets?.find((set) => !isBlockSet(set));
  if (unknownSet) throw new Error(`${owner} joins "${unknownSet}", which is not a block set.`);
  return definition;
}
