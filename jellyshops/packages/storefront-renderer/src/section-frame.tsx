import type { HTMLAttributes, ReactNode } from "react";
import type { ContractScheme } from "@jelly/storefront-themes";

/**
 * Section frame (docs/design-contract.md §2.3). `RegistrySectionRenderer` wraps every section, header and footer in
 * one, so every page part shares the same content edges. The width rule lives in `storefront-base.css`
 * ("Section frame"): the section's `.jelly-container` is the content column, `--j-page-normal` wide (or
 * `--j-page-narrow`), at least `--j-page-margin` from each side of the screen. Themes set those token values; they do
 * not write their own container rule.
 */
export type SectionFrameWidth = "page" | "narrow" | "full";

const WIDTHS: readonly SectionFrameWidth[] = ["page", "narrow", "full"];

/** The frame width a section asked for (its "Width" setting); page width when unset or unknown. */
export function sectionFrameWidth(settings: Record<string, unknown> | undefined): SectionFrameWidth {
  const width = settings?.styleWidth;
  return typeof width === "string" && (WIDTHS as readonly string[]).includes(width) ? width as SectionFrameWidth : "page";
}

/**
 * The section's colour scheme, one value for all three ways a section can be coloured: its own colours ("custom",
 * when "Use my own colours" is on with a colour), else a theme scheme (`styleScheme`, scheme1-8), else the older
 * Background choice (`colorScheme` page/soft/dark, an alias of a theme scheme). Undefined: the page's colours.
 * `storefront-base.css` points every colour role (`--j-color-bg`, `--j-color-text`, …) at the scheme inside the frame.
 */
export function sectionScheme(settings: Record<string, unknown> | undefined): ContractScheme | undefined {
  if (!settings) return undefined;
  const text = (key: string) => typeof settings[key] === "string" ? settings[key] as string : "";
  if (settings.styleColors === true && (HEX.test(text("styleBackground")) || HEX.test(text("styleText")))) return "custom";
  if (/^scheme[1-8]$/.test(text("styleScheme"))) return text("styleScheme") as ContractScheme;
  if (["page", "soft", "dark"].includes(text("colorScheme"))) return text("colorScheme") as ContractScheme;
  return undefined;
}
const HEX = /^#[0-9a-fA-F]{6}$/;

export function SectionFrame({ width = "page", scheme, children, ...props }: HTMLAttributes<HTMLDivElement> & { width?: SectionFrameWidth; scheme?: ContractScheme; children?: ReactNode }) {
  return <div {...props} data-section-frame="" data-frame-width={width} {...(scheme ? { "data-scheme": scheme } : {})}>{children}</div>;
}
