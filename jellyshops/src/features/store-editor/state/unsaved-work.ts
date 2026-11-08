/**
 * Keeps the editor's not-yet-saved changes in this browser, so a crash, a closed tab or a lost
 * connection never loses a merchant's work. Every change is remembered when it is made and
 * forgotten once the server has it; on the next visit, anything still remembered that differs
 * from the saved version is offered back ("Restore your last session").
 */

export type UnsavedKind = "template" | "global" | "theme";

export interface UnsavedItem {
  kind: UnsavedKind;
  id: string;
  /** The saved revision this change was made on. */
  baseRevision: number;
  /** A template's layout, a shared section's section, or the theme settings. */
  value: Record<string, unknown>;
}

export interface UnsavedWork {
  version: 1;
  savedAt: number;
  items: Record<string, UnsavedItem>;
}

const storageKey = (storeId: string) => `jelly-editor-unsaved:${storeId}`;
const itemKey = (item: Pick<UnsavedItem, "kind" | "id">) => `${item.kind}:${item.id}`;

/** Same text for the same data whatever order the keys were saved in (the server stores JSON with its own key order). */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function readUnsaved(storeId: string): UnsavedWork | null {
  try {
    const raw = storage()?.getItem(storageKey(storeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UnsavedWork>;
    if (parsed.version !== 1 || typeof parsed.savedAt !== "number" || !parsed.items || typeof parsed.items !== "object") return null;
    const items = Object.fromEntries(Object.entries(parsed.items).filter(([, item]) =>
      item && ["template", "global", "theme"].includes(item.kind) && typeof item.id === "string" && typeof item.baseRevision === "number" && item.value && typeof item.value === "object" && !Array.isArray(item.value)));
    return { version: 1, savedAt: parsed.savedAt, items };
  } catch {
    return null;
  }
}

/** Remembers the latest version of one thing the merchant changed. */
export function rememberUnsaved(storeId: string, item: UnsavedItem, now = Date.now()): void {
  try {
    const current = readUnsaved(storeId);
    const work: UnsavedWork = { version: 1, savedAt: now, items: { ...(current?.items ?? {}), [itemKey(item)]: item } };
    storage()?.setItem(storageKey(storeId), JSON.stringify(work));
  } catch {
    // Storage can be full or blocked (private windows); the editor still works without it.
  }
}

export function clearUnsaved(storeId: string): void {
  try { storage()?.removeItem(storageKey(storeId)); } catch { /* nothing to clear */ }
}

export interface LoadedWorkspace {
  templates: Array<{ id: string; layout: Record<string, unknown> }>;
  globals: Array<{ id: string; section: Record<string, unknown> }>;
  theme: { settings: Record<string, unknown> } | null;
}

/** What was remembered but is not what the server has now (and still exists). */
export function findRestorableWork(work: UnsavedWork, loaded: LoadedWorkspace): UnsavedWork {
  const saved = (item: UnsavedItem): Record<string, unknown> | undefined => {
    if (item.kind === "template") return loaded.templates.find((template) => template.id === item.id)?.layout;
    if (item.kind === "global") return loaded.globals.find((global) => global.id === item.id)?.section;
    return loaded.theme?.settings;
  };
  const items = Object.fromEntries(Object.entries(work.items).filter(([, item]) => {
    const current = saved(item);
    return current !== undefined && stableStringify(current) !== stableStringify(item.value);
  }));
  return { ...work, items };
}

/** "3 changes" style summary for the banner. */
export function describeUnsaved(work: UnsavedWork): string {
  const items = Object.values(work.items);
  const pages = items.filter((item) => item.kind === "template").length;
  const shared = items.filter((item) => item.kind === "global").length;
  const theme = items.some((item) => item.kind === "theme");
  const parts = [
    pages ? `${pages} ${pages === 1 ? "page" : "pages"}` : "",
    shared ? `${shared} shared ${shared === 1 ? "section" : "sections"}` : "",
    theme ? "theme settings" : "",
  ].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] ?? "";
}
