import type { CSSProperties } from "react";
import { showOnChoice } from "./section-style";

/**
 * Turns a heading, text or button block's style settings (see the registry's
 * block-style.ts) into inline styles, plus `data-type-preset` for the theme's
 * text styles. Phone values (`responsive.mobile`) for padding and text style
 * become `--block-pad-*-m` variables listed in `data-block-mobile` and
 * `data-type-preset-mobile`, applied below 768px; "Show on" becomes `data-show-on`.
 * Unknown values are ignored, so nothing a merchant saves can inject CSS.
 */
const hex = /^#[0-9a-fA-F]{6}$/;
const presets = new Set(["h1", "h2", "h3", "h4", "body", "small"]);
const shadows: Record<string, string> = {
  soft: "0 2px 8px rgba(0, 0, 0, 0.08)",
  medium: "0 6px 20px rgba(0, 0, 0, 0.14)",
  strong: "0 14px 40px rgba(0, 0, 0, 0.24)",
};
// Never wider than the space the block has (a 28rem block on a 390px phone ran off the screen; settings fuzz).
const maxWidths: Record<string, string> = { narrow: "min(28rem, 100%)", normal: "min(42rem, 100%)", wide: "min(60rem, 100%)", none: "100%" };

export interface BlockStyleProps {
  "data-block-style"?: string;
  "data-type-preset"?: string;
  "data-type-preset-mobile"?: string;
  "data-type-preset-tablet"?: string;
  "data-block-mobile"?: string;
  "data-block-tablet"?: string;
  "data-show-on"?: string;
  style?: CSSProperties;
}

function px(value: unknown, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : undefined;
}

export function blockStyleProps(settings: Record<string, unknown> | undefined, mobile?: Record<string, unknown>, tablet?: Record<string, unknown>): BlockStyleProps {
  if (!settings) return {};
  const style: CSSProperties = {};
  const color = (key: string) => typeof settings[key] === "string" && hex.test(settings[key] as string) ? settings[key] as string : undefined;

  if (settings.blockWidth === "fill") Object.assign(style, { display: "block", width: "100%", boxSizing: "border-box" });
  else if (settings.blockWidth === "fit") Object.assign(style, { width: "fit-content" });
  if (typeof settings.blockMaxWidth === "string" && maxWidths[settings.blockMaxWidth]) style.maxWidth = maxWidths[settings.blockMaxWidth];
  if (color("blockTextColor")) style.color = color("blockTextColor");
  if (settings.blockBackground === true) {
    const base = color("blockBackgroundColor") ?? "var(--theme-surface, #f4f2ee)";
    const to = color("blockGradientColor");
    const angle = typeof settings.blockGradientAngle === "number" && Number.isFinite(settings.blockGradientAngle) ? Math.min(360, Math.max(0, Math.round(settings.blockGradientAngle))) : 135;
    style.background = to ? `linear-gradient(${angle}deg, ${base}, ${to})` : base;
  }
  if (typeof settings.blockShadow === "string" && shadows[settings.blockShadow]) style.boxShadow = shadows[settings.blockShadow];
  const opacity = typeof settings.blockOpacity === "number" && Number.isFinite(settings.blockOpacity) ? Math.min(100, Math.max(10, Math.round(settings.blockOpacity))) : undefined;
  if (opacity !== undefined && opacity < 100) style.opacity = opacity / 100;
  const minHeight = px(settings.blockMinHeight, 800);
  if (minHeight) Object.assign(style, { minHeight: `${minHeight}px`, boxSizing: "border-box" });
  for (const side of ["Top", "Bottom"] as const) {
    const value = px(settings[`blockMargin${side}`], 100);
    if (value !== undefined) style[`margin${side}`] = `${value}px`;
  }
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
  const phone: string[] = [];
  const tabletUsed: string[] = [];
  const vars: Record<string, string> = {};
  for (const [values, suffix, used] of [[mobile, "m", phone], [tablet, "t", tabletUsed]] as const) {
    for (const side of ["Top", "Bottom", "Left", "Right"] as const) {
      const value = px(values?.[`blockPadding${side}`], 100);
      if (value !== undefined) { vars[`--block-pad-${side.toLowerCase()}-${suffix}`] = `${value}px`; used.push(`pad-${side.toLowerCase()}`); }
    }
  }
  const mobilePreset = typeof mobile?.blockTypePreset === "string" && presets.has(mobile.blockTypePreset) ? mobile.blockTypePreset : undefined;
  const tabletPreset = typeof tablet?.blockTypePreset === "string" && presets.has(tablet.blockTypePreset) ? tablet.blockTypePreset : undefined;
  const showOn = showOnChoice(settings.blockShowOn);
  const allStyle = { ...style, ...vars } as CSSProperties;
  return {
    ...(styled ? { "data-block-style": "" } : {}),
    ...(styled || phone.length || tabletUsed.length ? { style: allStyle } : {}),
    ...(preset ? { "data-type-preset": preset } : {}),
    ...(mobilePreset ? { "data-type-preset-mobile": mobilePreset } : {}),
    ...(tabletPreset ? { "data-type-preset-tablet": tabletPreset } : {}),
    ...(phone.length ? { "data-block-mobile": phone.join(" ") } : {}),
    ...(tabletUsed.length ? { "data-block-tablet": tabletUsed.join(" ") } : {}),
    ...(showOn ? { "data-show-on": showOn } : {}),
  };
}

/** Style props for a block, with its phone values. */
export function blockStyle(block: { settings: Record<string, unknown>; responsive?: { mobile?: Record<string, unknown>; tablet?: Record<string, unknown> } } | undefined): BlockStyleProps {
  return block ? blockStyleProps(block.settings, block.responsive?.mobile, block.responsive?.tablet) : {};
}
