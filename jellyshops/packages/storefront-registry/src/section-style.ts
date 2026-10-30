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

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** Empty string means "use the theme's choice"; the editor's select lists it as "Theme default". */
const optional = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.enum(values), z.literal("")]).optional();

export const sectionStyleSchema = z.object({
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
}).passthrough();

export type SectionStyleSettings = z.infer<typeof sectionStyleSchema>;

const themeDefault = { label: "Theme default", value: "" };
const fonts = [themeDefault, ...SECTION_FONT_CHOICES.map((font) => ({ label: font, value: font }))];

export const SECTION_STYLE_CONTROLS: ControlDefinition[] = [
  { type: "checkbox", key: "styleColors", label: "Use my own colours", description: "Turn on to choose this section's background and text colours.", group: "style" },
  { type: "color", key: "styleBackground", label: "Background colour", group: "style", allowAlpha: false },
  { type: "color", key: "styleText", label: "Text colour", group: "style", allowAlpha: false },
  { type: "select", key: "styleHeadingFont", label: "Heading font", group: "style", options: fonts },
  { type: "select", key: "styleHeadingSize", label: "Heading size", group: "style", options: [themeDefault, { label: "Small", value: "small" }, { label: "Medium", value: "medium" }, { label: "Large", value: "large" }, { label: "Extra large", value: "x-large" }] },
  { type: "select", key: "styleHeadingWeight", label: "Heading weight", group: "style", options: [themeDefault, { label: "Light", value: "300" }, { label: "Regular", value: "400" }, { label: "Medium", value: "500" }, { label: "Semibold", value: "600" }, { label: "Bold", value: "700" }] },
  { type: "select", key: "styleBodyFont", label: "Text font", group: "style", options: fonts },
  { type: "select", key: "styleBodySize", label: "Text size", group: "style", options: [themeDefault, { label: "Small", value: "small" }, { label: "Regular", value: "regular" }, { label: "Large", value: "large" }] },
  { type: "select", key: "styleAlign", label: "Text alignment", group: "style", options: [themeDefault, { label: "Left", value: "left" }, { label: "Centre", value: "center" }, { label: "Right", value: "right" }] },
  { type: "select", key: "styleSpacing", label: "Space above and below", group: "style", options: [themeDefault, { label: "None", value: "none" }, { label: "Small", value: "small" }, { label: "Large", value: "large" }] },
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
