import { z } from "zod";
import type { BlockDefinition, ControlDefinition } from "./types.js";

/**
 * Style settings the heading, text and button blocks share, laid out like
 * Shopify's block panel: Layout, Typography, Appearance, Borders, Padding.
 * Each one is optional: when it is empty the block follows its section and theme.
 * The renderer turns them into inline styles on the block, in the editor preview
 * and the live store alike.
 */

export const BLOCK_TYPE_PRESETS = ["h1", "h2", "h3", "h4", "body", "small"] as const;
export const BLOCK_MAX_WIDTHS = ["narrow", "normal", "wide", "none"] as const;
export const STYLED_BLOCK_TYPES = ["heading", "text", "button", "image", "video"] as const;
/** Buttons and media have no text style, text colour or background of their own (buttons have their own colours). */
const TEXT_ONLY_KEYS = new Set(["blockTypePreset", "blockTextColor", "blockBackground", "blockBackgroundColor"]);
const TEXT_BLOCK_TYPES = new Set(["heading", "text"]);

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
  blockBorder: z.union([z.enum(["none", "solid"]), empty]).optional(),
  blockBorderWidth: z.number().int().min(1).max(8).optional(),
  blockBorderColor: z.union([hexColor, empty]).optional(),
  blockRadius: px(100).optional(),
  blockPaddingTop: px(100).optional(),
  blockPaddingBottom: px(100).optional(),
  blockPaddingLeft: px(100).optional(),
  blockPaddingRight: px(100).optional(),
}).passthrough();

export type BlockStyleSettings = z.infer<typeof blockStyleSchema>;

const themeDefault = { label: "Theme default", value: "" };
const padding = (side: "Top" | "Bottom" | "Left" | "Right"): ControlDefinition =>
  ({ type: "range", key: `blockPadding${side}`, label: side, group: "style", heading: "Padding", min: 0, max: 100, step: 1, unit: "px" });

export const BLOCK_STYLE_CONTROLS: ControlDefinition[] = [
  { type: "segmented", key: "blockWidth", label: "Width", group: "layout", heading: "Layout", options: [{ label: "Fit", value: "fit" }, { label: "Fill", value: "fill" }] },
  { type: "select", key: "blockMaxWidth", label: "Max width", group: "layout", heading: "Layout", options: [themeDefault, { label: "Narrow", value: "narrow" }, { label: "Normal", value: "normal" }, { label: "Wide", value: "wide" }, { label: "None", value: "none" }] },
  { type: "select", key: "blockTypePreset", label: "Text style", group: "style", heading: "Typography", description: "Uses the sizes and fonts from your theme settings.", options: [themeDefault, { label: "Heading 1", value: "h1" }, { label: "Heading 2", value: "h2" }, { label: "Heading 3", value: "h3" }, { label: "Heading 4", value: "h4" }, { label: "Body", value: "body" }, { label: "Small", value: "small" }] },
  { type: "color", key: "blockTextColor", label: "Text colour", group: "style", heading: "Appearance", allowAlpha: false },
  { type: "checkbox", key: "blockBackground", label: "Background", group: "style", heading: "Appearance" },
  { type: "color", key: "blockBackgroundColor", label: "Background colour", group: "style", heading: "Appearance", allowAlpha: false, showWhen: { key: "blockBackground", equals: true } },
  { type: "segmented", key: "blockBorder", label: "Style", group: "style", heading: "Borders", options: [{ label: "None", value: "none" }, { label: "Solid", value: "solid" }] },
  { type: "range", key: "blockBorderWidth", label: "Thickness", group: "style", heading: "Borders", min: 1, max: 8, step: 1, unit: "px", showWhen: { key: "blockBorder", equals: "solid" } },
  { type: "color", key: "blockBorderColor", label: "Border colour", group: "style", heading: "Borders", allowAlpha: false, showWhen: { key: "blockBorder", equals: "solid" } },
  { type: "range", key: "blockRadius", label: "Corner radius", group: "style", heading: "Borders", min: 0, max: 100, step: 1, unit: "px" },
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

/** Adds the shared style controls to heading, text, button, image and video blocks; other blocks are returned unchanged. */
export function withBlockStyle(definition: BlockDefinition): BlockDefinition {
  if (!styledTypes.has(definition.type)) return definition;
  const own = new Set(definition.controls.map((control) => control.key));
  return {
    ...definition,
    controls: [...definition.controls, ...BLOCK_STYLE_CONTROLS.filter((control) => !own.has(control.key) && (TEXT_BLOCK_TYPES.has(definition.type) || !TEXT_ONLY_KEYS.has(control.key)))],
    settingsSchema: z.intersection(definition.settingsSchema, blockStyleSchema),
  };
}
