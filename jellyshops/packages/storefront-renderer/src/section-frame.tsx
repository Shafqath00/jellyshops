import type { HTMLAttributes, ReactNode } from "react";

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

export function SectionFrame({ width = "page", children, ...props }: HTMLAttributes<HTMLDivElement> & { width?: SectionFrameWidth; children?: ReactNode }) {
  return <div {...props} data-section-frame="" data-frame-width={width}>{children}</div>;
}
