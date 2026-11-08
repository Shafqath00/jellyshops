import type { ControlDefinition } from "@jelly/storefront-registry";
import { translatableKeys } from "@jelly/storefront-registry";
import { readTranslations, withTranslation } from "@jelly/storefront-schema";

/**
 * Editing the store in another language: text settings show and save that
 * language's text (under `settings.translations`); every other setting still
 * changes the store for all languages. Translations are plain text, so
 * formatted text fields become plain text boxes while translating.
 */
interface SettingsNode { settings: Record<string, unknown> }

const preview = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? `“${text.length > 80 ? `${text.slice(0, 80)}…` : text}”` : "empty";
};

export function controlsForLanguage(controls: ControlDefinition[], language: string | null, languageName: string, settings: Record<string, unknown> = {}): ControlDefinition[] {
  if (!language) return controls;
  const keys = new Set(translatableKeys(controls));
  return controls.map((control): ControlDefinition => {
    if (!keys.has(control.key) || (control.type !== "text" && control.type !== "textarea" && control.type !== "rich-text")) return control;
    const type = control.type === "rich-text" ? (control.inline ? "text" : "textarea") : control.type;
    // Translated text is plain: no custom-field connection and no formatting.
    return { ...control, type, dynamicTypes: undefined, inline: undefined, label: `${control.label} (${languageName})`, description: `Leave empty to show the main text: ${preview(settings[control.key])}.` };
  });
}

/** Values the panel shows: in another language, text settings show that language's text (empty = not translated). */
export function settingsForLanguage(settings: Record<string, unknown>, controls: ControlDefinition[], language: string | null): Record<string, unknown> {
  if (!language) return settings;
  const own = readTranslations(settings)[language] ?? {};
  const result = { ...settings };
  for (const key of translatableKeys(controls)) {
    result[key] = own[key] ?? "";
    delete result[`${key}Doc`];
  }
  return result;
}

/** Applies a settings change: in another language text goes to its translations; other settings change for all languages. */
export function applyLanguagePatch<T extends SettingsNode>(node: T, patch: Record<string, unknown>, controls: ControlDefinition[], language: string | null): T | null {
  if (!language) return null;
  const keys = new Set(translatableKeys(controls));
  const translated: Record<string, unknown> = {};
  const shared: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (keys.has(key)) translated[key] = value;
    else if (!(key.endsWith("Doc") && keys.has(key.slice(0, -3)))) shared[key] = value;
  }
  return { ...node, settings: withTranslation({ ...node.settings, ...shared }, language, translated) };
}
