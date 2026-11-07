import type { CSSProperties } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import { elementStyleKey, elementStyleProps, getSectionDefinition, type ElementStyleProp } from "@jelly/storefront-registry";
import { FONT_OPTIONS, fontStack } from "@jelly/storefront-themes";

const fonts = new Set<string>(FONT_OPTIONS.map((font) => font.value));
const hex = /^#[0-9a-fA-F]{6}$/;

/** An element's own style (docs/plans/element-selection.md): only colour, type, alignment and corners, so layout never changes. */
export function elementStyle(section: SectionNode, elementId: string): CSSProperties {
  const element = getSectionDefinition(section.type)?.elements?.find((item) => item.id === elementId);
  if (!element) return {};
  const value = (prop: ElementStyleProp) => section.settings[elementStyleKey(elementId, prop)];
  const style: CSSProperties = {};
  for (const prop of elementStyleProps(element.kind)) {
    const saved = value(prop);
    if (saved === undefined || saved === "") continue;
    if ((prop === "color" || prop === "background") && (typeof saved !== "string" || !hex.test(saved))) continue;
    if (prop === "color") style.color = saved as string;
    else if (prop === "background") { style.background = saved as string; style.borderColor = saved as string; }
    else if (prop === "font" && typeof saved === "string" && fonts.has(saved)) style.fontFamily = fontStack(saved, "Arial");
    else if (prop === "size" && typeof saved === "number") style.fontSize = `${saved}px`;
    else if (prop === "weight" && typeof saved === "string") style.fontWeight = Number(saved);
    else if (prop === "align" && (saved === "left" || saved === "center" || saved === "right")) style.textAlign = saved;
    else if (prop === "radius" && typeof saved === "number") { style.borderRadius = `${saved}px`; if (element.kind === "image") style.overflow = "hidden"; }
  }
  return style;
}

/**
 * Props for a selectable part of a section: its own style, merged over `style`, plus (editor only) the data the
 * preview uses to select and outline it. Spread last so the merged style wins.
 */
export function elementProps(section: SectionNode, elementId: string, editor: boolean, style?: CSSProperties): { style?: CSSProperties; "data-editor-element"?: string; "data-editor-element-label"?: string } {
  const own = elementStyle(section, elementId);
  const merged = { ...style, ...own };
  const label = editor ? getSectionDefinition(section.type)?.elements?.find((item) => item.id === elementId)?.label : undefined;
  return {
    ...(Object.keys(merged).length ? { style: merged } : {}),
    ...(label ? { "data-editor-element": elementId, "data-editor-element-label": label } : {}),
  };
}
