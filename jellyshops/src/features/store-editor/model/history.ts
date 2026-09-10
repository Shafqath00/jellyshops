import type { StorefrontDocument } from "@jelly/storefront-schema";
import type { EditorHistory } from "./types";

export function createHistory(document: StorefrontDocument): EditorHistory {
  return { past: [], present: document, future: [] };
}

export function execute(history: EditorHistory, document: StorefrontDocument): EditorHistory {
  if (document === history.present) return history;
  return { past: [...history.past, history.present].slice(-100), present: document, future: [] };
}

export function undo(history: EditorHistory): EditorHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo(history: EditorHistory): EditorHistory {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.present].slice(-100), present: next, future: history.future.slice(1) };
}
