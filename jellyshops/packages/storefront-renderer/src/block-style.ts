import type { CSSProperties } from "react";

/**
 * Turns a heading, text or button block's style settings (see the registry's
 * block-style.ts) into inline styles, plus `data-type-preset` for the theme's
 * text styles. Unknown values are ignored, so nothing a merchant saves can inject CSS.
 */
const hex = /^#[0-9a-fA-F]{6}$/;
const presets = new Set(["h1", "h2", "h3", "h4", "body", "small"]);
const maxWidths: Record<string, string> = { narrow: "28rem", normal: "42rem", wide: "60rem", none: "none" };

export interface BlockStyleProps {
  "data-block-style"?: string;
  "data-type-preset"?: string;
  style?: CSSProperties;
}

function px(value: unknown, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : undefined;
}

export function blockStyleProps(settings: Record<string, unknown> | undefined): BlockStyleProps {
  if (!settings) return {};
  const style: CSSProperties = {};
  const color = (key: string) => typeof settings[key] === "string" && hex.test(settings[key] as string) ? settings[key] as string : undefined;

  if (settings.blockWidth === "fill") Object.assign(style, { display: "block", width: "100%", boxSizing: "border-box" });
  else if (settings.blockWidth === "fit") Object.assign(style, { width: "fit-content" });
  if (typeof settings.blockMaxWidth === "string" && maxWidths[settings.blockMaxWidth]) style.maxWidth = maxWidths[settings.blockMaxWidth];
  if (color("blockTextColor")) style.color = color("blockTextColor");
  if (settings.blockBackground === true) style.background = color("blockBackgroundColor") ?? "var(--theme-surface, #f4f2ee)";
  if (settings.blockBorder === "solid") style.border = `${px(settings.blockBorderWidth, 8) || 1}px solid ${color("blockBorderColor") ?? "currentColor"}`;
  else if (settings.blockBorder === "none") style.border = "none";
  const radius = px(settings.blockRadius, 100);
  if (radius !== undefined) style.borderRadius = `${radius}px`;
  for (const side of ["Top", "Bottom", "Left", "Right"] as const) {
    const value = px(settings[`blockPadding${side}`], 100);
    if (value !== undefined) style[`padding${side}`] = `${value}px`;
  }
  // A coloured or bordered block with no padding of its own gets a little, so text never touches the edge.
  if ((style.background || settings.blockBorder === "solid") && !["Top", "Bottom", "Left", "Right"].some((side) => px(settings[`blockPadding${side}`], 100) !== undefined)) style.padding = "0.5em 0.75em";

  const preset = typeof settings.blockTypePreset === "string" && presets.has(settings.blockTypePreset) ? settings.blockTypePreset : undefined;
  const styled = Object.keys(style).length > 0;
  if (!styled && !preset) return {};
  return {
    ...(styled ? { "data-block-style": "", style } : {}),
    ...(preset ? { "data-type-preset": preset } : {}),
  };
}
