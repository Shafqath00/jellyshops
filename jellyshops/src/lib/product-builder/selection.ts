import type { ConfiguredOptionSelection, ProductOption } from "../domain";
import { getVisibleOptions } from "./conditions";

export type SelectionProblem = {
  optionId: string;
  code: "unknown_option" | "unknown_value" | "hidden_option" | "duplicate_value" | "single_only" | "required" | "too_few" | "too_many";
  message: string;
};

/**
 * Checks a buyer's selections against the seller's choices. Used by the preview
 * and (later) checkout so both enforce identical rules.
 */
export function validateProductSelections(options: ProductOption[], selections: ConfiguredOptionSelection[]): SelectionProblem[] {
  const problems: SelectionProblem[] = [];
  const byId = new Map(options.map((option) => [option.id, option]));
  const visibleIds = new Set(getVisibleOptions(options, selections).map((option) => option.id));
  const picked = new Map<string, string[]>();

  for (const selection of selections) {
    const option = byId.get(selection.optionId);
    if (!option) {
      problems.push({ optionId: selection.optionId, code: "unknown_option", message: "That choice does not exist." });
      continue;
    }
    if (!option.values.some((value) => value.id === selection.valueId)) {
      problems.push({ optionId: option.id, code: "unknown_value", message: `That is not a valid ${option.name}.` });
      continue;
    }
    if (!visibleIds.has(option.id)) {
      problems.push({ optionId: option.id, code: "hidden_option", message: `${option.name} is not available for this selection.` });
      continue;
    }
    const values = picked.get(option.id) ?? [];
    if (values.includes(selection.valueId)) problems.push({ optionId: option.id, code: "duplicate_value", message: `${option.name} was chosen twice.` });
    else values.push(selection.valueId);
    picked.set(option.id, values);
  }

  for (const option of options) {
    if (!visibleIds.has(option.id)) continue;
    const count = picked.get(option.id)?.length ?? 0;
    const multiple = option.type !== "variant" && option.multiple === true;
    if (count > 1 && !multiple) problems.push({ optionId: option.id, code: "single_only", message: `Choose only one ${option.name}.` });
    const min = Math.max(option.minSelect ?? 0, option.required ? 1 : 0);
    if (count === 0 && option.required) problems.push({ optionId: option.id, code: "required", message: `Please choose a ${option.name}.` });
    else if (count > 0 && count < min) problems.push({ optionId: option.id, code: "too_few", message: `Choose at least ${min} for ${option.name}.` });
    if (multiple && option.maxSelect !== undefined && count > option.maxSelect) problems.push({ optionId: option.id, code: "too_many", message: `Choose at most ${option.maxSelect} for ${option.name}.` });
  }
  return problems;
}
