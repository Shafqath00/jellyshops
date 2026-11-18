import { FONT_OPTIONS } from "./fonts.js";
import { colorSchemeSource, themeStyleSettings, type ColorSchemeId } from "./theme-style-settings.js";

/**
 * The platform's theme settings (docs/plans/theme-foundation-plan.md, phase 1): one list every complete theme shows in
 * Theme settings, like Shopify's settings_schema. A theme does not copy it; its manifest gives only `settingsDefaults`
 * (its look) and, when it needs them, a few `settingsSchema` entries of its own: an entry with a platform id changes
 * that setting's wording or choices (Avenue calls "Cards and panels" its product image background), any other id adds
 * a theme setting after the last setting of its group (or after the setting named in its `after`). Setting ids never change, so saved store settings keep working.
 */
export interface PlatformSetting {
  id: string;
  type: string;
  label: string;
  group?: string;
  default?: unknown;
  [key: string]: unknown;
}

const fonts = FONT_OPTIONS.map((option) => ({ ...option }));
// The shape of the text style, colour scheme and button settings; the values are replaced by each theme's defaults.
const style = themeStyleSettings({
  sizes: { h2: 44, h3: 28, h4: 20, small: 14 },
  schemes: {
    scheme1: { background: "#faf9f7", text: "#1c1b19", button: "#1c1b19", buttonText: "#faf9f7" },
    scheme2: { background: "#ece7de", text: "#1c1b19", button: "#1c1b19", buttonText: "#faf9f7" },
    scheme3: { background: "#ffffff", text: "#1c1b19", button: "#1c1b19", buttonText: "#ffffff" },
    scheme4: { background: "#1c1b19", text: "#faf9f7", button: "#faf9f7", buttonText: "#1c1b19" },
  },
}, { heading: [56, 32, 88, 4], body: [16, 14, 20, 1] });
const color = (id: string, label: string, value: string) => ({ id: `colors.${id}`, type: "color", label, group: "Colors", default: value });
const range = (id: string, label: string, group: string, value: number, min: number, max: number, step: number) => ({ id, type: "range", label, group, default: value, min, max, step });
const select = (id: string, label: string, group: string, value: string, options: Array<[string, string]>) => ({ id, type: "select", label, group, default: value, options: options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })) });

const PLATFORM_SETTINGS: PlatformSetting[] = [
  color("background", "Page background", "#faf9f7"),
  color("surface", "Cards and panels", "#ffffff"),
  color("text", "Text", "#1c1b19"),
  color("secondary", "Soft text", "#6b665f"),
  color("primary", "Buttons", "#1c1b19"),
  color("accent", "Highlight backgrounds", "#ece7de"),
  ...style.colorSchemeSchema,
  { id: "typography.headingFont", type: "font", label: "Heading font", group: "Typography", default: "Fraunces", options: fonts },
  { id: "typography.bodyFont", type: "font", label: "Body font", group: "Typography", default: "Inter", options: fonts },
  range("typography.headingWeight", "Heading weight", "Typography", 400, 300, 700, 100),
  { id: "typography.highlightFont", type: "font", label: "Highlight font", group: "Typography", default: "same-as-heading", description: "A third font for words you want to stand out. Text styles and text roles can use it.", options: [{ value: "same-as-heading", label: "Same as the heading font" }, ...fonts] },
  ...style.textStyleSchema,
  ...style.textRoleSchema,
  select("buttons.radius", "Button corners", "Buttons", "square", [["square", "Square"], ["soft", "Slightly rounded"], ["rounded", "Rounded"], ["pill", "Pill"]]),
  ...style.buttonSchema,
  range("layout.contentWidth", "Page width", "Layout", 1280, 960, 1600, 32),
  range("layout.sectionGap", "Space between sections", "Layout", 96, 32, 160, 8),
  select("productCard.imageRatio", "Product image shape", "Product cards", "portrait", [["portrait", "Portrait"], ["square", "Square"], ["landscape", "Landscape"]]),
  select("productCard.style", "Product card style", "Product cards", "minimal", [["minimal", "Minimal"], ["bordered", "Bordered"]]),
  { id: "productCard.alignment", type: "alignment", label: "Product text alignment", group: "Product cards", default: "left", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }] },
  ...style.cardSchema,
  ...style.cardContentSchema,
  ...style.badgeSchema,
  ...style.fieldSchema,
  ...style.cartSchema,
  ...style.animationSchema,
  ...style.socialSchema,
  ...style.languageSchema,
  ...style.advancedSchema,
  { id: "branding.logoUrl", type: "image", label: "Store logo", group: "Branding", default: "" },
  { id: "branding.faviconUrl", type: "image", label: "Browser tab icon", group: "Branding", default: "" },
] as PlatformSetting[];

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const settingAt = (settings: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), settings);

/** Every platform setting id, in Theme settings order. */
export const PLATFORM_SETTING_IDS: readonly string[] = PLATFORM_SETTINGS.map((setting) => setting.id);

/**
 * The settings a theme shows: the platform list with the theme's own defaults, then the theme's own entries applied
 * (same id: change wording or choices; new id: added after its group). A platform setting the theme gives no default
 * for keeps the platform's default.
 */
export function platformSettingsSchema(defaults: Record<string, unknown> = {}, own: ReadonlyArray<PlatformSetting> = []): PlatformSetting[] {
  const schema: PlatformSetting[] = PLATFORM_SETTINGS.map((setting) => {
    const value = settingAt(defaults, setting.id) ?? sourceSchemeDefault(defaults, setting.id);
    return structuredClone(value === undefined ? setting : { ...setting, default: value });
  });
  // The theme's own settings take their defaults from the theme's defaults too.
  return applyOwnSettings(schema, own).map((setting) => {
    const value = settingAt(defaults, setting.id);
    return setting.default === undefined && value !== undefined ? { ...setting, default: structuredClone(value) } : setting;
  });
}

/** An extra colour scheme the theme gives no colours for starts as a copy of its source scheme's colours. */
function sourceSchemeDefault(defaults: Record<string, unknown>, id: string): unknown {
  const match = /^colorSchemes\.(scheme\d+)\.(background|text|button|buttonText)$/.exec(id);
  if (!match) return undefined;
  const source = colorSchemeSource(match[1] as ColorSchemeId);
  return source === match[1] ? undefined : settingAt(defaults, `colorSchemes.${source}.${match[2]}`);
}

/** Applies a theme's own entries to a settings list: same id changes the setting, a new id is added (see above). */
export function applyOwnSettings(base: ReadonlyArray<PlatformSetting>, own: ReadonlyArray<PlatformSetting>): PlatformSetting[] {
  const schema = base.map((setting) => structuredClone(setting));
  for (const entry of own) {
    const index = schema.findIndex((setting) => setting.id === entry.id);
    if (index !== -1) { schema[index] = { ...schema[index], ...structuredClone(entry) }; continue; }
    // A theme setting goes after the setting named in `after`, otherwise after the last setting of its group.
    const { after, ...setting } = structuredClone(entry) as PlatformSetting & { after?: string };
    const anchor = typeof after === "string" ? schema.findIndex((item) => item.id === after) : -1;
    const last = anchor !== -1 ? anchor : schema.map((item) => item.group).lastIndexOf(entry.group);
    schema.splice(last === -1 ? schema.length : last + 1, 0, setting);
  }
  return schema;
}

/**
 * A folder or uploaded theme's manifest as the registry keeps it: the platform settings with the theme's defaults.
 * `settingsDefaults` is left as the theme wrote it (a setting it gives no value for shows the platform default and
 * the storefront's own default applies, which for the platform's optional features is "off").
 */
export function withPlatformSettings<T extends { settingsDefaults?: unknown; settingsSchema?: unknown }>(manifest: T): T & { settingsSchema: PlatformSetting[] } {
  const defaults = isRecord(manifest.settingsDefaults) ? manifest.settingsDefaults : {};
  const own = Array.isArray(manifest.settingsSchema) ? manifest.settingsSchema as PlatformSetting[] : [];
  return { ...manifest, settingsSchema: platformSettingsSchema(defaults, own) };
}
