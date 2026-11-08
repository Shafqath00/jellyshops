import { COLOR_SCHEME_IDS, colorSchemeCount, colorSchemeLabel, resolveTheme } from "@jelly/storefront-themes";

/**
 * The colours the editor offers as one-click choices: the theme's base colours
 * and the colours of every colour scheme in use, plus the colours the merchant
 * used lately (kept in this browser).
 */
export interface PaletteColor { label: string; color: string }

const hex = /^#[0-9a-fA-F]{6}$/;
const baseColors: Array<[string, string]> = [["background", "Page background"], ["surface", "Cards and panels"], ["text", "Text"], ["secondary", "Soft text"], ["primary", "Buttons"], ["accent", "Highlight"]];
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const normalizeHex = (value: string): string | null => {
  const text = value.trim();
  if (hex.test(text)) return text.toLowerCase();
  return /^[0-9a-fA-F]{6}$/.test(text) ? `#${text.toLowerCase()}` : null;
};

/** The theme's colours with names, without repeats (the first name for a colour wins). */
export function themePalette(themeId: string | undefined, settings: Record<string, unknown> | undefined, version?: string): PaletteColor[] {
  const theme = resolveTheme(themeId, settings ?? {}, version);
  const colors = record(theme.settings.colors);
  const found: PaletteColor[] = [];
  const add = (label: string, value: unknown) => {
    const color = typeof value === "string" ? normalizeHex(value) : null;
    if (color && !found.some((item) => item.color === color)) found.push({ label, color });
  };
  for (const [key, label] of baseColors) add(label, colors[key]);
  const count = colorSchemeCount(theme.settings);
  const schemes = record(theme.settings.colorSchemes);
  for (const id of COLOR_SCHEME_IDS.slice(0, count)) {
    const scheme = record(schemes[id]);
    const name = colorSchemeLabel(theme.settings, id);
    add(`${name} background`, scheme.background);
    add(`${name} text`, scheme.text);
    add(`${name} button`, scheme.button);
  }
  return found;
}

const storageKey = "jelly-editor-recent-colors";
export const MAX_RECENT_COLORS = 8;

export function readRecentColors(storage: Pick<Storage, "getItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage): string[] {
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && hex.test(item)).slice(0, MAX_RECENT_COLORS) : [];
  } catch { return []; }
}

/** Puts a colour first in the recent list (newest first, no repeats) and saves it; returns the new list. */
export function rememberColor(color: string, storage: Pick<Storage, "getItem" | "setItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage): string[] {
  const normalized = normalizeHex(color);
  const current = readRecentColors(storage);
  if (!normalized) return current;
  const next = [normalized, ...current.filter((item) => item !== normalized)].slice(0, MAX_RECENT_COLORS);
  try { storage?.setItem(storageKey, JSON.stringify(next)); } catch { /* private mode: recent colours last for this page only */ }
  return next;
}
