import type { CSSProperties } from "react";
import { fontStack } from "@jelly/storefront-themes";

/**
 * Turns a section's shared style settings into CSS variables on its wrapper.
 * `data-section-style` lists which settings are in use, so theme CSS only
 * overrides its own tokens for those (see the themes' "Section style" rules).
 * Unknown values are ignored, so nothing a merchant saves can inject CSS.
 */
const headingScale: Record<string, string> = { small: "0.8", medium: "1", large: "1.2", "x-large": "1.45" };
const bodySize: Record<string, string> = { small: "14px", regular: "16px", large: "18px" };
/** Themes scale all their text sizes by this, since most text uses the smaller sizes. */
const bodyScale: Record<string, string> = { small: "0.9", regular: "1", large: "1.15" };
const weights = new Set(["300", "400", "500", "600", "700"]);
const alignments = new Set(["left", "center", "right"]);
const spacing: Record<string, string> = { none: "0px", small: "clamp(24px, 4vw, 40px)", large: "clamp(80px, 11vw, 144px)" };
const fonts = new Set(["Fraunces", "Inter", "Georgia", "Arial"]);
const hex = /^#[0-9a-fA-F]{6}$/;

export interface SectionStyleProps {
  "data-section-style"?: string;
  style?: CSSProperties;
}

export function sectionStyleProps(settings: Record<string, unknown> | undefined): SectionStyleProps {
  if (!settings) return {};
  const vars: Record<string, string> = {};
  const used: string[] = [];
  const text = (key: string) => typeof settings[key] === "string" ? settings[key] as string : "";

  // A colour left empty keeps the theme's, so ticking "Use my own colours" never blanks the section.
  if (settings.styleColors === true && (hex.test(text("styleBackground")) || hex.test(text("styleText")))) {
    vars["--section-bg"] = hex.test(text("styleBackground")) ? text("styleBackground") : "var(--theme-background, #ffffff)";
    vars["--section-text"] = hex.test(text("styleText")) ? text("styleText") : "var(--theme-text, #1c1b19)";
    used.push("colors");
  }
  if (fonts.has(text("styleHeadingFont"))) { vars["--section-heading-font"] = fontStack(text("styleHeadingFont"), "Arial"); used.push("heading-font"); }
  if (headingScale[text("styleHeadingSize")]) { vars["--section-heading-scale"] = headingScale[text("styleHeadingSize")]; used.push("heading-size"); }
  if (weights.has(text("styleHeadingWeight"))) { vars["--section-heading-weight"] = text("styleHeadingWeight"); used.push("heading-weight"); }
  if (fonts.has(text("styleBodyFont"))) { vars["--section-body-font"] = fontStack(text("styleBodyFont"), "Arial"); used.push("body-font"); }
  if (bodySize[text("styleBodySize")]) { vars["--section-body-size"] = bodySize[text("styleBodySize")]; vars["--section-body-scale"] = bodyScale[text("styleBodySize")]; used.push("body-size"); }
  if (alignments.has(text("styleAlign"))) { vars["--section-align"] = text("styleAlign"); used.push("align"); }
  if (spacing[text("styleSpacing")]) { vars["--section-space"] = spacing[text("styleSpacing")]; used.push("spacing"); }

  return used.length ? { "data-section-style": used.join(" "), style: vars as CSSProperties } : {};
}
