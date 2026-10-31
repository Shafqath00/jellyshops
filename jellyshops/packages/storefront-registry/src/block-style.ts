import { z } from "zod";
import type { BlockDefinition, ControlDefinition } from "./types.js";

/**
 * Style settings the heading, text, button, media and group blocks share, laid out like
 * Shopify's block panel: Layout, Typography, Appearance, Borders, Padding.
 * Each one is optional: when it is empty the block follows its section and theme.
 * The renderer turns them into inline styles on the block, in the editor preview
 * and the live store alike.
 */

export const BLOCK_TYPE_PRESETS = ["h1", "h2", "h3", "h4", "body", "small"] as const;
export const BLOCK_MAX_WIDTHS = ["narrow", "normal", "wide", "none"] as const;
export const BLOCK_SHADOWS = ["none", "soft", "medium", "strong"] as const;
export const STYLED_BLOCK_TYPES = ["heading", "text", "button", "image", "video", "group"] as const;
/** Buttons and media have no text style, text colour or background of their own (buttons have their own colours). */
const TEXT_ONLY_KEYS = new Set(["blockTypePreset", "blockTextColor", "blockBackground", "blockBackgroundColor", "blockGradientColor", "blockGradientAngle"]);
/** A group passes its text style and colours on to the blocks inside it. */
const TEXT_BLOCK_TYPES = new Set(["heading", "text", "group"]);

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const empty = z.literal("");
const px = (max: number) => z.number().int().min(0).max(max);

export const blockStyleSchema = z.object({
  blockWidth: z.union([z.enum(["fit", "fill"]), empty]).optional(),
  blockMaxWidth: z.union([z.enum(BLOCK_MAX_WIDTHS), empty]).optional(),
  blockTypePreset: z.union([z.enum(BLOCK_TYPE_PRESETS), empty]).optional(),
  blockTextColor: z.union([hexColor, empty]).optional(),
  blockBackground: z.boolean().optional(),
  blockBackgroundColor: z.union([hexColor, empty]).optional(),
  blockGradientColor: z.union([hexColor, empty]).optional(),
  blockGradientAngle: z.number().int().min(0).max(360).optional(),
  blockShadow: z.union([z.enum(BLOCK_SHADOWS), empty]).optional(),
  blockOpacity: z.number().int().min(10).max(100).optional(),
  blockMinHeight: z.number().int().min(0).max(800).optional(),
  blockMarginTop: px(100).optional(),
  blockMarginBottom: px(100).optional(),
  blockBorder: z.union([z.enum(["none", "solid"]), empty]).optional(),
  blockBorderWidth: z.number().int().min(1).max(8).optional(),
  blockBorderColor: z.union([hexColor, empty]).optional(),
  blockRadius: px(100).optional(),
  blockPaddingTop: px(100).optional(),
  blockPaddingBottom: px(100).optional(),
  blockPaddingLeft: px(100).optional(),
  blockPaddingRight: px(100).optional(),
  blockShowOn: z.union([z.enum(["desktop", "mobile"]), empty]).optional(),
}).passthrough();

export type BlockStyleSettings = z.infer<typeof blockStyleSchema>;

const themeDefault = { label: "Theme default", value: "" };
const padding = (side: "Top" | "Bottom" | "Left" | "Right"): ControlDefinition =>
  ({ type: "range", key: `blockPadding${side}`, mobile: true, label: side, group: "style", heading: "Padding", min: 0, max: 100, step: 1, unit: "px" });

export const BLOCK_STYLE_CONTROLS: ControlDefinition[] = [
  { type: "segmented", key: "blockWidth", label: "Width", group: "layout", heading: "Layout", options: [{ label: "Fit", value: "fit" }, { label: "Fill", value: "fill" }] },
  { type: "select", key: "blockShowOn", label: "Show on", group: "layout", heading: "Layout", options: [{ label: "All screens", value: "" }, { label: "Desktop and tablet only", value: "desktop" }, { label: "Phones only", value: "mobile" }] },
  { type: "range", key: "blockMinHeight", label: "Minimum height", group: "layout", heading: "Layout", min: 0, max: 800, step: 10, unit: "px" },
  { type: "select", key: "blockMaxWidth", label: "Max width", group: "layout", heading: "Layout", options: [themeDefault, { label: "Narrow", value: "narrow" }, { label: "Normal", value: "normal" }, { label: "Wide", value: "wide" }, { label: "None", value: "none" }] },
  { type: "select", key: "blockTypePreset", mobile: true, label: "Text style", group: "style", heading: "Typography", description: "Uses the sizes and fonts from your theme settings.", options: [themeDefault, { label: "Heading 1", value: "h1" }, { label: "Heading 2", value: "h2" }, { label: "Heading 3", value: "h3" }, { label: "Heading 4", value: "h4" }, { label: "Body", value: "body" }, { label: "Small", value: "small" }] },
  { type: "color", key: "blockTextColor", label: "Text colour", group: "style", heading: "Appearance", allowAlpha: false },
  { type: "checkbox", key: "blockBackground", label: "Background", group: "style", heading: "Appearance" },
  { type: "color", key: "blockBackgroundColor", label: "Background colour", group: "style", heading: "Appearance", allowAlpha: false, showWhen: { key: "blockBackground", equals: true } },
  { type: "color", key: "blockGradientColor", label: "Gradient to colour", description: "Fades the background colour into this one. Leave empty for a flat colour.", group: "style", heading: "Appearance", allowAlpha: false, showWhen: { key: "blockBackground", equals: true } },
  { type: "range", key: "blockGradientAngle", label: "Gradient angle", group: "style", heading: "Appearance", min: 0, max: 360, step: 15, unit: "°", showWhen: { key: "blockBackground", equals: true } },
  { type: "range", key: "blockOpacity", label: "Opacity", group: "style", heading: "Appearance", min: 10, max: 100, step: 5, unit: "%" },
  { type: "select", key: "blockShadow", label: "Shadow", group: "style", heading: "Borders", options: [{ label: "None", value: "none" }, { label: "Soft", value: "soft" }, { label: "Medium", value: "medium" }, { label: "Strong", value: "strong" }] },
  { type: "segmented", key: "blockBorder", label: "Style", group: "style", heading: "Borders", options: [{ label: "None", value: "none" }, { label: "Solid", value: "solid" }] },
  { type: "range", key: "blockBorderWidth", label: "Thickness", group: "style", heading: "Borders", min: 1, max: 8, step: 1, unit: "px", showWhen: { key: "blockBorder", equals: "solid" } },
  { type: "color", key: "blockBorderColor", label: "Border colour", group: "style", heading: "Borders", allowAlpha: false, showWhen: { key: "blockBorder", equals: "solid" } },
  { type: "range", key: "blockRadius", label: "Corner radius", group: "style", heading: "Borders", min: 0, max: 100, step: 1, unit: "px" },
  { type: "range", key: "blockMarginTop", label: "Space above", group: "style", heading: "Margin", min: 0, max: 100, step: 1, unit: "px" },
  { type: "range", key: "blockMarginBottom", label: "Space below", group: "style", heading: "Margin", min: 0, max: 100, step: 1, unit: "px" },
  padding("Top"),
  padding("Bottom"),
  padding("Left"),
  padding("Right"),
];

const styleKeys = new Set(BLOCK_STYLE_CONTROLS.map((control) => control.key));
const styledTypes = new Set<string>(STYLED_BLOCK_TYPES);

export function isBlockStyleKey(key: string): boolean {
  return styleKeys.has(key);
}

/** Adds the shared style controls to heading, text, button, image, video and group blocks; other blocks are returned unchanged. */
export function withBlockStyle(definition: BlockDefinition): BlockDefinition {
  if (!styledTypes.has(definition.type)) return definition;
  const own = new Set(definition.controls.map((control) => control.key));
  return {
    ...definition,
    controls: [...definition.controls, ...BLOCK_STYLE_CONTROLS.filter((control) => !own.has(control.key) && (TEXT_BLOCK_TYPES.has(definition.type) || !TEXT_ONLY_KEYS.has(control.key)))],
    settingsSchema: z.intersection(definition.settingsSchema, blockStyleSchema),
  };
}
