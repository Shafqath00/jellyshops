import type { ConfiguredOptionSelection, ProductOption } from "../domain";

export type ConditionProblem = { optionId: string; code: "self_reference" | "unknown_option" | "unknown_value" | "cycle"; message: string };

/** Options whose condition is met by the current selections, resolved through chains of conditions. */
export function getVisibleOptions(options: ProductOption[], selections: ConfiguredOptionSelection[]): ProductOption[] {
  const byId = new Map(options.map((option) => [option.id, option]));
  const memo = new Map<string, boolean>();
  const visible = (option: ProductOption, trail: Set<string>): boolean => {
    const cached = memo.get(option.id);
    if (cached !== undefined) return cached;
    const condition = option.visibleWhen;
    let result = true;
    if (condition) {
      const controller = byId.get(condition.optionId);
      if (!controller || trail.has(option.id)) result = false;
      else result = visible(controller, new Set(trail).add(option.id)) && selections.some((selection) => selection.optionId === condition.optionId && condition.valueIds.includes(selection.valueId));
    }
    memo.set(option.id, result);
    return result;
  };
  return options.filter((option) => visible(option, new Set()));
}

/** Drops selections that belong to choices hidden by their condition. */
export function dropHiddenSelections(options: ProductOption[], selections: ConfiguredOptionSelection[]): ConfiguredOptionSelection[] {
  const visibleIds = new Set(getVisibleOptions(options, selections).map((option) => option.id));
  return selections.filter((selection) => visibleIds.has(selection.optionId) || !options.some((option) => option.id === selection.optionId));
}

/** Structural problems with the conditions themselves: bad references and cycles. */
export function findConditionProblems(options: ProductOption[]): ConditionProblem[] {
  const byId = new Map(options.map((option) => [option.id, option]));
  const problems: ConditionProblem[] = [];
  for (const option of options) {
    const condition = option.visibleWhen;
    if (!condition) continue;
    if (condition.optionId === option.id) {
      problems.push({ optionId: option.id, code: "self_reference", message: `"${option.name}" cannot depend on itself.` });
      continue;
    }
    const controller = byId.get(condition.optionId);
    if (!controller) {
      problems.push({ optionId: option.id, code: "unknown_option", message: `"${option.name}" depends on a choice that no longer exists.` });
      continue;
    }
    const known = new Set(controller.values.map((value) => value.id));
    if (condition.valueIds.length === 0 || condition.valueIds.some((id) => !known.has(id))) {
      problems.push({ optionId: option.id, code: "unknown_value", message: `"${option.name}" depends on a value of "${controller.name}" that no longer exists.` });
      continue;
    }
    const seen = new Set([option.id]);
    for (let current = controller; ; ) {
      if (seen.has(current.id)) {
        problems.push({ optionId: option.id, code: "cycle", message: `"${option.name}" is part of a circular dependency.` });
        break;
      }
      seen.add(current.id);
      const next = current.visibleWhen && byId.get(current.visibleWhen.optionId);
      if (!next) break;
      current = next;
    }
  }
  return problems;
}
