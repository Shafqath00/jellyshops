export function createSessionHistory<T>(limit = 50) {
  let scope = ""; let entries: T[] = []; let cursor = 0;
  return {
    push(nextScope: string, entry: T) {
      if (scope !== nextScope) { scope = nextScope; entries = []; cursor = 0; }
      entries = [...entries.slice(0, cursor), structuredClone(entry)].slice(-limit);
      cursor = entries.length;
    },
    undo(nextScope: string): T | null { return scope === nextScope && cursor > 0 ? structuredClone(entries[--cursor]) : null; },
    redo(nextScope: string): T | null { return scope === nextScope && cursor < entries.length ? structuredClone(entries[cursor++]) : null; },
    canUndo(nextScope: string) { return scope === nextScope && cursor > 0; },
    canRedo(nextScope: string) { return scope === nextScope && cursor < entries.length; },
    clear() { entries = []; cursor = 0; scope = ""; },
  };
}
