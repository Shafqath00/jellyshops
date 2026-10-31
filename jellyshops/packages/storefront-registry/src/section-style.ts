import { z } from "zod";
import type { ControlDefinition } from "./types.js";

/**
 * Style settings every section shares (colours, fonts, sizes, alignment, spacing).
 * Each one is optional: when it is empty the section follows the theme.
 * The renderer turns them into CSS variables on the section's wrapper, which both
 * the editor preview and the live store use.
 */

/** Same names as the theme's font list, so the renderer can turn them into font stacks. */
export const SECTION_FONT_CHOICES = ["Fraunces", "Inter", "Georgia", "Arial"] as const;
export const SECTION_HEADING_SIZES = ["small", "medium", "large", "x-large"] as const;
export const SECTION_HEADING_WEIGHTS = ["300", "400", "500", "600", "700"] as const;
export const SECTION_BODY_SIZES = ["small", "regular", "large"] as const;
export const SECTION_ALIGNMENTS = ["left", "center", "right"] as const;
export const SECTION_SPACINGS = ["none", "small", "large"] as const;
export const SECTION_WIDTHS = ["page", "full"] as const;
/** Where a section or block shows: every screen (empty), desktop and tablet only, or phones only. */
export const SHOW_ON_CHOICES = ["desktop", "mobile"] as const;
/** The four colour schemes set in theme settings (Theme settings › Colour scheme 1-4). */
export const SECTION_SCHEMES = ["scheme1", "scheme2", "scheme3", "scheme4"] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** Empty string means "use the theme's choice"; the editor's select lists it as "Theme default". */
const optional = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.enum(values), z.literal("")]).optional();

export const sectionStyleSchema = z.object({
  styleScheme: optional(SECTION_SCHEMES),
  styleColors: z.boolean().optional(),
  styleBackground: hexColor.optional(),
  styleText: hexColor.optional(),
  styleHeadingFont: optional(SECTION_FONT_CHOICES),
  styleHeadingSize: optional(SECTION_HEADING_SIZES),
  styleHeadingWeight: optional(SECTION_HEADING_WEIGHTS),
  styleBodyFont: optional(SECTION_FONT_CHOICES),
  styleBodySize: optional(SECTION_BODY_SIZES),
  styleAlign: optional(SECTION_ALIGNMENTS),
  styleSpacing: optional(SECTION_SPACINGS),
  styleWidth: optional(SECTION_WIDTHS),
  stylePaddingTop: z.number().int().min(0).max(200).optional(),
  stylePaddingBottom: z.number().int().min(0).max(200).optional(),
  styleShowOn: optional(SHOW_ON_CHOICES),
  styleShadow: optional(["none", "soft", "medium", "strong"] as const),
  styleOpacity: z.number().int().min(10).max(100).optional(),
}).passthrough();

export type SectionStyleSettings = z.infer<typeof sectionStyleSchema>;

const themeDefault = { label: "Theme default", value: "" };
const fonts = [themeDefault, ...SECTION_FONT_CHOICES.map((font) => ({ label: font, value: font }))];

export const SECTION_STYLE_CONTROLS: ControlDefinition[] = [
  { type: "select", key: "styleScheme", label: "Colour scheme", description: "Edit the schemes in theme settings.", group: "style", heading: "Appearance", options: [themeDefault, { label: "Scheme 1", value: "scheme1" }, { label: "Scheme 2", value: "scheme2" }, { label: "Scheme 3", value: "scheme3" }, { label: "Scheme 4", value: "scheme4" }] },
  { type: "checkbox", key: "styleColors", label: "Use my own colours", description: "Turn on to choose this section's background and text colours. They replace the colour scheme.", group: "style", heading: "Appearance" },
  { type: "color", key: "styleBackground", label: "Background colour", group: "style", heading: "Appearance", allowAlpha: false, showWhen: { key: "styleColors", equals: true } },
  { type: "color", key: "styleText", label: "Text colour", group: "style", heading: "Appearance", allowAlpha: false, showWhen: { key: "styleColors", equals: true } },
  { type: "select", key: "styleHeadingFont", label: "Heading font", group: "style", heading: "Typography", options: fonts },
  { type: "select", key: "styleHeadingSize", mobile: true, label: "Heading size", group: "style", heading: "Typography", options: [themeDefault, { label: "Small", value: "small" }, { label: "Medium", value: "medium" }, { label: "Large", value: "large" }, { label: "Extra large", value: "x-large" }] },
  { type: "select", key: "styleHeadingWeight", label: "Heading weight", group: "style", heading: "Typography", options: [themeDefault, { label: "Light", value: "300" }, { label: "Regular", value: "400" }, { label: "Medium", value: "500" }, { label: "Semibold", value: "600" }, { label: "Bold", value: "700" }] },
  { type: "select", key: "styleBodyFont", label: "Text font", group: "style", heading: "Typography", options: fonts },
  { type: "select", key: "styleBodySize", label: "Text size", group: "style", heading: "Typography", options: [themeDefault, { label: "Small", value: "small" }, { label: "Regular", value: "regular" }, { label: "Large", value: "large" }] },
  { type: "select", key: "styleAlign", mobile: true, label: "Text alignment", group: "layout", heading: "Layout", options: [themeDefault, { label: "Left", value: "left" }, { label: "Centre", value: "center" }, { label: "Right", value: "right" }] },
  { type: "select", key: "styleShowOn", label: "Show on", group: "layout", heading: "Layout", options: [{ label: "All screens", value: "" }, { label: "Desktop and tablet only", value: "desktop" }, { label: "Phones only", value: "mobile" }] },
  { type: "segmented", key: "styleWidth", label: "Width", group: "layout", heading: "Layout", options: [{ label: "Page", value: "page" }, { label: "Full", value: "full" }] },
  { type: "select", key: "styleShadow", label: "Shadow", group: "style", heading: "Appearance", options: [{ label: "None", value: "none" }, { label: "Soft", value: "soft" }, { label: "Medium", value: "medium" }, { label: "Strong", value: "strong" }] },
  { type: "range", key: "styleOpacity", label: "Opacity", group: "style", heading: "Appearance", min: 10, max: 100, step: 5, unit: "%" },
  { type: "select", key: "styleSpacing", label: "Space above and below", group: "style", heading: "Padding", description: "Or set exact sizes below.", options: [themeDefault, { label: "None", value: "none" }, { label: "Small", value: "small" }, { label: "Large", value: "large" }] },
  { type: "range", key: "stylePaddingTop", mobile: true, label: "Top", group: "style", heading: "Padding", min: 0, max: 200, step: 4, unit: "px" },
  { type: "range", key: "stylePaddingBottom", mobile: true, label: "Bottom", group: "style", heading: "Padding", min: 0, max: 200, step: 4, unit: "px" },
];

const styleKeys = new Set(SECTION_STYLE_CONTROLS.map((control) => control.key));

/** Adds the shared style controls after a section's own, skipping any key the section already defines. */
export function withSectionStyleControls(controls: ControlDefinition[]): ControlDefinition[] {
  const own = new Set(controls.map((control) => control.key));
  return [...controls, ...SECTION_STYLE_CONTROLS.filter((control) => !own.has(control.key))];
}

export function isSectionStyleKey(key: string): boolean {
  return styleKeys.has(key);
}
