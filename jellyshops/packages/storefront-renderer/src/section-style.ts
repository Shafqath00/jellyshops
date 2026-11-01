import type { CSSProperties } from "react";
import { FONT_OPTIONS, fontStack } from "@jelly/storefront-themes";

/**
 * Turns a section's shared style settings into CSS variables on its wrapper.
 * `data-section-style` lists which settings are in use, so theme CSS only
 * overrides its own tokens for those (see the themes' "Section style" rules).
 * Phone values (`responsive.mobile`) become `-m` variables listed in
 * `data-section-mobile`; the themes apply them below 768px. "Show on" becomes
 * `data-show-on`. Unknown values are ignored, so nothing a merchant saves can inject CSS.
 */
const headingScale: Record<string, string> = { small: "0.8", medium: "1", large: "1.2", "x-large": "1.45" };
const bodySize: Record<string, string> = { small: "14px", regular: "16px", large: "18px" };
/** Themes scale all their text sizes by this, since most text uses the smaller sizes. */
const bodyScale: Record<string, string> = { small: "0.9", regular: "1", large: "1.15" };
const weights = new Set(["300", "400", "500", "600", "700"]);
const alignments = new Set(["left", "center", "right"]);
const spacing: Record<string, string> = { none: "0px", small: "clamp(24px, 4vw, 40px)", large: "clamp(80px, 11vw, 144px)" };
const fonts = new Set<string>(FONT_OPTIONS.map((option) => option.value));
const showOnChoices = new Set(["desktop-only", "desktop", "touch", "mobile"]);
/** A saved "Show on" choice, or undefined for every screen (or an unknown value). */
export function showOnChoice(value: unknown): string | undefined {
  return typeof value === "string" && showOnChoices.has(value) ? value : undefined;
}
const shadows: Record<string, string> = {
  soft: "0 2px 8px rgba(0, 0, 0, 0.08)",
  medium: "0 6px 20px rgba(0, 0, 0, 0.14)",
  strong: "0 14px 40px rgba(0, 0, 0, 0.24)",
};
const hex = /^#[0-9a-fA-F]{6}$/;

export interface SectionStyleProps {
  "data-section-style"?: string;
  "data-section-mobile"?: string;
  "data-section-tablet"?: string;
  "data-show-on"?: string;
  style?: CSSProperties;
}

const justify: Record<string, string> = { left: "start", center: "center", right: "end" };
const padding = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.min(200, Math.max(0, Math.round(value))) : undefined;

/** Phone (`m`) or tablet (`t`) values for heading size, alignment and padding. */
function responsiveVars(mobile: Record<string, unknown> | undefined, vars: Record<string, string>, suffix: "m" | "t"): string[] {
  if (!mobile) return [];
  const used: string[] = [];
  const text = (key: string) => typeof mobile[key] === "string" ? mobile[key] as string : "";
  if (headingScale[text("styleHeadingSize")]) { vars[`--section-heading-scale-${suffix}`] = headingScale[text("styleHeadingSize")]; used.push("heading-size"); }
  if (alignments.has(text("styleAlign"))) { vars[`--section-align-${suffix}`] = text("styleAlign"); vars[`--section-justify-${suffix}`] = justify[text("styleAlign")]; used.push("align"); }
  const top = padding(mobile.stylePaddingTop);
  const bottom = padding(mobile.stylePaddingBottom);
  if (top !== undefined) { vars[`--section-pad-top-${suffix}`] = `${top}px`; used.push("pad-top"); }
  if (bottom !== undefined) { vars[`--section-pad-bottom-${suffix}`] = `${bottom}px`; used.push("pad-bottom"); }
  return used;
}

export function sectionStyleProps(settings: Record<string, unknown> | undefined, mobile?: Record<string, unknown>, tablet?: Record<string, unknown>): SectionStyleProps {
  if (!settings) return {};
  const vars: Record<string, string> = {};
  const used: string[] = [];
  const text = (key: string) => typeof settings[key] === "string" ? settings[key] as string : "";

  // A colour scheme from theme settings; "Use my own colours" below replaces it.
  const scheme = ({ scheme1: 1, scheme2: 2, scheme3: 3, scheme4: 4 } as Record<string, number | undefined>)[text("styleScheme")];
  if (scheme) {
    vars["--section-bg"] = `var(--jelly-scheme-${scheme}-bg)`;
    vars["--section-text"] = `var(--jelly-scheme-${scheme}-text)`;
    vars["--section-button"] = `var(--jelly-scheme-${scheme}-button)`;
    vars["--section-button-text"] = `var(--jelly-scheme-${scheme}-button-text)`;
    used.push("colors", "scheme");
  }
  // A colour left empty keeps the theme's, so ticking "Use my own colours" never blanks the section.
  if (settings.styleColors === true && (hex.test(text("styleBackground")) || hex.test(text("styleText")))) {
    vars["--section-bg"] = hex.test(text("styleBackground")) ? text("styleBackground") : "var(--theme-background, #ffffff)";
    vars["--section-text"] = hex.test(text("styleText")) ? text("styleText") : "var(--theme-text, #1c1b19)";
    if (!used.includes("colors")) used.push("colors");
  }
  if (fonts.has(text("styleHeadingFont"))) { vars["--section-heading-font"] = fontStack(text("styleHeadingFont"), "Arial"); used.push("heading-font"); }
  if (headingScale[text("styleHeadingSize")]) { vars["--section-heading-scale"] = headingScale[text("styleHeadingSize")]; used.push("heading-size"); }
  if (weights.has(text("styleHeadingWeight"))) { vars["--section-heading-weight"] = text("styleHeadingWeight"); used.push("heading-weight"); }
  if (fonts.has(text("styleBodyFont"))) { vars["--section-body-font"] = fontStack(text("styleBodyFont"), "Arial"); used.push("body-font"); }
  if (bodySize[text("styleBodySize")]) { vars["--section-body-size"] = bodySize[text("styleBodySize")]; vars["--section-body-scale"] = bodyScale[text("styleBodySize")]; used.push("body-size"); }
  if (alignments.has(text("styleAlign"))) { vars["--section-align"] = text("styleAlign"); vars["--section-justify"] = justify[text("styleAlign")]; used.push("align"); }
  if (spacing[text("styleSpacing")]) { vars["--section-space"] = spacing[text("styleSpacing")]; used.push("spacing"); }
  // Exact padding (px) wins over the named spacing for its side.
  const top = padding(settings.stylePaddingTop);
  const bottom = padding(settings.stylePaddingBottom);
  if (top !== undefined) { vars["--section-pad-top"] = `${top}px`; used.push("pad-top"); }
  if (bottom !== undefined) { vars["--section-pad-bottom"] = `${bottom}px`; used.push("pad-bottom"); }
  if (settings.styleWidth === "full") used.push("full-width");
  // A gradient starts at the section's own background (scheme, own colour or theme) and fades to the chosen colour.
  if (hex.test(text("styleGradientColor"))) {
    const angle = typeof settings.styleGradientAngle === "number" && Number.isFinite(settings.styleGradientAngle) ? Math.min(360, Math.max(0, Math.round(settings.styleGradientAngle))) : 180;
    vars["--section-gradient"] = `linear-gradient(${angle}deg, var(--section-bg, var(--theme-background, #ffffff)), ${text("styleGradientColor")})`;
    used.push("gradient");
  }
  const minHeight = typeof settings.styleMinHeight === "number" && Number.isFinite(settings.styleMinHeight) ? Math.min(1000, Math.max(0, Math.round(settings.styleMinHeight))) : 0;
  if (minHeight > 0) { vars["--section-min-height"] = `${minHeight}px`; used.push("min-height"); }

  // Opacity and shadow go straight on the wrapper; they need no theme rules.
  const direct: CSSProperties = {};
  if (shadows[text("styleShadow")]) direct.boxShadow = shadows[text("styleShadow")];
  if (typeof settings.styleOpacity === "number" && Number.isFinite(settings.styleOpacity)) {
    const opacity = Math.min(100, Math.max(10, Math.round(settings.styleOpacity)));
    if (opacity < 100) direct.opacity = opacity / 100;
  }

  const phone = responsiveVars(mobile, vars, "m");
  const tabletUsed = responsiveVars(tablet, vars, "t");
  const showOn = showOnChoice(settings.styleShowOn);

  return {
    ...(used.length ? { "data-section-style": used.join(" ") } : {}),
    ...(phone.length ? { "data-section-mobile": phone.join(" ") } : {}),
    ...(tabletUsed.length ? { "data-section-tablet": tabletUsed.join(" ") } : {}),
    ...(showOn ? { "data-show-on": showOn } : {}),
    ...(Object.keys(vars).length || Object.keys(direct).length ? { style: { ...vars, ...direct } as CSSProperties } : {}),
  };
}
