/**
 * Undo/redo for one editing session, kept per scope (store + page) so switching
 * to another page and back keeps that page's history. At most `scopeLimit`
 * pages are remembered; the least recently used one is dropped first.
 */
export function createSessionHistory<T>(limit = 50, scopeLimit = 20) {
  const scopes = new Map<string, { entries: T[]; cursor: number }>();
  const read = (scope: string) => scopes.get(scope);
  const touch = (scope: string) => {
    const stack = scopes.get(scope) ?? { entries: [], cursor: 0 };
    scopes.delete(scope);
    scopes.set(scope, stack);
    while (scopes.size > scopeLimit) scopes.delete(scopes.keys().next().value as string);
    return stack;
  };
  return {
    push(scope: string, entry: T) {
      const stack = touch(scope);
      stack.entries = [...stack.entries.slice(0, stack.cursor), structuredClone(entry)].slice(-limit);
      stack.cursor = stack.entries.length;
    },
    undo(scope: string): T | null {
      const stack = read(scope);
      return stack && stack.cursor > 0 ? structuredClone(touch(scope).entries[--stack.cursor]) : null;
    },
    redo(scope: string): T | null {
      const stack = read(scope);
      return stack && stack.cursor < stack.entries.length ? structuredClone(touch(scope).entries[stack.cursor++]) : null;
    },
    canUndo(scope: string) { return (read(scope)?.cursor ?? 0) > 0; },
    canRedo(scope: string) { const stack = read(scope); return Boolean(stack && stack.cursor < stack.entries.length); },
    clear() { scopes.clear(); },
  };
}
