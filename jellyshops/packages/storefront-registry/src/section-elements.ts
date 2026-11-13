import { z } from "zod";
import { SECTION_FONT_CHOICES } from "./section-style.js";
import type { BlockDefinition, ControlDefinition, ElementDefinition } from "./types.js";
import { BLOCK_ELEMENTS, ELEMENT_ALIGNMENTS, ELEMENT_WEIGHTS, elementStyleKey, PROPS, SIZE_RANGE } from "./element-data.js";

export { BLOCK_ELEMENTS, ELEMENT_ALIGNMENTS, ELEMENT_WEIGHTS, elementControls, elementStyleKey, elementStyleProps, SECTION_ELEMENTS, sectionElements, type ElementStyleProp } from "./element-data.js";

const themeDefault = { label: "Theme default", value: "" };

export function withBlockElements(definition: BlockDefinition): BlockDefinition {
  const elements = [...(definition.elements ?? []), ...(BLOCK_ELEMENTS[definition.type] ?? []).filter((element) => !definition.elements?.some((own) => own.id === element.id))];
  if (!elements.length) return definition;
  const styles = elements.flatMap(elementStyleControls).filter((control) => !definition.controls.some((own) => own.key === control.key));
  return { ...definition, elements, controls: [...definition.controls, ...styles], settingsSchema: z.intersection(definition.settingsSchema, elementStyleSchema(elements)) };
}

/** Style controls for one element; shown in the element's panel only (`element`). */
export function elementStyleControls(element: ElementDefinition): ControlDefinition[] {
  const base = { group: "style" as const, heading: "Style", element: element.id };
  const [min, max] = SIZE_RANGE[element.kind];
  return PROPS[element.kind].map((prop): ControlDefinition => {
    const key = elementStyleKey(element.id, prop);
    switch (prop) {
      case "color": return { ...base, type: "color", key, label: element.kind === "button" ? "Text colour" : "Colour", allowAlpha: false };
      case "background": return { ...base, type: "color", key, label: "Button colour", allowAlpha: false };
      case "font": return { ...base, type: "select", key, label: "Font", options: [themeDefault, ...SECTION_FONT_CHOICES.map((font) => ({ label: font, value: font }))] };
      case "size": return { ...base, type: "range", key, label: "Text size", min, max, step: 1, unit: "px" };
      case "weight": return { ...base, type: "select", key, label: "Weight", options: [themeDefault, { label: "Light", value: "300" }, { label: "Regular", value: "400" }, { label: "Medium", value: "500" }, { label: "Semibold", value: "600" }, { label: "Bold", value: "700" }] };
      case "align": return { ...base, type: "select", key, label: "Alignment", options: [themeDefault, { label: "Left", value: "left" }, { label: "Centre", value: "center" }, { label: "Right", value: "right" }] };
      case "radius": return { ...base, type: "range", key, label: "Corner radius", min: 0, max: element.kind === "image" ? 60 : 40, step: 1, unit: "px" };
    }
  });
}

const hexColor = z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]);
const choiceOrEmpty = <T extends readonly [string, ...string[]]>(values: T) => z.union([z.enum(values), z.literal("")]);

/** Validation for the elements' style settings (all optional; empty follows the theme). */
export function elementStyleSchema(elements: ElementDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const element of elements) {
    const [min, max] = SIZE_RANGE[element.kind];
    for (const prop of PROPS[element.kind]) {
      const key = elementStyleKey(element.id, prop);
      shape[key] = (prop === "color" || prop === "background" ? hexColor
        : prop === "font" ? choiceOrEmpty(SECTION_FONT_CHOICES)
          : prop === "weight" ? choiceOrEmpty(ELEMENT_WEIGHTS)
            : prop === "align" ? choiceOrEmpty(ELEMENT_ALIGNMENTS)
              : prop === "size" ? z.number().int().min(min).max(max)
                : z.number().int().min(0).max(element.kind === "image" ? 60 : 40)).optional();
    }
  }
  return z.object(shape).passthrough();
}
