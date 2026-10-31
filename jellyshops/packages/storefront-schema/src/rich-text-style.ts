/**
 * Text colour and size inside rich text (the theme editor's "Text colour" and
 * "Text size"), stored as one `textStyle` mark like TipTap's. Only hex colours
 * and named sizes are kept, so saved text can never inject CSS.
 */

export const RICH_TEXT_SIZES = ["small", "large", "x-large"] as const;
export type RichTextSize = (typeof RICH_TEXT_SIZES)[number];
export interface RichTextStyleAttrs { color?: string; size?: RichTextSize }
export type RichTextStyleMark = { type: "textStyle"; attrs: RichTextStyleAttrs };

const hex = /^#[0-9a-fA-F]{6}$/;
/** Relative sizes, so the text grows or shrinks with the block or section it sits in. */
const fontSizes: Record<RichTextSize, string> = { small: "0.875em", large: "1.25em", "x-large": "1.5em" };

export function normalizeTextStyleMark(attrs: unknown): RichTextStyleMark | null {
  const value = attrs !== null && typeof attrs === "object" && !Array.isArray(attrs) ? attrs as Record<string, unknown> : {};
  const result: RichTextStyleAttrs = {};
  if (typeof value.color === "string" && hex.test(value.color)) result.color = value.color.toLowerCase();
  if (typeof value.size === "string" && (RICH_TEXT_SIZES as readonly string[]).includes(value.size)) result.size = value.size as RichTextSize;
  return result.color || result.size ? { type: "textStyle", attrs: result } : null;
}

/** Inline CSS for a text-style mark. */
export function richTextStyleCss(attrs: RichTextStyleAttrs): { color?: string; fontSize?: string } {
  const mark = normalizeTextStyleMark(attrs);
  return {
    ...(mark?.attrs.color ? { color: mark.attrs.color } : {}),
    ...(mark?.attrs.size ? { fontSize: fontSizes[mark.attrs.size] } : {}),
  };
}
