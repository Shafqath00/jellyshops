import type { ControlDefinition } from "@jelly/storefront-registry";
import { COLOR_SCHEME_IDS, colorSchemeCount, colorSchemeLabel, type ColorSchemeId } from "@jelly/storefront-themes";

const schemeIndex = (value: string) => COLOR_SCHEME_IDS.indexOf(value as ColorSchemeId);

/**
 * The section "Colour scheme" picker lists the schemes the merchant uses, by
 * their names. A removed scheme a section still uses stays listed for it, so
 * the picker never shows a blank choice.
 */
export function withColorSchemeNames(controls: ControlDefinition[], themeSettings: Record<string, unknown> | undefined, current?: Record<string, unknown>): ControlDefinition[] {
  const count = colorSchemeCount(themeSettings);
  return controls.map((control) => {
    if (control.key !== "styleScheme" || control.type !== "select") return control;
    const options = control.options
      .filter((option) => !option.value || schemeIndex(option.value) < count || option.value === current?.styleScheme)
      .map((option) => schemeIndex(option.value) >= 0 ? { ...option, label: colorSchemeLabel(themeSettings, option.value as ColorSchemeId) } : option);
    return { ...control, options };
  });
}

/** Theme settings for the panel: the groups of schemes beyond "Number of colour schemes" are hidden. */
export function themeSchemaForPanel<T extends { id: string }>(schema: T[], settings: Record<string, unknown> | undefined): T[] {
  const count = colorSchemeCount(settings);
  return schema.filter((definition) => {
    const match = /^colorSchemes\.scheme(\d+)\./.exec(definition.id);
    return !match || Number(match[1]) <= count;
  });
}
