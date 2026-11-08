import type { CSSProperties } from "react";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { elementStyleKey, elementStyleProps, getBlockDefinition, getSectionDefinition, type ElementDefinition } from "@jelly/storefront-registry";
import { FONT_OPTIONS, fontStack } from "@jelly/storefront-themes";

const fonts = new Set<string>(FONT_OPTIONS.map((font) => font.value));
const hex = /^#[0-9a-fA-F]{6}$/;

/** An element's own style (docs/plans/element-selection.md): only colour, type, alignment and corners, so layout never changes. */
function styleFor(element: ElementDefinition | undefined, settings: Record<string, unknown>): CSSProperties {
  if (!element) return {};
  const style: CSSProperties = {};
  for (const prop of elementStyleProps(element.kind)) {
    const saved = settings[elementStyleKey(element.id, prop)];
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

type ElementProps = { style?: CSSProperties; "data-editor-element"?: string; "data-editor-element-label"?: string };

function propsFor(element: ElementDefinition | undefined, settings: Record<string, unknown>, editor: boolean, style?: CSSProperties): ElementProps {
  const merged = { ...style, ...styleFor(element, settings) };
  return {
    ...(Object.keys(merged).length ? { style: merged } : {}),
    ...(editor && element ? { "data-editor-element": element.id, "data-editor-element-label": element.label } : {}),
  };
}

const sectionElement = (type: string, id: string) => getSectionDefinition(type)?.elements?.find((item) => item.id === id);
const blockElement = (type: string, id: string) => getBlockDefinition(type)?.elements?.find((item) => item.id === id);

export function elementStyle(section: SectionNode, elementId: string): CSSProperties {
  return styleFor(sectionElement(section.type, elementId), section.settings);
}

/**
 * Props for a selectable part of a section: its own style, merged over `style`, plus (editor only) the data the
 * preview uses to select and outline it. Spread last so the merged style wins.
 */
export function elementProps(section: Pick<SectionNode, "type" | "settings">, elementId: string, editor: boolean, style?: CSSProperties): ElementProps {
  return propsFor(sectionElement(section.type, elementId), section.settings, editor, style);
}

/** The same for a part of a block (a column's heading, a collection card's image); it must sit inside the block's editor element. */
export function blockElementProps(block: Pick<BlockNode, "type" | "settings">, elementId: string, editor: boolean, style?: CSSProperties): ElementProps {
  return propsFor(blockElement(block.type, elementId), block.settings, editor, style);
}
