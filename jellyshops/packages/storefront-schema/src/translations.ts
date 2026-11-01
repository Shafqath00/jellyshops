/**
 * Store text in other languages. A section or block keeps its translated text
 * inside its own settings, under `translations` (language code -> setting key ->
 * text), so drafts, publishing and saved snapshots carry it without changes.
 * Only plain text is translated; a translated field shows as plain text (its
 * formatted copy under `<key>Doc` belongs to the main language).
 */
import type { BlockNode, SectionNode } from "./types.js";

export const MAX_TRANSLATION_LENGTH = 5000;
/** "hi", "fr", "pt-BR" and so on. */
export const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Z]{2})?$/;

export type Translations = Record<string, Record<string, string>>;

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** The translations saved in these settings (malformed entries skipped). */
export function readTranslations(settings: Record<string, unknown> | undefined): Translations {
  const result: Translations = {};
  for (const [language, values] of Object.entries(record(settings?.translations))) {
    if (!LANGUAGE_CODE.test(language)) continue;
    const strings = Object.fromEntries(Object.entries(record(values)).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== ""));
    if (Object.keys(strings).length) result[language] = strings;
  }
  return result;
}

/** Why these translations can't be saved, in plain words, or null. `keys` are the settings that may be translated. */
export function translationsProblem(value: unknown, keys: Set<string>): string | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Translations must be a list of languages.";
  for (const [language, values] of Object.entries(value)) {
    if (!LANGUAGE_CODE.test(language)) return `"${language}" isn't a language code, for example hi or fr.`;
    if (!values || typeof values !== "object" || Array.isArray(values)) return `Translations for ${language} must be text.`;
    for (const [key, text] of Object.entries(values)) {
      if (!keys.has(key)) return `${key} can't be translated.`;
      if (typeof text !== "string" || text.length > MAX_TRANSLATION_LENGTH) return `The ${language} text for ${key} must be text of at most ${MAX_TRANSLATION_LENGTH} characters.`;
    }
  }
  return null;
}

/** Settings as shoppers see them in this language: translated text replaces the main text (and its formatted copy). */
export function translateSettings(settings: Record<string, unknown>, language: string | null | undefined): Record<string, unknown> {
  if (!language) return settings;
  const values = readTranslations(settings)[language];
  if (!values) return settings;
  const result = { ...settings };
  for (const [key, text] of Object.entries(values)) {
    result[key] = text;
    delete result[`${key}Doc`];
  }
  return result;
}

function translateBlock(block: BlockNode, language: string): BlockNode {
  return { ...block, settings: translateSettings(block.settings, language), ...(block.blocks ? { blocks: block.blocks.map((child) => translateBlock(child, language)) } : {}) };
}

/** A section with its own and its blocks' text in this language (unchanged without translations). */
export function translateSection(section: SectionNode, language: string | null | undefined): SectionNode {
  if (!language) return section;
  return { ...section, settings: translateSettings(section.settings, language), blocks: section.blocks.map((block) => translateBlock(block, language)) };
}

/** Writes (or, for empty text, removes) translated text; returns new settings. */
export function withTranslation(settings: Record<string, unknown>, language: string, patch: Record<string, unknown>): Record<string, unknown> {
  const all = readTranslations(settings);
  const own = { ...(all[language] ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === "string" && value.trim()) own[key] = value;
    else delete own[key];
  }
  const next: Translations = { ...all, [language]: own };
  if (!Object.keys(own).length) delete next[language];
  const result = { ...settings };
  if (Object.keys(next).length) result.translations = next;
  else delete result.translations;
  return result;
}
