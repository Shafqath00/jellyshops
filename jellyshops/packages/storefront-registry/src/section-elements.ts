import { z } from "zod";
import { SECTION_FONT_CHOICES } from "./section-style.js";
import type { BlockDefinition, ControlDefinition, ElementDefinition, ElementKind } from "./types.js";

/**
 * Parts of built-in sections the editor can select on their own (docs/plans/element-selection.md).
 * Each one owns some of the section's settings, and styleable kinds get their own style settings,
 * saved on the section as `el_<elementId>_<prop>`. The renderer marks the matching element with
 * `elementProps()`; a test checks every element listed here is marked.
 */
const heading = (controls = ["heading"]): ElementDefinition => ({ id: "heading", label: "Heading", kind: "heading", controls });
const intro = (controls = ["text"]): ElementDefinition => ({ id: "text", label: "Text", kind: "text", controls });
const image = (controls: string[]): ElementDefinition => ({ id: "image", label: "Image", kind: "image", controls });
const eyebrow: ElementDefinition = { id: "eyebrow", label: "Small heading", kind: "text", controls: ["eyebrow"] };
const productList: ElementDefinition[] = [
  heading(),
  intro(),
  { id: "viewAll", label: "View all link", kind: "link", controls: ["viewAllLabel", "viewAllLink"] },
  { id: "productCard", label: "Product card", kind: "product-card", controls: ["columns", "limit"] },
];

export const SECTION_ELEMENTS: Record<string, ElementDefinition[]> = {
  hero: [eyebrow, image(["image", "overlay", "layout"]), { id: "callouts", label: "Callouts", kind: "text", controls: ["callouts"] }],
  "image-with-text": [eyebrow, image(["image", "imagePosition"])],
  "image-banner": [image(["image", "overlay", "height"])],
  "category-grid": [heading(), intro()],
  "product-grid": productList,
  "featured-collection": productList,
  multicolumn: [heading()],
  testimonials: [heading()],
  faq: [heading(), intro()],
  // Shared sections
  "announcement-bar": [{ id: "message", label: "Message", kind: "text", controls: ["text", "link"] }],
  header: [
    { id: "logo", label: "Logo", kind: "group", controls: ["logo", "storeName", "logoWidth", "logoPosition", "overlayLogo"] },
    { id: "extraLink", label: "Extra link", kind: "link", controls: ["extraLinkLabel", "extraLink", "extraLinkIcon"] },
    { id: "deliveryNote", label: "Delivery note", kind: "text", controls: ["deliveryNote"] },
    { id: "tools", label: "Shopping icons", kind: "group", controls: ["showSearch", "showAccount", "showWishlist", "showCart", "showToolLabels"] },
  ],
  footer: [
    { id: "newsletterHeading", label: "Newsletter heading", kind: "heading", controls: ["showNewsletter", "newsletterHeading"] },
    { id: "newsletterText", label: "Newsletter text", kind: "text", controls: ["newsletterText"] },
    { id: "storeName", label: "Store name", kind: "heading", controls: ["storeName"] },
    { id: "about", label: "About text", kind: "text", controls: ["text"] },
    { id: "email", label: "Contact email", kind: "link", controls: ["contactEmail"] },
    { id: "copyright", label: "Copyright", kind: "text", controls: ["copyright"] },
  ],
  // Product and collection pages
  "product-information": [
    { id: "vendor", label: "Brand", kind: "text", controls: ["showVendor"] },
    { id: "title", label: "Product title", kind: "heading", controls: [] },
    { id: "price", label: "Price", kind: "text", controls: ["showCompareAtPrice", "discountChip"] },
  ],
  "product-purchase": [{ id: "addToCart", label: "Add to cart button", kind: "button", controls: ["label", "showQuantity", "stickyBar"] }],
  "product-description": [heading()],
  "recently-viewed": [heading(), { id: "productCard", label: "Product card", kind: "product-card", controls: ["limit", "columns"] }],
  "related-products": [heading(), { id: "productCard", label: "Product card", kind: "product-card", controls: ["limit"] }],
  "collection-header": [
    { id: "title", label: "Collection title", kind: "heading", controls: ["showTitle"] },
    image(["showImage", "layout"]),
  ],
  // Other sections
  "contact-store-info": [heading(), intro(), image(["image"])],
  "rating-summary": [heading()],
  "image-gallery": [heading(), intro()],
  "logo-list": [heading()],
  "metaobject-list": [heading()],
  "product-specifications": [heading()],
  "blog-header": [intro()],
};

/** Parts of built-in blocks (a column's heading, a collection card's image), styled on the block as `el_<id>_<prop>`. */
export const BLOCK_ELEMENTS: Record<string, ElementDefinition[]> = {
  column: [heading(), intro()],
  "collection-card": [{ id: "label", label: "Label", kind: "heading", controls: ["label", "link"] }, image(["image"])],
  testimonial: [{ id: "quote", label: "Quote", kind: "text", controls: ["quote"] }, { id: "author", label: "Author", kind: "text", controls: ["author"] }],
};

/** Adds a block's parts and their style settings (blocks.ts runs this on every built-in block). */
export function withBlockElements(definition: BlockDefinition): BlockDefinition {
  const elements = [...(definition.elements ?? []), ...(BLOCK_ELEMENTS[definition.type] ?? []).filter((element) => !definition.elements?.some((own) => own.id === element.id))];
  if (!elements.length) return definition;
  const styles = elements.flatMap(elementStyleControls).filter((control) => !definition.controls.some((own) => own.key === control.key));
  return { ...definition, elements, controls: [...definition.controls, ...styles], settingsSchema: z.intersection(definition.settingsSchema, elementStyleSchema(elements)) };
}

/** Setting names of an element's own style settings. */
export function elementStyleKey(elementId: string, prop: ElementStyleProp): string {
  return `el_${elementId}_${prop}`;
}

export type ElementStyleProp = "color" | "font" | "size" | "weight" | "align" | "background" | "radius";

const themeDefault = { label: "Theme default", value: "" };
const PROPS: Record<ElementKind, ElementStyleProp[]> = {
  heading: ["color", "font", "size", "weight", "align"],
  text: ["color", "font", "size", "weight", "align"],
  link: ["color", "size", "weight"],
  button: ["background", "color", "radius", "size"],
  image: ["radius"],
  "product-card": [],
  group: [],
};

export const ELEMENT_WEIGHTS = ["300", "400", "500", "600", "700"] as const;
export const ELEMENT_ALIGNMENTS = ["left", "center", "right"] as const;
const SIZE_RANGE: Record<ElementKind, [number, number]> = { heading: [12, 120], text: [10, 40], link: [10, 32], button: [10, 32], image: [0, 0], "product-card": [0, 0], group: [0, 0] };

/** The style properties an element of this kind can change. */
export function elementStyleProps(kind: ElementKind): ElementStyleProp[] {
  return PROPS[kind];
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

/** A section's elements: the built-in list, plus any the definition declares itself (those win by id). */
export function sectionElements(type: string, own: ElementDefinition[] = []): ElementDefinition[] {
  const builtIn = SECTION_ELEMENTS[type] ?? [];
  return [...own, ...builtIn.filter((element) => !own.some((item) => item.id === element.id))];
}

/** Controls an element's panel shows: the section settings it owns (in the section's order), then its style. */
export function elementControls(controls: ControlDefinition[], element: ElementDefinition): ControlDefinition[] {
  const own = controls.filter((control) => !control.element && element.controls.includes(control.key));
  return [...own, ...controls.filter((control) => control.element === element.id)];
}
