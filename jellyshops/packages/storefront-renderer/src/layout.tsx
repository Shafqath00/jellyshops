import { createElement, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import type { ContractSpace, ContractTypePreset } from "@jelly/storefront-themes";

/**
 * Layout primitives (docs/design-contract.md §2.3). Sections lay things out with these instead of their own
 * spacing: every gap is a name on the contract spacing scale, every text style a contract preset, so a theme changes
 * the look by changing token values. Styles: "Layout primitives" in `storefront-base.css` (zero specificity, so a
 * theme's rule for a section's own class still wins while sections move over).
 *
 * Each primitive keeps the `className` it is given, so existing theme rules keep matching.
 */

type Props = Omit<HTMLAttributes<HTMLElement>, "style"> & { className?: string; style?: CSSProperties; children?: ReactNode };
type Tag = "div" | "section" | "article" | "ul" | "ol" | "li" | "header" | "footer" | "figure" | "span" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

const space = (name: ContractSpace) => `var(--j-space-${name})`;
const classes = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(" ");

/** Children one under the other (or side by side with `direction="row"`), `gap` apart. */
export function Stack({ as = "div", gap = "md", direction = "column", align, className, style, children, ...props }: Props & {
  as?: Tag;
  gap?: ContractSpace;
  direction?: "column" | "row";
  align?: "start" | "center" | "end" | "stretch";
}) {
  return createElement(as, {
    ...props,
    className: classes("jelly-layout-stack", className),
    "data-direction": direction,
    ...(align ? { "data-align": align } : {}),
    style: { "--jelly-layout-gap": space(gap), ...style } as CSSProperties,
  }, children);
}

/** Equal columns: `columns` on desktop, `tabletColumns` (default: the smaller of columns and 2) and `mobileColumns` (default 1) on smaller screens. */
export function Grid({ as = "div", columns = 3, tabletColumns, mobileColumns = 1, gap = "lg", rowGap, className, style, children, ...props }: Props & {
  as?: Tag;
  columns?: number;
  tabletColumns?: number;
  mobileColumns?: number;
  gap?: ContractSpace;
  rowGap?: ContractSpace;
}) {
  const clamp = (value: number) => Math.min(6, Math.max(1, Math.round(value)));
  return createElement(as, {
    ...props,
    className: classes("jelly-layout-grid", className),
    style: {
      "--jelly-layout-columns": clamp(columns),
      "--jelly-layout-columns-tablet": clamp(tabletColumns ?? Math.min(columns, 2)),
      "--jelly-layout-columns-mobile": clamp(mobileColumns),
      "--jelly-layout-gap": space(gap),
      "--jelly-layout-row-gap": space(rowGap ?? gap),
      ...style,
    } as CSSProperties,
  }, children);
}

export type MediaRatio = "square" | "portrait" | "landscape" | "wide" | "auto";
const RATIOS: Record<Exclude<MediaRatio, "auto">, string> = { square: "1 / 1", portrait: "4 / 5", landscape: "4 / 3", wide: "16 / 9" };

/** A box of a fixed shape for an image or video; the media inside fills it (`cover` crops, `contain` fits). */
export function MediaFrame({ ratio = "auto", fit = "cover", focal, className, style, children, ...props }: Props & {
  ratio?: MediaRatio;
  fit?: "cover" | "contain";
  /** Focal point in % from the top left, e.g. { x: 50, y: 30 }. */
  focal?: { x: number; y: number };
}) {
  const percent = (value: number) => `${Math.min(100, Math.max(0, value))}%`;
  return <div
    {...props}
    className={classes("jelly-layout-media", className)}
    data-fit={fit}
    style={{
      ...(ratio !== "auto" ? { aspectRatio: RATIOS[ratio] } : {}),
      ...(focal ? { "--jelly-layout-focal": `${percent(focal.x)} ${percent(focal.y)}` } : {}),
      ...style,
    } as CSSProperties}
  >{children}</div>;
}

/** Text in one of the contract text styles, aligned, at most `maxWidth` wide (narrow ≈ 36rem, normal ≈ 42rem). */
export function TextBlock({ as = "div", preset = "body", align, maxWidth = "none", className, style, children, ...props }: Props & {
  as?: Tag;
  preset?: ContractTypePreset;
  align?: "left" | "center" | "right";
  maxWidth?: "narrow" | "normal" | "none";
}) {
  return createElement(as, {
    ...props,
    className: classes("jelly-layout-text", className),
    "data-preset": preset,
    ...(align ? { "data-align": align } : {}),
    ...(maxWidth !== "none" ? { "data-max-width": maxWidth } : {}),
    style: {
      "--jelly-layout-size": `var(--j-type-${preset}-size)`,
      "--jelly-layout-line": `var(--j-type-${preset}-line)`,
      "--jelly-layout-track": `var(--j-type-${preset}-track)`,
      "--jelly-layout-case": `var(--j-type-${preset}-case)`,
      "--jelly-layout-font": `var(--j-type-${preset}-font)`,
      ...style,
    } as CSSProperties,
  }, children);
}
